import {
  ROOM_COLOR_OPTIONS,
  ROOM_DESCRIPTION_MAX_LENGTH,
  ROOM_NAME_MAX_LENGTH,
  ROOM_STATUS_OPTIONS,
  type RoomColor,
  type RoomStatus,
} from "@crikket/shared/constants/room"
import { z } from "zod"
import {
  assignReportsToRoom,
  createRoom,
  deleteRoom,
  getRoomById,
  listRoomsWithStats,
  type RoomRecord,
  type RoomWithStats,
  updateRoom,
} from "../lib/rooms"
import { protectedProcedure } from "./context"
import { requireActiveOrgId } from "./helpers"

const roomColorValues = ROOM_COLOR_OPTIONS as unknown as [
  RoomColor,
  ...RoomColor[],
]
const roomStatusValues = Object.values(ROOM_STATUS_OPTIONS) as [
  RoomStatus,
  ...RoomStatus[],
]

const roomIdSchema = z.object({
  roomId: z.string().min(1),
})

const roomNameSchema = z.string().trim().min(1).max(ROOM_NAME_MAX_LENGTH)
const roomDescriptionSchema = z.string().trim().max(ROOM_DESCRIPTION_MAX_LENGTH)

const listRoomsInputSchema = z
  .object({
    statuses: z.array(z.enum(roomStatusValues)).max(2).optional(),
  })
  .optional()

const createRoomInputSchema = z.object({
  name: roomNameSchema,
  description: roomDescriptionSchema.optional(),
  color: z.enum(roomColorValues).optional(),
})

const updateRoomInputSchema = roomIdSchema
  .extend({
    name: roomNameSchema.optional(),
    description: roomDescriptionSchema.nullable().optional(),
    color: z.enum(roomColorValues).optional(),
    status: z.enum(roomStatusValues).optional(),
  })
  .superRefine((value, ctx) => {
    if (
      value.name === undefined &&
      value.description === undefined &&
      value.color === undefined &&
      value.status === undefined
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "At least one update field is required",
      })
    }
  })

const assignReportsInputSchema = z.object({
  reportIds: z.array(z.string().min(1)).min(1).max(200),
  roomId: z.string().min(1).nullable(),
})

export interface RoomListItem {
  id: string
  name: string
  slug: string
  description: string | undefined
  color: RoomColor
  status: RoomStatus
  reportCount: number
  openReportCount: number
  lastReportAt: string | undefined
  createdAt: string
  updatedAt: string
}

function toRoomListItem(room: RoomWithStats): RoomListItem {
  return {
    color: room.color,
    createdAt: room.createdAt.toISOString(),
    description: room.description ?? undefined,
    id: room.id,
    lastReportAt: room.lastReportAt?.toISOString(),
    name: room.name,
    openReportCount: room.openReportCount,
    reportCount: room.reportCount,
    slug: room.slug,
    status: room.status,
    updatedAt: room.updatedAt.toISOString(),
  }
}

function toRoomItem(
  room: RoomRecord
): Omit<RoomListItem, "lastReportAt" | "openReportCount" | "reportCount"> {
  return {
    color: room.color,
    createdAt: room.createdAt.toISOString(),
    description: room.description ?? undefined,
    id: room.id,
    name: room.name,
    slug: room.slug,
    status: room.status,
    updatedAt: room.updatedAt.toISOString(),
  }
}

export const listRooms = protectedProcedure
  .input(listRoomsInputSchema)
  .handler(async ({ context, input }): Promise<RoomListItem[]> => {
    const organizationId = requireActiveOrgId(context.session)
    const rooms = await listRoomsWithStats({
      organizationId,
      statuses: input?.statuses,
    })

    return rooms.map(toRoomListItem)
  })

export const getRoom = protectedProcedure
  .input(roomIdSchema)
  .handler(async ({ context, input }): Promise<RoomListItem> => {
    const organizationId = requireActiveOrgId(context.session)
    const room = await getRoomById({
      organizationId,
      roomId: input.roomId,
    })

    return toRoomListItem(room)
  })

export const createRoomProcedure = protectedProcedure
  .input(createRoomInputSchema)
  .handler(async ({ context, input }) => {
    const organizationId = requireActiveOrgId(context.session)
    const room = await createRoom({
      color: input.color,
      createdBy: context.session.user.id,
      description: input.description,
      name: input.name,
      organizationId,
    })

    return toRoomItem(room)
  })

export const updateRoomProcedure = protectedProcedure
  .input(updateRoomInputSchema)
  .handler(async ({ context, input }) => {
    const organizationId = requireActiveOrgId(context.session)
    const room = await updateRoom({
      color: input.color,
      description: input.description,
      name: input.name,
      organizationId,
      roomId: input.roomId,
      status: input.status,
    })

    return toRoomItem(room)
  })

export const deleteRoomProcedure = protectedProcedure
  .input(roomIdSchema)
  .handler(({ context, input }) => {
    const organizationId = requireActiveOrgId(context.session)

    return deleteRoom({
      organizationId,
      roomId: input.roomId,
    })
  })

export const assignBugReportsToRoom = protectedProcedure
  .input(assignReportsInputSchema)
  .handler(({ context, input }) => {
    const organizationId = requireActiveOrgId(context.session)

    return assignReportsToRoom({
      organizationId,
      reportIds: input.reportIds,
      roomId: input.roomId,
    })
  })
