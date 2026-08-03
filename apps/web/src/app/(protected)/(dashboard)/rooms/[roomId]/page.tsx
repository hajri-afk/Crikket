import { ROOM_STATUS_OPTIONS } from "@crikket/shared/constants/room"
import { Button } from "@crikket/ui/components/ui/button"
import { cn } from "@crikket/ui/lib/utils"
import { ArrowLeft, LayoutGrid } from "lucide-react"
import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"

import { getRoomColorClasses } from "@/lib/rooms"
import { client } from "@/utils/orpc"
import { BugReportsList } from "../../_components/bug-reports/bug-reports-list"

interface RoomDetailPageProps {
  params: Promise<{ roomId: string }>
}

async function loadRoom(roomId: string) {
  return await client.room.get({ roomId }).catch(() => null)
}

export async function generateMetadata({
  params,
}: RoomDetailPageProps): Promise<Metadata> {
  const { roomId } = await params
  const room = await loadRoom(roomId)

  return {
    title: room ? `${room.name} - Rooms` : "Room",
    description: room?.description ?? "Bug reports captured in this room",
  }
}

export default async function RoomDetailPage({ params }: RoomDetailPageProps) {
  const { roomId } = await params
  const room = await loadRoom(roomId)

  if (!room) {
    notFound()
  }

  const colorClasses = getRoomColorClasses(room.color)
  const isArchived = room.status === ROOM_STATUS_OPTIONS.archived

  return (
    <div className="flex flex-1 flex-col gap-6 pt-2">
      <div className="space-y-4">
        <Button
          className="w-fit px-0 text-muted-foreground"
          nativeButton={false}
          render={
            <Link href="/rooms">
              <ArrowLeft className="size-4" />
              All rooms
            </Link>
          }
          size="sm"
          variant="link"
        />

        <div className="flex flex-col gap-4 rounded-xl border bg-card p-4 shadow-xs sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-center gap-3">
            <div
              className={cn(
                "flex size-10 shrink-0 items-center justify-center rounded-xl ring-1 sm:size-12",
                colorClasses.surface
              )}
            >
              <LayoutGrid className="size-5 sm:size-6" />
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="truncate font-bold text-xl tracking-tight sm:text-2xl">
                  {room.name}
                </h1>
                {isArchived ? (
                  <span className="rounded-md border border-amber-500/30 bg-amber-500/10 px-1.5 py-0.5 font-medium text-[11px] text-amber-700 dark:text-amber-400">
                    Archived
                  </span>
                ) : null}
              </div>
              <p className="mt-0.5 line-clamp-2 text-muted-foreground text-xs sm:text-sm">
                {room.description || `Reports captured in /${room.slug}`}
              </p>
            </div>
          </div>

          <div className="flex shrink-0 gap-2">
            <RoomStat label="Reports" value={room.reportCount} />
            <RoomStat
              label="Open"
              tone="warning"
              value={room.openReportCount}
            />
          </div>
        </div>

        {isArchived ? (
          <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-amber-800 text-xs sm:text-sm dark:text-amber-400">
            This room is archived. Existing reports stay here, but new
            recordings can no longer be sent to it.
          </div>
        ) : null}
      </div>

      <BugReportsList roomId={room.id} />
    </div>
  )
}

function RoomStat({
  label,
  value,
  tone = "default",
}: {
  label: string
  value: number
  tone?: "default" | "warning"
}) {
  return (
    <div className="flex-1 rounded-lg border bg-background px-3 py-2 text-center sm:min-w-20 sm:flex-none">
      <p
        className={cn(
          "font-semibold text-lg tabular-nums leading-tight",
          tone === "warning" && "text-amber-600 dark:text-amber-400"
        )}
      >
        {value}
      </p>
      <p className="text-[11px] text-muted-foreground">{label}</p>
    </div>
  )
}
