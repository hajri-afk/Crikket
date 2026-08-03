import { Button } from "@crikket/ui/components/ui/button"
import { cn } from "@crikket/ui/lib/utils"
import {
  AppWindow,
  Camera,
  Monitor,
  Pause,
  Play,
  RotateCcw,
  Video,
} from "lucide-react"
import { ShortcutKbd } from "@/components/shortcut-kbd"
import type { PopupCaptureType } from "@/hooks/use-popup-capture"
import type { CaptureScope } from "@/lib/display-media"
import { formatDuration } from "@/lib/utils"

interface PopupCaptureActionsProps {
  isBusy: boolean
  isRecordingInProgress: boolean
  isRecordingPaused: boolean
  recordingCountdown: number | null
  recordingDurationMs: number
  pendingCaptureType: PopupCaptureType | null
  startRecordingShortcut: string | null
  startScreenshotShortcut: string | null
  stopRecordingShortcut: string | null
  pauseRecordingShortcut: string | null
  captureScope: CaptureScope
  onSelectCaptureScope: (scope: CaptureScope) => void
  onRequestCapture: (captureType: PopupCaptureType) => void
  onStopFromPopup: () => Promise<void>
  onTogglePauseFromPopup: () => Promise<void>
  onStartCapture: (captureType: PopupCaptureType) => Promise<void>
  onClearPendingCapture: () => void
  onResetRecordingState: () => Promise<void>
}

interface CaptureScopeOptionProps {
  description: string
  icon: React.ReactNode
  isDisabled: boolean
  isSelected: boolean
  label: string
  onSelect: () => void
}

function CaptureScopeOption({
  description,
  icon,
  isDisabled,
  isSelected,
  label,
  onSelect,
}: CaptureScopeOptionProps) {
  return (
    <button
      aria-pressed={isSelected}
      className={cn(
        "flex flex-col items-start gap-0.5 rounded-md border p-2 text-left transition-colors",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        isDisabled && "cursor-not-allowed opacity-60",
        isSelected
          ? "border-primary bg-primary/5"
          : "border-border hover:bg-muted/50"
      )}
      disabled={isDisabled}
      onClick={onSelect}
      type="button"
    >
      <span className="flex items-center gap-1.5 font-medium text-xs">
        {icon}
        {label}
      </span>
      <span className="text-[11px] text-muted-foreground leading-tight">
        {description}
      </span>
    </button>
  )
}

export function PopupCaptureActions({
  isBusy,
  isRecordingInProgress,
  isRecordingPaused,
  recordingCountdown,
  recordingDurationMs,
  pendingCaptureType,
  startRecordingShortcut,
  startScreenshotShortcut,
  stopRecordingShortcut,
  pauseRecordingShortcut,
  captureScope,
  onSelectCaptureScope,
  onRequestCapture,
  onStopFromPopup,
  onTogglePauseFromPopup,
  onStartCapture,
  onClearPendingCapture,
  onResetRecordingState,
}: PopupCaptureActionsProps) {
  if (recordingCountdown) {
    return (
      <div className="rounded-md border bg-primary/5 p-3 text-center">
        <p className="font-medium text-sm">Recording starts in</p>
        <p className="font-bold text-2xl">{recordingCountdown}...</p>
      </div>
    )
  }

  return (
    <>
      {isRecordingInProgress ? (
        <div className="space-y-2">
          <div
            className={
              isRecordingPaused
                ? "rounded-md border border-amber-500/30 bg-amber-500/10 p-3 text-center"
                : "rounded-md border bg-destructive/5 p-3 text-center"
            }
          >
            <p
              className={
                isRecordingPaused
                  ? "font-medium text-amber-700 text-sm"
                  : "font-medium text-destructive text-sm"
              }
            >
              {isRecordingPaused ? "Paused" : "Recording now"}
            </p>
            <p
              className={
                isRecordingPaused
                  ? "font-mono font-semibold text-amber-700 text-xl"
                  : "font-mono font-semibold text-destructive text-xl"
              }
            >
              {formatDuration(recordingDurationMs)}
            </p>
          </div>
          <Button
            className="w-full justify-start gap-3"
            disabled={isBusy}
            onClick={() => onTogglePauseFromPopup()}
            size="lg"
            variant="outline"
          >
            {isRecordingPaused ? (
              <Play className="h-5 w-5" />
            ) : (
              <Pause className="h-5 w-5" />
            )}
            <span>
              {isRecordingPaused ? "Resume Recording" : "Pause Recording"}
            </span>
            <ShortcutKbd
              className="bg-muted text-foreground"
              shortcut={pauseRecordingShortcut}
            />
          </Button>
          <Button
            className="w-full justify-start gap-3"
            disabled={isBusy}
            onClick={() => onStopFromPopup()}
            size="lg"
            variant="destructive"
          >
            <Video className="h-5 w-5" />
            <span>Stop Recording</span>
            <ShortcutKbd
              className="bg-destructive-foreground/15 text-destructive-foreground"
              shortcut={stopRecordingShortcut}
            />
          </Button>
          {/* The recorder tab owns the stop action, so it can go away (closed
              tab, extension reload) and leave this state unstoppable. */}
          <Button
            className="w-full text-muted-foreground text-xs"
            disabled={isBusy}
            onClick={() => onResetRecordingState()}
            size="sm"
            variant="ghost"
          >
            <RotateCcw className="size-3.5" />
            Recording stuck? Reset state
          </Button>
        </div>
      ) : (
        <div className="space-y-2">
          <div className="space-y-1.5">
            <p className="font-medium text-xs">What should we record?</p>
            <div className="grid grid-cols-2 gap-2">
              <CaptureScopeOption
                description="Only the site you are testing"
                icon={<AppWindow className="size-4" />}
                isDisabled={isBusy}
                isSelected={captureScope === "tab"}
                label="This tab"
                onSelect={() => onSelectCaptureScope("tab")}
              />
              <CaptureScopeOption
                description="Any screen, window, or app"
                icon={<Monitor className="size-4" />}
                isDisabled={isBusy}
                isSelected={captureScope === "screen"}
                label="Full screen"
                onSelect={() => onSelectCaptureScope("screen")}
              />
            </div>
            {captureScope === "screen" ? (
              <p className="text-muted-foreground text-xs">
                Chrome asks which screen or window, then recording starts right
                away. Screenshots always capture this tab only.
              </p>
            ) : null}
          </div>

          <Button
            className="w-full justify-start gap-3"
            disabled={isBusy}
            onClick={() => onRequestCapture("video")}
            size="lg"
            variant="default"
          >
            <Video className="h-5 w-5" />
            <span>Record Screen</span>
            <ShortcutKbd
              className="bg-primary-foreground/15 text-primary-foreground"
              shortcut={startRecordingShortcut}
            />
          </Button>

          <Button
            className="w-full justify-start gap-3"
            disabled={isBusy}
            onClick={() => onRequestCapture("screenshot")}
            size="lg"
            variant="outline"
          >
            <Camera className="h-5 w-5" />
            <span>Take Screenshot</span>
            <ShortcutKbd
              className="bg-muted text-foreground"
              shortcut={startScreenshotShortcut}
            />
          </Button>
        </div>
      )}

      {pendingCaptureType ? (
        <div className="space-y-2 rounded-md border border-primary/20 bg-primary/5 p-3">
          <p className="text-sm">
            Allow Crikket to capture your current tab for{" "}
            {pendingCaptureType === "video" ? "recording" : "screenshot"}?
          </p>
          <div className="flex gap-2">
            <Button
              className="flex-1"
              disabled={isBusy}
              onClick={() => onStartCapture(pendingCaptureType)}
              size="sm"
            >
              Continue
            </Button>
            <Button
              className="flex-1"
              disabled={isBusy}
              onClick={onClearPendingCapture}
              size="sm"
              variant="outline"
            >
              Cancel
            </Button>
          </div>
        </div>
      ) : null}
    </>
  )
}
