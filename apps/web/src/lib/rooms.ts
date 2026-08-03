import {
  ROOM_STATUS_OPTIONS,
  type RoomStatus,
} from "@crikket/shared/constants/room"

export {
  getRoomColorClasses,
  ROOM_COLOR_CHOICES,
  ROOM_COLOR_CLASSES,
  type RoomColorClasses,
} from "@crikket/ui/lib/room-colors"

export function formatRoomStatusLabel(status: RoomStatus): string {
  return status === ROOM_STATUS_OPTIONS.archived ? "Archived" : "Active"
}

const MINUTE_MS = 60_000
const HOUR_MS = 60 * MINUTE_MS
const DAY_MS = 24 * HOUR_MS
const WEEK_MS = 7 * DAY_MS

/**
 * Compact "time ago" label for room cards. Falls back to a plain date once the
 * event is older than a month, where relative wording stops being useful.
 */
export function formatRelativeTime(value: string | undefined): string | null {
  if (!value) {
    return null
  }

  const timestamp = new Date(value).getTime()
  if (Number.isNaN(timestamp)) {
    return null
  }

  const elapsed = Date.now() - timestamp
  if (elapsed < MINUTE_MS) {
    return "just now"
  }

  if (elapsed < HOUR_MS) {
    const minutes = Math.floor(elapsed / MINUTE_MS)
    return `${minutes}m ago`
  }

  if (elapsed < DAY_MS) {
    const hours = Math.floor(elapsed / HOUR_MS)
    return `${hours}h ago`
  }

  if (elapsed < WEEK_MS) {
    const days = Math.floor(elapsed / DAY_MS)
    return `${days}d ago`
  }

  if (elapsed < 4 * WEEK_MS) {
    const weeks = Math.floor(elapsed / WEEK_MS)
    return `${weeks}w ago`
  }

  return new Date(timestamp).toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  })
}
