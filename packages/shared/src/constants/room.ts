export const ROOM_STATUS_OPTIONS = {
  active: "active",
  archived: "archived",
} as const

export type RoomStatus =
  (typeof ROOM_STATUS_OPTIONS)[keyof typeof ROOM_STATUS_OPTIONS]

export const ROOM_COLOR_OPTIONS = [
  "slate",
  "blue",
  "emerald",
  "amber",
  "violet",
  "rose",
  "cyan",
  "orange",
] as const

export type RoomColor = (typeof ROOM_COLOR_OPTIONS)[number]

export const DEFAULT_ROOM_COLOR: RoomColor = "slate"

export const ROOM_NAME_MAX_LENGTH = 60
export const ROOM_DESCRIPTION_MAX_LENGTH = 300
export const ROOM_SLUG_MAX_LENGTH = 60

/** Sentinel used by report filters to match reports without a room. */
export const UNASSIGNED_ROOM_FILTER_VALUE = "none"

export function isRoomColor(value: unknown): value is RoomColor {
  return (
    typeof value === "string" &&
    (ROOM_COLOR_OPTIONS as readonly string[]).includes(value)
  )
}

export function isRoomStatus(value: unknown): value is RoomStatus {
  return (
    typeof value === "string" &&
    Object.values(ROOM_STATUS_OPTIONS).includes(value as RoomStatus)
  )
}
