"use client"

import { ROOM_STATUS_OPTIONS } from "@crikket/shared/constants/room"
import { Button } from "@crikket/ui/components/ui/button"
import { Card, CardContent } from "@crikket/ui/components/ui/card"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@crikket/ui/components/ui/dropdown-menu"
import { cn } from "@crikket/ui/lib/utils"
import {
  ArchiveRestore,
  ArchiveX,
  ArrowUpRight,
  Clock,
  Edit3,
  LayoutGrid,
  MoreVertical,
  Trash2,
} from "lucide-react"
import Link from "next/link"

import type { RoomListItem } from "@/components/rooms/types"
import { formatRelativeTime, getRoomColorClasses } from "@/lib/rooms"

interface RoomCardProps {
  isMutating: boolean
  onEdit: () => void
  onRequestDelete: () => void
  onToggleArchive: () => void
  room: RoomListItem
}

export function RoomCard({
  isMutating,
  onEdit,
  onRequestDelete,
  onToggleArchive,
  room,
}: RoomCardProps) {
  const colorClasses = getRoomColorClasses(room.color)
  const isArchived = room.status === ROOM_STATUS_OPTIONS.archived
  const lastCaptureLabel = formatRelativeTime(room.lastReportAt)
  const resolvedCount = Math.max(0, room.reportCount - room.openReportCount)
  const openRatio =
    room.reportCount > 0 ? room.openReportCount / room.reportCount : 0

  return (
    <Card
      className={cn(
        "group relative gap-0 overflow-hidden p-0 transition-all duration-200",
        "focus-within:ring-2 focus-within:ring-ring/40 hover:-translate-y-0.5 hover:shadow-lg",
        isArchived && "opacity-75 hover:opacity-100"
      )}
    >
      {/* Color accent keeps rooms distinguishable at a glance in a dense grid. */}
      <span aria-hidden className={cn("block h-1 w-full", colorClasses.dot)} />

      <Link
        aria-label={`Open room ${room.name}`}
        className="absolute inset-0 z-10 rounded-xl outline-none"
        href={`/rooms/${room.id}`}
      />

      <CardContent className="flex flex-col gap-4 p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="flex min-w-0 items-center gap-3">
            <span
              className={cn(
                "flex size-10 shrink-0 items-center justify-center rounded-xl ring-1 transition-transform duration-200 group-hover:scale-105",
                colorClasses.surface
              )}
            >
              <LayoutGrid className="size-5" />
            </span>
            <div className="min-w-0">
              <h3
                className="flex items-center gap-1 truncate font-semibold text-sm"
                title={room.name}
              >
                <span className="truncate">{room.name}</span>
                <ArrowUpRight className="size-3.5 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
              </h3>
              <p className="truncate font-mono text-[11px] text-muted-foreground">
                /{room.slug}
              </p>
            </div>
          </div>

          <div className="relative z-20 flex shrink-0 items-center gap-1">
            {isArchived ? (
              <span className="hidden rounded-md border border-amber-500/30 bg-amber-500/10 px-1.5 py-0.5 font-medium text-[10px] text-amber-700 sm:inline dark:text-amber-400">
                Archived
              </span>
            ) : null}
            <DropdownMenu>
              <DropdownMenuTrigger
                onClick={(event) => {
                  event.preventDefault()
                  event.stopPropagation()
                }}
                render={
                  <Button
                    aria-label={`Actions for ${room.name}`}
                    className="size-8 opacity-100 md:opacity-0 md:aria-expanded:opacity-100 md:group-hover:opacity-100 md:group-focus-within:opacity-100"
                    disabled={isMutating}
                    size="icon-sm"
                    variant="ghost"
                  />
                }
              >
                <MoreVertical className="size-4" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem onClick={onEdit}>
                  <Edit3 className="size-4" />
                  Edit room
                </DropdownMenuItem>
                <DropdownMenuItem onClick={onToggleArchive}>
                  {isArchived ? (
                    <>
                      <ArchiveRestore className="size-4" />
                      Restore room
                    </>
                  ) : (
                    <>
                      <ArchiveX className="size-4" />
                      Archive room
                    </>
                  )}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={onRequestDelete}
                  variant="destructive"
                >
                  <Trash2 className="size-4" />
                  Delete room
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        <p className="line-clamp-2 min-h-[2.5rem] text-muted-foreground text-xs leading-relaxed">
          {room.description || "No description yet"}
        </p>

        <div className="space-y-2">
          <div className="flex items-baseline justify-between gap-2">
            <span className="font-semibold text-2xl tabular-nums leading-none">
              {room.reportCount}
              <span className="ml-1 font-normal text-muted-foreground text-xs">
                report{room.reportCount === 1 ? "" : "s"}
              </span>
            </span>
            <span className="text-[11px] text-muted-foreground tabular-nums">
              {room.openReportCount} open · {resolvedCount} done
            </span>
          </div>

          {/* Open-vs-handled ratio: one glance tells you which room needs work. */}
          <div
            aria-hidden
            className="h-1.5 w-full overflow-hidden rounded-full bg-muted"
          >
            <div
              className={cn(
                "h-full rounded-full transition-all",
                colorClasses.dot
              )}
              style={{ width: `${Math.round(openRatio * 100)}%` }}
            />
          </div>
        </div>

        <div className="flex items-center gap-1.5 border-t pt-3 text-[11px] text-muted-foreground">
          <Clock className="size-3 shrink-0" />
          <span className="truncate">
            {lastCaptureLabel
              ? `Last capture ${lastCaptureLabel}`
              : "No captures yet"}
          </span>
        </div>
      </CardContent>
    </Card>
  )
}
