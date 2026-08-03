import type { RecordingPauseWindow } from "@crikket/capture-core/debugger/payload"
import { reportNonFatalError } from "@crikket/shared/lib/errors"
import { useEffect } from "react"
import type { CaptureType } from "@/hooks/use-recorder-init"
import {
  RECORDER_TAB_ID_STORAGE_KEY,
  RECORDING_COUNTDOWN_ENDS_AT_STORAGE_KEY,
  RECORDING_IN_PROGRESS_STORAGE_KEY,
  RECORDING_PAUSED_AT_STORAGE_KEY,
  RECORDING_PAUSED_MS_STORAGE_KEY,
  RECORDING_PAUSED_STORAGE_KEY,
  RECORDING_STARTED_AT_STORAGE_KEY,
  writeRecordingPauseState,
} from "@/lib/capture-context"

interface UseRecorderRecordingSyncProps {
  captureType: CaptureType
  state: "idle" | "recording" | "stopped" | "submitting" | "success"
  isPaused: boolean
  getPauseWindows: () => RecordingPauseWindow[]
  onStopFromPopup: () => Promise<void>
  onTogglePauseFromPopup: () => void
}

export function useRecorderRecordingSync({
  captureType,
  getPauseWindows,
  isPaused,
  onStopFromPopup,
  onTogglePauseFromPopup,
  state,
}: UseRecorderRecordingSyncProps) {
  // Publish the pause state so the popup can freeze its own timer and offer a
  // resume button without touching the MediaRecorder.
  // biome-ignore lint/correctness/useExhaustiveDependencies: `state` republishes a cleared pause state when a new recording starts in a reused recorder tab, otherwise the previous run's paused total leaks into the popup timer
  useEffect(() => {
    if (captureType !== "video") {
      return
    }

    const windows = getPauseWindows()
    const openWindow = windows.at(-1)
    const pausedAt =
      openWindow && openWindow.resumedAt === null ? openWindow.pausedAt : null
    const closedPausedMs = windows.reduce(
      (total, window) =>
        window.resumedAt === null
          ? total
          : total + (window.resumedAt - window.pausedAt),
      0
    )

    writeRecordingPauseState({
      isPaused,
      closedPausedMs: Math.max(0, Math.floor(closedPausedMs)),
      pausedAt,
    }).catch((error: unknown) => {
      reportNonFatalError("Failed to publish recorder pause state", error)
    })
  }, [captureType, getPauseWindows, isPaused, state])
  useEffect(() => {
    const clearRecordingFlags = async () => {
      await chrome.storage.local.set({
        [RECORDING_IN_PROGRESS_STORAGE_KEY]: false,
      })
      await chrome.storage.local.remove([
        RECORDER_TAB_ID_STORAGE_KEY,
        RECORDING_COUNTDOWN_ENDS_AT_STORAGE_KEY,
        RECORDING_STARTED_AT_STORAGE_KEY,
        RECORDING_PAUSED_STORAGE_KEY,
        RECORDING_PAUSED_MS_STORAGE_KEY,
        RECORDING_PAUSED_AT_STORAGE_KEY,
      ])
    }

    const syncRecordingState = async () => {
      if (captureType !== "video") {
        await clearRecordingFlags()
        return
      }

      if (state === "idle") {
        const result = await chrome.storage.local.get([
          RECORDING_IN_PROGRESS_STORAGE_KEY,
          RECORDING_COUNTDOWN_ENDS_AT_STORAGE_KEY,
        ])
        const isRecordingInProgress = Boolean(
          result[RECORDING_IN_PROGRESS_STORAGE_KEY]
        )
        const hasActiveCountdown =
          typeof result[RECORDING_COUNTDOWN_ENDS_AT_STORAGE_KEY] === "number"

        if (isRecordingInProgress && !hasActiveCountdown) {
          await clearRecordingFlags()
        }
        return
      }

      if (state === "recording") {
        const currentTab = await chrome.tabs.getCurrent()
        await chrome.storage.local.set({
          [RECORDING_IN_PROGRESS_STORAGE_KEY]: true,
          [RECORDING_STARTED_AT_STORAGE_KEY]: Date.now(),
          [RECORDER_TAB_ID_STORAGE_KEY]: currentTab?.id,
        })
        await chrome.storage.local.remove([
          RECORDING_COUNTDOWN_ENDS_AT_STORAGE_KEY,
        ])
        return
      }

      await clearRecordingFlags()
    }

    syncRecordingState().catch((error: unknown) => {
      reportNonFatalError("Failed to sync recorder recording state", error)
    })
  }, [captureType, state])

  useEffect(() => {
    const handleMessage = (message: { type?: string }) => {
      if (state !== "recording") return

      if (message.type === "TOGGLE_PAUSE_RECORDING_FROM_POPUP") {
        onTogglePauseFromPopup()
        return
      }

      if (message.type !== "STOP_RECORDING_FROM_POPUP") return
      onStopFromPopup().catch((error: unknown) => {
        reportNonFatalError(
          "Failed to stop recording from popup trigger",
          error
        )
      })
    }

    chrome.runtime.onMessage.addListener(handleMessage)

    return () => {
      chrome.runtime.onMessage.removeListener(handleMessage)
    }
  }, [onStopFromPopup, onTogglePauseFromPopup, state])

  useEffect(() => {
    return () => {
      chrome.storage.local.set({
        [RECORDING_IN_PROGRESS_STORAGE_KEY]: false,
      })
      chrome.storage.local.remove([
        RECORDER_TAB_ID_STORAGE_KEY,
        RECORDING_COUNTDOWN_ENDS_AT_STORAGE_KEY,
        RECORDING_STARTED_AT_STORAGE_KEY,
        RECORDING_PAUSED_STORAGE_KEY,
        RECORDING_PAUSED_MS_STORAGE_KEY,
        RECORDING_PAUSED_AT_STORAGE_KEY,
      ])
    }
  }, [])
}
