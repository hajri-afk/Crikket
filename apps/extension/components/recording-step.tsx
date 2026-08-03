import { Button } from "@crikket/ui/components/ui/button"
import { cn } from "@crikket/ui/lib/utils"
import { ShortcutKbd } from "@/components/shortcut-kbd"
import { formatDuration } from "../lib/utils"

interface RecordingStepProps {
  duration: number
  isPaused: boolean
  onStopRecording: () => void
  onTogglePause: () => void
  stopRecordingShortcut: string | null
  pauseRecordingShortcut: string | null
}

export function RecordingStep({
  duration,
  isPaused,
  onStopRecording,
  onTogglePause,
  stopRecordingShortcut,
  pauseRecordingShortcut,
}: RecordingStepProps) {
  return (
    <div className="flex flex-col items-center justify-center space-y-6 py-12">
      <div
        className={cn(
          "w-full max-w-sm rounded-md border p-4 text-center",
          isPaused
            ? "border-amber-500/30 bg-amber-500/10"
            : "border-destructive/20 bg-destructive/5"
        )}
      >
        <p
          className={cn(
            "font-medium text-sm",
            isPaused ? "text-amber-700" : "text-destructive"
          )}
        >
          {isPaused ? "Paused" : "Recording now"}
        </p>
        <p
          className={cn(
            "font-mono font-semibold text-5xl",
            isPaused ? "text-amber-700" : "text-destructive"
          )}
        >
          {formatDuration(duration)}
        </p>
      </div>

      <div className="flex flex-wrap items-center justify-center gap-3">
        <Button
          className="flex min-w-[170px] items-center gap-3 font-semibold text-lg"
          onClick={onTogglePause}
          size="lg"
          variant="outline"
        >
          <span>{isPaused ? "▶ Resume" : "⏸ Pause"}</span>
          <ShortcutKbd shortcut={pauseRecordingShortcut} />
        </Button>

        <Button
          className="flex min-w-[200px] items-center gap-3 font-semibold text-lg"
          onClick={onStopRecording}
          size="lg"
          variant="destructive"
        >
          <span>⏹ Stop Recording</span>
          <ShortcutKbd
            className="bg-destructive-foreground/15 text-destructive-foreground"
            shortcut={stopRecordingShortcut}
          />
        </Button>
      </div>

      <p className="max-w-md text-center text-muted-foreground text-sm">
        {isPaused
          ? "Recording is paused. Nothing is captured into the video until you resume."
          : "Pause anytime to skip setup steps, then click \"Stop Recording\" when you're done. You'll be able to add details and submit your bug report next."}
      </p>
    </div>
  )
}
