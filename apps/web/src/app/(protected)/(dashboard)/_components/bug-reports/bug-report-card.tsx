"use client"

import {
  BUG_REPORT_DEBUGGER_INGESTION_STATUS_OPTIONS,
  BUG_REPORT_SUBMISSION_STATUS_OPTIONS,
  type BugReportStatus,
  type BugReportVisibility,
} from "@crikket/shared/constants/bug-report"
import type { Priority } from "@crikket/shared/constants/priorities"
import { reportNonFatalError } from "@crikket/shared/lib/errors"
import { Badge } from "@crikket/ui/components/ui/badge"
import { Button } from "@crikket/ui/components/ui/button"
import { Card, CardContent } from "@crikket/ui/components/ui/card"
import { Checkbox } from "@crikket/ui/components/ui/checkbox"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@crikket/ui/components/ui/dropdown-menu"
import { cn } from "@crikket/ui/lib/utils"
import {
  Clapperboard,
  Clock,
  Copy,
  Edit3,
  ExternalLink,
  Globe,
  ImageIcon,
  Lock,
  MoreVertical,
  Play,
  RotateCcw,
  Tag,
  Trash2,
} from "lucide-react"
import Image from "next/image"
import Link from "next/link"
import {
  type ReactNode,
  type SyntheticEvent,
  useCallback,
  useRef,
  useState,
} from "react"
import { toast } from "sonner"
import { EditBugReportSheet } from "@/components/bug-reports/edit-bug-report-sheet"
import { TestCaseTypeBadge } from "@/components/bug-reports/test-case-type-badge"
import { TestedFeatureBadge } from "@/components/bug-reports/tested-feature-badge"
import { RoomBadge } from "@/components/rooms/room-badge"
import { useRooms } from "@/components/rooms/use-rooms"

import {
  formatPriorityLabel,
  formatStatusLabel,
  VISIBILITY_OPTIONS,
} from "./filters"
import type { BugReportListItem } from "./types"

const STATUS_DOT: Record<BugReportStatus, string> = {
  open: "bg-blue-500",
  in_progress: "bg-amber-500",
  resolved: "bg-emerald-500",
  closed: "bg-muted-foreground",
}

const PRIORITY_DOT: Record<Priority, string> = {
  critical: "bg-red-500",
  high: "bg-orange-500",
  medium: "bg-amber-500",
  low: "bg-sky-500",
  none: "bg-muted-foreground",
}

interface BugReportCardProps {
  report: BugReportListItem
  isChecked: boolean
  isMutating: boolean
  onToggleSelection: (checked: boolean) => void
  onRequestDelete: () => void
  onRetryDebuggerIngestion: () => void
  onReportUpdated: () => Promise<void>
  onUpdateReport: (input: {
    visibility?: BugReportVisibility
    roomId?: string | null
  }) => void
}

/** Radio value used by the room menu for "no room". */
const NO_ROOM_VALUE = "__none__"

interface RoomMenuOption {
  color: string
  id: string
  name: string
}

/**
 * An archived room disappears from the picker but stays selectable while it
 * still holds this report, so the menu never shows a blank current value.
 */
function buildRoomMenuOptions(input: {
  currentRoom: BugReportListItem["room"]
  rooms: RoomMenuOption[]
}): RoomMenuOption[] {
  const { currentRoom, rooms } = input
  if (!currentRoom) {
    return rooms
  }

  return [
    ...rooms.filter((room) => room.id !== currentRoom.id),
    {
      color: currentRoom.color,
      id: currentRoom.id,
      name: currentRoom.name,
    },
  ].sort((left, right) => left.name.localeCompare(right.name))
}

/** Feature/menu tested leads; the positive/negative marker stays secondary. */
function QaScopeBadges({ report }: { report: BugReportListItem }) {
  return (
    <>
      {report.testedFeature ? (
        <TestedFeatureBadge value={report.testedFeature} />
      ) : null}
      {report.testCaseType ? (
        <TestCaseTypeBadge compact value={report.testCaseType} />
      ) : null}
    </>
  )
}

export function BugReportCard({
  report,
  isChecked,
  isMutating,
  onToggleSelection,
  onRequestDelete,
  onRetryDebuggerIngestion,
  onReportUpdated,
  onUpdateReport,
}: BugReportCardProps) {
  const isPrivate = report.visibility === "private"
  const isReady =
    report.submissionStatus === BUG_REPORT_SUBMISSION_STATUS_OPTIONS.ready
  const isRetryable =
    report.debuggerIngestionStatus ===
      BUG_REPORT_DEBUGGER_INGESTION_STATUS_OPTIONS.failed &&
    report.submissionStatus === BUG_REPORT_SUBMISSION_STATUS_OPTIONS.failed
  const [isEditSheetOpen, setIsEditSheetOpen] = useState(false)
  const { visibleRooms } = useRooms()
  const roomMenuValue = report.room?.id ?? NO_ROOM_VALUE
  const roomMenuOptions = buildRoomMenuOptions({
    currentRoom: report.room,
    rooms: visibleRooms,
  })

  const handleCopyLink = async () => {
    if (!isReady) {
      toast.error("Share link is unavailable until the report is ready")
      return
    }

    const shareUrl = `${window.location.origin}/s/${report.id}`
    try {
      await navigator.clipboard.writeText(shareUrl)
      toast.success("Share link copied")
    } catch (error) {
      reportNonFatalError("Failed to copy bug report share link", error)
      toast.error("Failed to copy link")
    }
  }

  return (
    <Card className="group relative overflow-hidden p-0 transition-all hover:-translate-y-0.5 hover:shadow-lg hover:ring-primary/30">
      <Link
        aria-label={`Open ${report.title}`}
        className="absolute inset-0 z-10"
        href={`/s/${report.id}`}
      />
      <CardContent className="p-0">
        <div className="relative aspect-video overflow-hidden bg-muted">
          <div className="absolute top-2 left-2 z-20">
            <Checkbox
              aria-label={`Select ${report.title}`}
              checked={isChecked}
              onCheckedChange={(checked) => onToggleSelection(checked === true)}
              onClick={(event) => {
                event.preventDefault()
                event.stopPropagation()
              }}
            />
          </div>

          <div className="absolute top-2 right-2 z-20">
            <DropdownMenu>
              <DropdownMenuTrigger
                onClick={(event) => {
                  event.preventDefault()
                  event.stopPropagation()
                }}
                render={
                  <Button
                    aria-label="Report actions"
                    className="h-8 w-8 bg-background/90 backdrop-blur-sm"
                    disabled={isMutating}
                    size="icon-sm"
                    variant="outline"
                  />
                }
              >
                <MoreVertical className="h-4 w-4" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-52">
                <DropdownMenuItem onClick={handleCopyLink}>
                  <Copy className="size-4" />
                  Copy link
                </DropdownMenuItem>
                <DropdownMenuItem
                  disabled={!isReady}
                  onClick={() =>
                    window.open(`/s/${report.id}`, "_blank", "noopener")
                  }
                >
                  <ExternalLink className="size-4" />
                  Open in new tab
                </DropdownMenuItem>
                {isRetryable ? (
                  <DropdownMenuItem onClick={onRetryDebuggerIngestion}>
                    <RotateCcw className="size-4" />
                    Retry debugger ingest
                  </DropdownMenuItem>
                ) : null}
                <DropdownMenuSeparator />
                <DropdownMenuGroup>
                  <DropdownMenuLabel>Room</DropdownMenuLabel>
                  <DropdownMenuRadioGroup
                    onValueChange={(value) => {
                      const nextRoomId =
                        value === NO_ROOM_VALUE ? null : (value ?? null)
                      if (nextRoomId !== (report.room?.id ?? null)) {
                        onUpdateReport({ roomId: nextRoomId })
                      }
                    }}
                    value={roomMenuValue}
                  >
                    <DropdownMenuRadioItem value={NO_ROOM_VALUE}>
                      No room
                    </DropdownMenuRadioItem>
                    {roomMenuOptions.map((room) => (
                      <DropdownMenuRadioItem key={room.id} value={room.id}>
                        {room.name}
                      </DropdownMenuRadioItem>
                    ))}
                  </DropdownMenuRadioGroup>
                </DropdownMenuGroup>
                <DropdownMenuSeparator />
                <DropdownMenuGroup>
                  <DropdownMenuLabel>Privacy</DropdownMenuLabel>
                  <DropdownMenuRadioGroup
                    onValueChange={(value) => {
                      if (value !== report.visibility) {
                        onUpdateReport({
                          visibility: value as BugReportVisibility,
                        })
                      }
                    }}
                    value={report.visibility}
                  >
                    {VISIBILITY_OPTIONS.map((visibilityOption) => (
                      <DropdownMenuRadioItem
                        key={visibilityOption.value}
                        value={visibilityOption.value}
                      >
                        {visibilityOption.label}
                      </DropdownMenuRadioItem>
                    ))}
                  </DropdownMenuRadioGroup>
                </DropdownMenuGroup>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => setIsEditSheetOpen(true)}>
                  <Edit3 className="size-4" />
                  Edit report
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={onRequestDelete}
                  variant="destructive"
                >
                  <Trash2 className="size-4" />
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          <MediaPreview report={report} />

          <div className="pointer-events-none absolute bottom-2 left-2 z-20">
            <MediaTypeBadge attachmentType={report.attachmentType} />
          </div>

          {report.attachmentType === "video" ? (
            <div className="pointer-events-none absolute right-2 bottom-2 flex items-center gap-1 rounded bg-black/70 px-2 py-1 text-white text-xs">
              <Clock className="h-3 w-3" />
              {report.duration}
            </div>
          ) : null}
        </div>

        <div className="space-y-2 p-3">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 space-y-1">
              <h3
                className="line-clamp-1 font-semibold text-sm leading-tight"
                title={report.title}
              >
                {report.title}
              </h3>
              <p className="text-muted-foreground text-xs">
                {new Date(report.createdAt).toLocaleString()}
              </p>
            </div>
            <span
              className={cn(
                "inline-flex shrink-0 items-center gap-1 rounded-md border px-2 py-1 font-medium text-[11px]",
                isPrivate
                  ? "bg-muted text-muted-foreground"
                  : "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
              )}
            >
              {isPrivate ? (
                <Lock className="size-3" />
              ) : (
                <Globe className="size-3" />
              )}
              {isPrivate ? "Private" : "Public"}
            </span>
          </div>

          <p className="line-clamp-2 min-h-8 text-muted-foreground text-xs">
            {report.description || report.url || "No additional context"}
          </p>

          <div className="flex flex-wrap items-center gap-1.5">
            {report.room ? (
              <RoomBadge color={report.room.color} name={report.room.name} />
            ) : null}
            <QaScopeBadges report={report} />
            <Chip>
              <span
                className={cn(
                  "size-1.5 rounded-full",
                  STATUS_DOT[report.status]
                )}
              />
              {formatStatusLabel(report.status)}
            </Chip>
            <Chip>
              <span
                className={cn(
                  "size-1.5 rounded-full",
                  PRIORITY_DOT[report.priority]
                )}
              />
              {formatPriorityLabel(report.priority)}
            </Chip>
            {report.submissionStatus !==
            BUG_REPORT_SUBMISSION_STATUS_OPTIONS.ready ? (
              <Chip tone="warning">
                {formatSubmissionStatusLabel(report.submissionStatus)}
              </Chip>
            ) : null}
            {report.debuggerIngestionStatus ===
            BUG_REPORT_DEBUGGER_INGESTION_STATUS_OPTIONS.failed ? (
              <Chip tone="warning">Debugger ingest failed</Chip>
            ) : null}
            {report.tags.slice(0, 2).map((tag) => (
              <Chip key={tag}>
                <Tag className="size-3" />
                {tag}
              </Chip>
            ))}
            {report.tags.length > 2 ? (
              <Chip>+{report.tags.length - 2}</Chip>
            ) : null}
          </div>

          {report.debuggerIngestionError ? (
            <p className="line-clamp-2 text-amber-700 text-xs">
              {report.debuggerIngestionError}
            </p>
          ) : null}
        </div>
      </CardContent>
      <EditBugReportSheet
        onOpenChange={setIsEditSheetOpen}
        onUpdated={onReportUpdated}
        open={isEditSheetOpen}
        report={{
          id: report.id,
          title: report.title,
          tags: report.tags,
          status: report.status,
          priority: report.priority,
          visibility: report.visibility,
          roomId: report.room?.id ?? null,
          roomName: report.room?.name ?? null,
          roomColor: report.room?.color ?? null,
          testedFeature: report.testedFeature ?? null,
          testScenario: report.testScenario ?? null,
          testCaseType: report.testCaseType ?? null,
        }}
      />
    </Card>
  )
}

function formatSubmissionStatusLabel(
  status: BugReportCardProps["report"]["submissionStatus"]
) {
  switch (status) {
    case BUG_REPORT_SUBMISSION_STATUS_OPTIONS.processing:
      return "Processing"
    case BUG_REPORT_SUBMISSION_STATUS_OPTIONS.failed:
      return "Submission failed"
    default:
      return "Ready"
  }
}

function MediaTypeBadge({
  attachmentType,
}: {
  attachmentType: BugReportListItem["attachmentType"]
}) {
  if (attachmentType === "video") {
    return (
      <Badge className="border-white/15 bg-black/75 text-white backdrop-blur-sm hover:bg-black/75">
        <Clapperboard className="size-3" />
        Video
      </Badge>
    )
  }

  if (attachmentType === "screenshot") {
    return (
      <Badge className="border-white/15 bg-black/75 text-white backdrop-blur-sm hover:bg-black/75">
        <ImageIcon className="size-3" />
        Screenshot
      </Badge>
    )
  }

  return null
}

function MediaPreview({ report }: { report: BugReportListItem }) {
  if (report.thumbnail) {
    return (
      <Image
        alt={report.title}
        className="object-cover transition-transform group-hover:scale-105"
        fill
        sizes="(max-width: 640px) 100vw, (max-width: 1200px) 50vw, 20vw"
        src={report.thumbnail}
      />
    )
  }

  if (report.attachmentType === "video" && report.attachmentUrl) {
    return <VideoThumbnail report={report} />
  }

  if (report.attachmentType === "screenshot" && report.attachmentUrl) {
    return (
      <Image
        alt={report.title}
        className="object-cover transition-transform group-hover:scale-105"
        fill
        sizes="(max-width: 640px) 100vw, (max-width: 1200px) 50vw, 20vw"
        src={report.attachmentUrl}
      />
    )
  }

  return (
    <div className="flex h-full w-full items-center justify-center">
      <Play className="h-12 w-12 text-muted-foreground" />
    </div>
  )
}

function VideoThumbnail({ report }: { report: BugReportListItem }) {
  const hasSeekedRef = useRef(false)

  const handleLoadedMetadata = useCallback(
    (event: SyntheticEvent<HTMLVideoElement>) => {
      if (hasSeekedRef.current) {
        return
      }

      const player = event.currentTarget
      const durationSeconds =
        Number.isFinite(player.duration) && player.duration > 0
          ? player.duration
          : 0
      const targetSeconds =
        durationSeconds > 0
          ? Math.min(Math.max(durationSeconds * 0.2, 0.15), durationSeconds / 2)
          : 0

      hasSeekedRef.current = true

      if (targetSeconds <= 0) {
        return
      }

      const handleSeeked = () => {
        player.pause()
      }

      player.addEventListener("seeked", handleSeeked, { once: true })

      try {
        player.currentTime = targetSeconds
      } catch {
        hasSeekedRef.current = false
      }
    },
    []
  )

  return (
    <>
      <video
        aria-hidden="true"
        className="h-full w-full object-cover transition-transform group-hover:scale-105"
        muted
        onLoadedMetadata={handleLoadedMetadata}
        playsInline
        preload="metadata"
        src={report.attachmentUrl}
        tabIndex={-1}
      />
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/35 via-transparent to-black/10" />
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
        <div className="rounded-full border border-white/20 bg-black/60 p-3 text-white shadow-sm backdrop-blur-sm">
          <Play className="size-5 fill-current" />
        </div>
      </div>
    </>
  )
}

function Chip({
  children,
  tone = "default",
}: {
  children: ReactNode
  tone?: "default" | "warning"
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[11px]",
        tone === "warning"
          ? "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-400"
          : "bg-background"
      )}
    >
      {children}
    </span>
  )
}
