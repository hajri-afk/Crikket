import {
  DEFAULT_ROOM_COLOR,
  isRoomColor,
  ROOM_COLOR_OPTIONS,
  type RoomColor,
} from "@crikket/shared/constants/room"

export interface RoomColorClasses {
  /** Small dot used inside chips, menus, and pickers. */
  dot: string
  /** Bordered chip used on cards and toolbars. */
  badge: string
  /** Tinted surface used for the room icon tile. */
  surface: string
}

/**
 * Tailwind needs literal class names, so every room color is spelled out here
 * instead of being interpolated from the color token. Shared by the dashboard
 * and the extension so a room looks identical in both surfaces.
 */
export const ROOM_COLOR_CLASSES: Record<RoomColor, RoomColorClasses> = {
  slate: {
    badge:
      "border-slate-500/30 bg-slate-500/10 text-slate-700 dark:text-slate-300",
    dot: "bg-slate-500",
    surface:
      "bg-slate-500/10 text-slate-600 ring-slate-500/20 dark:text-slate-300",
  },
  blue: {
    badge: "border-blue-500/30 bg-blue-500/10 text-blue-700 dark:text-blue-400",
    dot: "bg-blue-500",
    surface: "bg-blue-500/10 text-blue-600 ring-blue-500/20 dark:text-blue-400",
  },
  emerald: {
    badge:
      "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
    dot: "bg-emerald-500",
    surface:
      "bg-emerald-500/10 text-emerald-600 ring-emerald-500/20 dark:text-emerald-400",
  },
  amber: {
    badge:
      "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-400",
    dot: "bg-amber-500",
    surface:
      "bg-amber-500/10 text-amber-600 ring-amber-500/20 dark:text-amber-400",
  },
  violet: {
    badge:
      "border-violet-500/30 bg-violet-500/10 text-violet-700 dark:text-violet-400",
    dot: "bg-violet-500",
    surface:
      "bg-violet-500/10 text-violet-600 ring-violet-500/20 dark:text-violet-400",
  },
  rose: {
    badge: "border-rose-500/30 bg-rose-500/10 text-rose-700 dark:text-rose-400",
    dot: "bg-rose-500",
    surface: "bg-rose-500/10 text-rose-600 ring-rose-500/20 dark:text-rose-400",
  },
  cyan: {
    badge: "border-cyan-500/30 bg-cyan-500/10 text-cyan-700 dark:text-cyan-400",
    dot: "bg-cyan-500",
    surface: "bg-cyan-500/10 text-cyan-600 ring-cyan-500/20 dark:text-cyan-400",
  },
  orange: {
    badge:
      "border-orange-500/30 bg-orange-500/10 text-orange-700 dark:text-orange-400",
    dot: "bg-orange-500",
    surface:
      "bg-orange-500/10 text-orange-600 ring-orange-500/20 dark:text-orange-400",
  },
}

export const ROOM_COLOR_CHOICES: Array<{ value: RoomColor; label: string }> =
  ROOM_COLOR_OPTIONS.map((color) => ({
    label: `${color.charAt(0).toUpperCase()}${color.slice(1)}`,
    value: color,
  }))

export function getRoomColorClasses(
  color: string | undefined | null
): RoomColorClasses {
  return ROOM_COLOR_CLASSES[isRoomColor(color) ? color : DEFAULT_ROOM_COLOR]
}
