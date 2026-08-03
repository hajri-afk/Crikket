import { Button } from "@crikket/ui/components/ui/button"
import { MonitorUp } from "lucide-react"
import type { CaptureScope } from "@/lib/display-media"

interface IdleStepProps {
  captureScope: CaptureScope
  onStartFullScreen: () => void
}

/**
 * Tab captures start on their own, so this is only a placeholder for them.
 * Screen captures land here because getDisplayMedia is refused unless it comes
 * from a real user gesture, which the button below provides.
 */
export function IdleStep({ captureScope, onStartFullScreen }: IdleStepProps) {
  if (captureScope !== "screen") {
    return (
      <p className="text-center text-muted-foreground">
        No active capture. Start from the extension popup.
      </p>
    )
  }

  return (
    <div className="flex flex-col items-center justify-center space-y-6 py-12">
      <div className="max-w-md space-y-2 text-center">
        <p className="font-medium text-lg">Ready to record your screen</p>
        <p className="text-muted-foreground text-sm">
          Chrome will ask which screen, window, or tab to share. Recording
          starts as soon as you pick one.
        </p>
      </div>

      <Button
        className="flex min-w-[240px] items-center gap-3 font-semibold text-lg"
        onClick={onStartFullScreen}
        size="lg"
      >
        <MonitorUp className="size-5" />
        <span>Choose screen &amp; start</span>
      </Button>

      <p className="max-w-md text-center text-muted-foreground text-xs">
        Console and network logs are still collected from the tab you started
        from, even when you record another window.
      </p>
    </div>
  )
}
