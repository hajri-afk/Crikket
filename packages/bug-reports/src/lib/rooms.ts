import { db } from "@crikket/db"
import { bugReport } from "@crikket/db/schema/bug-report"
import { room } from "@crikket/db/schema/room"
import {
  DEFAULT_ROOM_COLOR,
  isRoomColor,
  isRoomStatus,
  ROOM_SLUG_MAX_LENGTH,
  ROOM_STATUS_OPTIONS,
  type RoomColor,
  type RoomStatus,
} from "@crikket/shared/constants/room"
import { retryOnUniqueViolation } from "@crikket/shared/lib/server/retry-on-unique-violation"
import { ORPCError } from "@orpc/server"
import { and, asc, count, eq, inArray, ne, sql } from "drizzle-orm"
import { nanoid } from "nanoid"

const ROOM_ID_LENGTH = 12
const SLUG_SUFFIX_LENGTH = 5

export interface RoomRecord {
  archivedAt: Date | null
  color: RoomColor
  createdAt: Date
  createdBy: string | null
  description: string | null
  id: string
  name: string
  organizationId: string
  slug: string
  status: RoomStatus
  updatedAt: Date
}

export interface RoomWithStats extends RoomRecord {
  reportCount: number
  openReportCount: number
  lastReportAt: Date | null
}

type RoomRow = typeof room.$inferSelect

function toRoomRecord(row: RoomRow): RoomRecord {
  return {
    archivedAt: row.archivedAt,
    color: isRoomColor(row.color) ? row.color : DEFAULT_ROOM_COLOR,
    createdAt: row.createdAt,
    createdBy: row.createdBy,
    description: row.description,
    id: row.id,
    name: row.name,
    organizationId: row.organizationId,
    slug: row.slug,
    status: isRoomStatus(row.status) ? row.status : ROOM_STATUS_OPTIONS.active,
    updatedAt: row.updatedAt,
  }
}

function toDateOrNull(value: Date | string | null | undefined): Date | null {
  if (!value) {
    return null
  }

  return value instanceof Date ? value : new Date(value)
}

export function buildRoomSlug(name: string): string {
  const normalized = name
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, ROOM_SLUG_MAX_LENGTH)

  return normalized || `room-${nanoid(SLUG_SUFFIX_LENGTH).toLowerCase()}`
}

function buildUniqueSlugCandidate(baseSlug: string, attempt: number): string {
  if (attempt === 0) {
    return baseSlug
  }

  const suffix = `-${nanoid(SLUG_SUFFIX_LENGTH).toLowerCase()}`
  return `${baseSlug.slice(0, ROOM_SLUG_MAX_LENGTH - suffix.length)}${suffix}`
}

async function resolveAvailableSlug(input: {
  baseSlug: string
  excludeRoomId?: string
  organizationId: string
}): Promise<string> {
  const MAX_ATTEMPTS = 5

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const candidate = buildUniqueSlugCandidate(input.baseSlug, attempt)
    const filters = [
      eq(room.organizationId, input.organizationId),
      eq(room.slug, candidate),
    ]

    if (input.excludeRoomId) {
      filters.push(ne(room.id, input.excludeRoomId))
    }

    const existing = await db.query.room.findFirst({
      where: and(...filters),
      columns: { id: true },
    })

    if (!existing) {
      return candidate
    }
  }

  return `${input.baseSlug.slice(0, ROOM_SLUG_MAX_LENGTH - 13)}-${nanoid(SLUG_SUFFIX_LENGTH).toLowerCase()}`
}

export async function listRoomsWithStats(input: {
  organizationId: string
  statuses?: RoomStatus[]
}): Promise<RoomWithStats[]> {
  const filters = [eq(room.organizationId, input.organizationId)]

  if (input.statuses && input.statuses.length > 0) {
    filters.push(inArray(room.status, Array.from(new Set(input.statuses))))
  }

  const rows = await db
    .select({
      room,
      reportCount: sql<number>`COUNT(${bugReport.id})`,
      openReportCount: sql<number>`COUNT(${bugReport.id}) FILTER (WHERE ${bugReport.status} = 'open')`,
      lastReportAt: sql<Date | string | null>`MAX(${bugReport.createdAt})`,
    })
    .from(room)
    .leftJoin(bugReport, eq(bugReport.roomId, room.id))
    .where(and(...filters))
    .groupBy(room.id)
    .orderBy(asc(room.name))

  return rows.map((row) => ({
    ...toRoomRecord(row.room),
    lastReportAt: toDateOrNull(row.lastReportAt),
    openReportCount: Number(row.openReportCount ?? 0),
    reportCount: Number(row.reportCount ?? 0),
  }))
}

export async function getRoomById(input: {
  organizationId: string
  roomId: string
}): Promise<RoomWithStats> {
  const row = await db.query.room.findFirst({
    where: and(
      eq(room.id, input.roomId),
      eq(room.organizationId, input.organizationId)
    ),
  })

  if (!row) {
    throw new ORPCError("NOT_FOUND", { message: "Room not found" })
  }

  const [stats] = await db
    .select({
      reportCount: count(),
      openReportCount: sql<number>`COUNT(${bugReport.id}) FILTER (WHERE ${bugReport.status} = 'open')`,
      lastReportAt: sql<Date | string | null>`MAX(${bugReport.createdAt})`,
    })
    .from(bugReport)
    .where(eq(bugReport.roomId, row.id))

  return {
    ...toRoomRecord(row),
    lastReportAt: toDateOrNull(stats?.lastReportAt),
    openReportCount: Number(stats?.openReportCount ?? 0),
    reportCount: Number(stats?.reportCount ?? 0),
  }
}

/**
 * Ensures the room exists inside the organization before it gets attached to a
 * bug report. Archived rooms stay readable but reject new reports.
 */
export async function assertRoomInOrganization(input: {
  organizationId: string
  requireActive?: boolean
  roomId: string
}): Promise<RoomRecord> {
  const row = await db.query.room.findFirst({
    where: and(
      eq(room.id, input.roomId),
      eq(room.organizationId, input.organizationId)
    ),
  })

  if (!row) {
    throw new ORPCError("NOT_FOUND", { message: "Room not found" })
  }

  const record = toRoomRecord(row)

  if (input.requireActive && record.status === ROOM_STATUS_OPTIONS.archived) {
    throw new ORPCError("BAD_REQUEST", {
      message: `Room "${record.name}" is archived and cannot receive new bug reports.`,
    })
  }

  return record
}

export function createRoom(input: {
  color?: RoomColor
  createdBy?: string | null
  description?: string
  name: string
  organizationId: string
}): Promise<RoomRecord> {
  return retryOnUniqueViolation(async () => {
    const slug = await resolveAvailableSlug({
      baseSlug: buildRoomSlug(input.name),
      organizationId: input.organizationId,
    })

    const [created] = await db
      .insert(room)
      .values({
        id: nanoid(ROOM_ID_LENGTH),
        color: input.color ?? DEFAULT_ROOM_COLOR,
        createdBy: input.createdBy ?? null,
        description: input.description ?? null,
        name: input.name,
        organizationId: input.organizationId,
        slug,
        status: ROOM_STATUS_OPTIONS.active,
      })
      .returning()

    if (!created) {
      throw new ORPCError("INTERNAL_SERVER_ERROR", {
        message: "Failed to create room.",
      })
    }

    return toRoomRecord(created)
  })
}

export async function updateRoom(input: {
  color?: RoomColor
  description?: string | null
  name?: string
  organizationId: string
  roomId: string
  status?: RoomStatus
}): Promise<RoomRecord> {
  await assertRoomInOrganization({
    organizationId: input.organizationId,
    roomId: input.roomId,
  })

  const values: Partial<typeof room.$inferInsert> = {}

  if (input.name !== undefined) {
    values.name = input.name
    values.slug = await resolveAvailableSlug({
      baseSlug: buildRoomSlug(input.name),
      excludeRoomId: input.roomId,
      organizationId: input.organizationId,
    })
  }

  if (input.description !== undefined) {
    values.description = input.description
  }

  if (input.color !== undefined) {
    values.color = input.color
  }

  if (input.status !== undefined) {
    values.status = input.status
    values.archivedAt =
      input.status === ROOM_STATUS_OPTIONS.archived ? new Date() : null
  }

  if (Object.keys(values).length === 0) {
    throw new ORPCError("BAD_REQUEST", {
      message: "At least one update field is required.",
    })
  }

  const updated = await retryOnUniqueViolation(() =>
    db
      .update(room)
      .set(values)
      .where(
        and(
          eq(room.id, input.roomId),
          eq(room.organizationId, input.organizationId)
        )
      )
      .returning()
  )

  const record = updated[0]
  if (!record) {
    throw new ORPCError("NOT_FOUND", { message: "Room not found" })
  }

  return toRoomRecord(record)
}

/**
 * Deleting a room never deletes its bug reports; they fall back to the
 * "unassigned" bucket via the `ON DELETE SET NULL` foreign key.
 */
export async function deleteRoom(input: {
  organizationId: string
  roomId: string
}): Promise<{ id: string; releasedReportCount: number }> {
  await assertRoomInOrganization({
    organizationId: input.organizationId,
    roomId: input.roomId,
  })

  const [reportStats] = await db
    .select({ value: count() })
    .from(bugReport)
    .where(eq(bugReport.roomId, input.roomId))

  const deleted = await db
    .delete(room)
    .where(
      and(
        eq(room.id, input.roomId),
        eq(room.organizationId, input.organizationId)
      )
    )
    .returning({ id: room.id })

  const record = deleted[0]
  if (!record) {
    throw new ORPCError("NOT_FOUND", { message: "Room not found" })
  }

  return {
    id: record.id,
    releasedReportCount: reportStats?.value ?? 0,
  }
}

export async function assignReportsToRoom(input: {
  organizationId: string
  reportIds: string[]
  roomId: string | null
}): Promise<{ ids: string[]; updatedCount: number }> {
  if (input.roomId) {
    await assertRoomInOrganization({
      organizationId: input.organizationId,
      requireActive: true,
      roomId: input.roomId,
    })
  }

  const uniqueIds = Array.from(new Set(input.reportIds))
  const updated = await db
    .update(bugReport)
    .set({ roomId: input.roomId })
    .where(
      and(
        eq(bugReport.organizationId, input.organizationId),
        inArray(bugReport.id, uniqueIds)
      )
    )
    .returning({ id: bugReport.id })

  return {
    ids: updated.map((row) => row.id),
    updatedCount: updated.length,
  }
}
