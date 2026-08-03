import { reportNonFatalError } from "@crikket/shared/lib/errors"
import { Button } from "@crikket/ui/components/ui/button"
import { Keyboard } from "lucide-react"
import { PopupCaptureActions } from "@/components/popup-capture-actions"
import { RoomDot, RoomPicker } from "@/components/room-picker"
import { useCommandShortcuts } from "@/hooks/use-command-shortcuts"
import { useHotkeyTrigger } from "@/hooks/use-hotkey-trigger"
import { usePopupCapture } from "@/hooks/use-popup-capture"
import { usePopupRecordingStatus } from "@/hooks/use-popup-recording-status"
import { useRooms } from "@/hooks/use-rooms"
import {
  HOTKEY_START_SCREENSHOT_CAPTURE_STORAGE_KEY,
  HOTKEY_START_VIDEO_CAPTURE_STORAGE_KEY,
} from "@/lib/capture-context"

function App() {
  const shortcuts = useCommandShortcuts()
  const {
    captureError,
    captureScope,
    clearPendingCapture,
    isCapturing,
    pendingCaptureType,
    recordingCountdown: localRecordingCountdown,
    requestCapture,
    selectCaptureScope,
    startCapture,
  } = usePopupCapture()
  const {
    isRecordingInProgress,
    isRecordingPaused,
    recordingCountdown: syncedRecordingCountdown,
    recordingDurationMs,
    isStoppingFromPopup,
    stopError,
    stopFromPopup,
    togglePauseFromPopup,
    resetRecordingState,
  } = usePopupRecordingStatus()

  const roomsState = useRooms()

  const recordingCountdown =
    localRecordingCountdown ?? syncedRecordingCountdown ?? null
  const error = stopError ?? captureError
  const isBusy = isCapturing || isStoppingFromPopup
  const selectedRoom = roomsState.rooms.find(
    (room) => room.id === roomsState.selectedRoomId
  )

  useHotkeyTrigger({
    storageKey: HOTKEY_START_VIDEO_CAPTURE_STORAGE_KEY,
    enabled: !isRecordingInProgress,
    errorMessage: "Failed to start capture from hotkey popup flow",
    onTrigger: async () => {
      await startCapture("video")
    },
  })
  useHotkeyTrigger({
    storageKey: HOTKEY_START_SCREENSHOT_CAPTURE_STORAGE_KEY,
    enabled: !isRecordingInProgress,
    errorMessage: "Failed to start screenshot capture from hotkey popup flow",
    onTrigger: async () => {
      await startCapture("screenshot")
    },
  })

  return (
    <div className="w-[380px] space-y-4 p-4">
      <div className="space-y-1">
        <h1 className="font-medium font-mono text-xl leading-tight">crikket</h1>
        <p className="text-muted-foreground text-sm">
          Capture and report bugs with screenshots or recordings
        </p>
      </div>
      <div className="space-y-4">
        {error ? (
          <div className="rounded-md border border-destructive bg-destructive/10 p-3">
            <p className="text-destructive text-sm">{error}</p>
          </div>
        ) : null}

        {isRecordingInProgress ? (
          <div className="flex items-center gap-2 rounded-md border bg-muted/40 px-3 py-2 text-xs">
            <RoomDot color={selectedRoom?.color} />
            <span className="min-w-0 truncate text-muted-foreground">
              Saving to{" "}
              <span className="font-medium text-foreground">
                {selectedRoom?.name ?? "No room"}
              </span>
            </span>
          </div>
        ) : (
          <RoomPicker
            closeWindowAfterDashboard
            error={roomsState.error}
            helperText="Pick the project before recording — the report is filed there automatically."
            isDisabled={isBusy}
            isLoading={roomsState.isLoading}
            onSelect={roomsState.selectRoom}
            rooms={roomsState.rooms}
            selectedRoomId={roomsState.selectedRoomId}
          />
        )}

        <PopupCaptureActions
          captureScope={captureScope}
          isBusy={isBusy}
          isRecordingInProgress={isRecordingInProgress}
          isRecordingPaused={isRecordingPaused}
          onClearPendingCapture={clearPendingCapture}
          onRequestCapture={requestCapture}
          onResetRecordingState={resetRecordingState}
          onSelectCaptureScope={selectCaptureScope}
          onStartCapture={startCapture}
          onStopFromPopup={stopFromPopup}
          onTogglePauseFromPopup={togglePauseFromPopup}
          pauseRecordingShortcut={shortcuts.pauseRecording}
          pendingCaptureType={pendingCaptureType}
          recordingCountdown={recordingCountdown}
          recordingDurationMs={recordingDurationMs}
          startRecordingShortcut={shortcuts.startRecording}
          startScreenshotShortcut={shortcuts.startScreenshot}
          stopRecordingShortcut={shortcuts.stopRecording}
        />

        <div className="rounded-md border bg-muted p-3">
          <p className="text-muted-foreground text-xs leading-relaxed">
            We only capture your current browser tab. A new tab will open for
            you to review and submit your report.
          </p>
        </div>

        <Button
          className="justify-start text-muted-foreground"
          onClick={async () => {
            try {
              await chrome.tabs.create({ url: "chrome://extensions/shortcuts" })
              window.close()
            } catch (error: unknown) {
              reportNonFatalError(
                "Failed to open Chrome extension shortcuts settings",
                error
              )
            }
          }}
          size="sm"
          variant="ghost"
        >
          <Keyboard />
          Keyboard shortcuts
        </Button>
      </div>
    </div>
  )
}

export default App
