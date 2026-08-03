import { reportNonFatalError } from "@crikket/shared/lib/errors"
import { useCallback, useEffect, useState } from "react"
import {
  clearRecordingState as clearStoredRecordingState,
  RECORDER_TAB_ID_STORAGE_KEY,
  RECORDING_COUNTDOWN_ENDS_AT_STORAGE_KEY,
  RECORDING_IN_PROGRESS_STORAGE_KEY,
  RECORDING_PAUSED_AT_STORAGE_KEY,
  RECORDING_PAUSED_MS_STORAGE_KEY,
  RECORDING_PAUSED_STORAGE_KEY,
  RECORDING_STARTED_AT_STORAGE_KEY,
} from "@/lib/capture-context"

interface UsePopupRecordingStatusReturn {
  isRecordingInProgress: boolean
  isRecordingPaused: boolean
  recordingCountdown: number | null
  recordingDurationMs: number
  isStoppingFromPopup: boolean
  stopError: string | null
  stopFromPopup: () => Promise<void>
  togglePauseFromPopup: () => Promise<void>
  resetRecordingState: () => Promise<void>
}

export function usePopupRecordingStatus(): UsePopupRecordingStatusReturn {
  const [isRecordingInProgress, setIsRecordingInProgress] = useState(false)
  const [isRecordingPaused, setIsRecordingPaused] = useState(false)
  const [closedPausedMs, setClosedPausedMs] = useState(0)
  const [pausedAt, setPausedAt] = useState<number | null>(null)
  const [recordingCountdown, setRecordingCountdown] = useState<number | null>(
    null
  )
  const [recordingStartedAt, setRecordingStartedAt] = useState<number | null>(
    null
  )
  const [recordingDurationMs, setRecordingDurationMs] = useState(0)
  const [recorderTabId, setRecorderTabId] = useState<number | null>(null)
  const [isStoppingFromPopup, setIsStoppingFromPopup] = useState(false)
  const [stopError, setStopError] = useState<string | null>(null)

  const clearRecordingState = useCallback(clearStoredRecordingState, [])

  useEffect(() => {
    let intervalId: number | undefined

    const updateCountdown = (endsAt?: number) => {
      if (typeof endsAt !== "number") {
        setRecordingCountdown(null)
        if (intervalId !== undefined) {
          window.clearInterval(intervalId)
          intervalId = undefined
        }
        return
      }

      const update = () => {
        const remaining = Math.max(0, Math.ceil((endsAt - Date.now()) / 1000))
        setRecordingCountdown(remaining > 0 ? remaining : null)
        if (remaining <= 0 && intervalId !== undefined) {
          window.clearInterval(intervalId)
          intervalId = undefined
        }
      }

      update()
      if (intervalId !== undefined) {
        window.clearInterval(intervalId)
      }
      intervalId = window.setInterval(update, 250)
    }

    const readRecordingState = async () => {
      const result = await chrome.storage.local.get([
        RECORDING_IN_PROGRESS_STORAGE_KEY,
        RECORDER_TAB_ID_STORAGE_KEY,
        RECORDING_COUNTDOWN_ENDS_AT_STORAGE_KEY,
        RECORDING_STARTED_AT_STORAGE_KEY,
        RECORDING_PAUSED_STORAGE_KEY,
        RECORDING_PAUSED_MS_STORAGE_KEY,
        RECORDING_PAUSED_AT_STORAGE_KEY,
      ])

      const tabId = result[RECORDER_TAB_ID_STORAGE_KEY]
      const countdownEndsAt =
        typeof result[RECORDING_COUNTDOWN_ENDS_AT_STORAGE_KEY] === "number"
          ? (result[RECORDING_COUNTDOWN_ENDS_AT_STORAGE_KEY] as number)
          : null
      const startedAt = result[RECORDING_STARTED_AT_STORAGE_KEY]
      const storedPausedMs = result[RECORDING_PAUSED_MS_STORAGE_KEY]
      const storedPausedAt = result[RECORDING_PAUSED_AT_STORAGE_KEY]

      return {
        isRecording: Boolean(result[RECORDING_IN_PROGRESS_STORAGE_KEY]),
        storedTabId: typeof tabId === "number" ? tabId : null,
        countdownEndsAt,
        recordingStartedAtValue:
          typeof startedAt === "number" ? startedAt : null,
        isPaused: Boolean(result[RECORDING_PAUSED_STORAGE_KEY]),
        closedPausedMsValue:
          typeof storedPausedMs === "number" ? storedPausedMs : 0,
        pausedAtValue:
          typeof storedPausedAt === "number" ? storedPausedAt : null,
      }
    }

    const applyPauseState = (input: {
      isPaused: boolean
      closedPausedMsValue: number
      pausedAtValue: number | null
    }) => {
      setIsRecordingPaused(input.isPaused)
      setClosedPausedMs(input.closedPausedMsValue)
      setPausedAt(input.pausedAtValue)
    }

    const resolveRecorderTabId = async (
      storedTabId: number | null
    ): Promise<number | null> => {
      if (storedTabId !== null) {
        try {
          await chrome.tabs.get(storedTabId)
          return storedTabId
        } catch (error) {
          reportNonFatalError(
            `Failed to resolve stored recorder tab ${storedTabId}, falling back to query lookup`,
            error
          )
        }
      }

      const recorderTabs = await chrome.tabs.query({
        url: [chrome.runtime.getURL("/recorder.html*")],
      })
      const mostRecentRecorderTab = recorderTabs
        .filter((tab) => typeof tab.id === "number")
        .sort((a, b) => (b.id ?? 0) - (a.id ?? 0))[0]
      return mostRecentRecorderTab?.id ?? null
    }

    const applyInactiveState = (countdownEndsAt: number | null) => {
      setIsRecordingInProgress(false)
      setRecorderTabId(null)
      setRecordingStartedAt(null)
      applyPauseState({
        isPaused: false,
        closedPausedMsValue: 0,
        pausedAtValue: null,
      })
      updateCountdown(countdownEndsAt ?? undefined)
    }

    const applyRecoveredState = async () => {
      await clearRecordingState()
      setIsRecordingInProgress(false)
      setRecorderTabId(null)
      setRecordingStartedAt(null)
      applyPauseState({
        isPaused: false,
        closedPausedMsValue: 0,
        pausedAtValue: null,
      })
      updateCountdown(undefined)
    }

    const syncRecordingState = async () => {
      const {
        isRecording,
        storedTabId,
        countdownEndsAt,
        recordingStartedAtValue,
        isPaused,
        closedPausedMsValue,
        pausedAtValue,
      } = await readRecordingState()

      if (!isRecording) {
        applyInactiveState(countdownEndsAt)
        return
      }

      const resolvedRecorderTabId = await resolveRecorderTabId(storedTabId)
      const hasActiveCountdown =
        typeof countdownEndsAt === "number" && countdownEndsAt > Date.now()

      if (resolvedRecorderTabId === null && !hasActiveCountdown) {
        await applyRecoveredState()
        return
      }

      setIsRecordingInProgress(true)
      setRecorderTabId(resolvedRecorderTabId)
      setRecordingStartedAt(recordingStartedAtValue)
      applyPauseState({ isPaused, closedPausedMsValue, pausedAtValue })
      updateCountdown(countdownEndsAt ?? undefined)
    }

    const handleStorageChange = (
      changes: { [key: string]: chrome.storage.StorageChange },
      areaName: string
    ) => {
      if (areaName !== "local") return
      if (
        !(
          changes[RECORDING_IN_PROGRESS_STORAGE_KEY] ||
          changes[RECORDER_TAB_ID_STORAGE_KEY] ||
          changes[RECORDING_COUNTDOWN_ENDS_AT_STORAGE_KEY] ||
          changes[RECORDING_STARTED_AT_STORAGE_KEY] ||
          changes[RECORDING_PAUSED_STORAGE_KEY] ||
          changes[RECORDING_PAUSED_MS_STORAGE_KEY] ||
          changes[RECORDING_PAUSED_AT_STORAGE_KEY]
        )
      ) {
        return
      }
      syncRecordingState().catch((error: unknown) => {
        reportNonFatalError("Failed to sync popup recording state", error)
      })
    }

    syncRecordingState().catch((error: unknown) => {
      reportNonFatalError("Failed to initialize popup recording state", error)
    })
    chrome.storage.onChanged.addListener(handleStorageChange)

    return () => {
      if (intervalId !== undefined) {
        window.clearInterval(intervalId)
      }
      chrome.storage.onChanged.removeListener(handleStorageChange)
    }
  }, [clearRecordingState])

  useEffect(() => {
    if (!(isRecordingInProgress && recordingStartedAt)) {
      setRecordingDurationMs(0)
      return
    }

    // Mirror the recorder's clock: paused time never makes it into the video,
    // so it must not be counted here either.
    const updateDuration = () => {
      const now = Date.now()
      const openPausedMs = pausedAt === null ? 0 : Math.max(0, now - pausedAt)
      setRecordingDurationMs(
        Math.max(0, now - recordingStartedAt - closedPausedMs - openPausedMs)
      )
    }

    updateDuration()

    // A frozen timer needs no ticking, just one final settle.
    if (pausedAt !== null) {
      return
    }

    const intervalId = window.setInterval(updateDuration, 200)

    return () => {
      window.clearInterval(intervalId)
    }
  }, [closedPausedMs, isRecordingInProgress, pausedAt, recordingStartedAt])

  const stopFromPopup = useCallback(async () => {
    setIsStoppingFromPopup(true)
    setStopError(null)

    try {
      try {
        await chrome.runtime.sendMessage({ type: "STOP_RECORDING_FROM_POPUP" })
      } catch (error) {
        reportNonFatalError(
          "Failed to send STOP_RECORDING_FROM_POPUP message, continuing with tab-based resolution",
          error
        )
      }

      let targetRecorderTabId: number | null = recorderTabId

      if (targetRecorderTabId === null) {
        const stored = await chrome.storage.local.get([
          RECORDER_TAB_ID_STORAGE_KEY,
        ])
        const storedTabId = stored[RECORDER_TAB_ID_STORAGE_KEY]
        targetRecorderTabId =
          typeof storedTabId === "number" ? storedTabId : null
      }

      if (targetRecorderTabId === null) {
        const recorderTabs = await chrome.tabs.query({
          url: [chrome.runtime.getURL("/recorder.html*")],
        })
        const mostRecentRecorderTab = recorderTabs
          .filter((tab) => typeof tab.id === "number")
          .sort((a, b) => (b.id ?? 0) - (a.id ?? 0))[0]
        targetRecorderTabId = mostRecentRecorderTab?.id ?? null
      }

      if (targetRecorderTabId !== null) {
        const recorderTab = await chrome.tabs.get(targetRecorderTabId)
        if (typeof recorderTab.windowId === "number") {
          await chrome.windows.update(recorderTab.windowId, { focused: true })
        }
        await chrome.tabs.update(targetRecorderTabId, { active: true })
      } else {
        await clearRecordingState()
        setIsRecordingInProgress(false)
        setRecorderTabId(null)
        setRecordingStartedAt(null)
        setRecordingCountdown(null)
        setRecordingDurationMs(0)
      }

      window.close()
    } catch (err) {
      console.error(err)
      setStopError(
        err instanceof Error ? err.message : "Failed to stop recording"
      )
      setIsStoppingFromPopup(false)
    }
  }, [clearRecordingState, recorderTabId])

  /**
   * Asks the recorder tab to flip its pause state. The popup stays open so the
   * label updates in place once the recorder writes the new state back.
   */
  const togglePauseFromPopup = useCallback(async () => {
    setStopError(null)

    try {
      await chrome.runtime.sendMessage({
        type: "TOGGLE_PAUSE_RECORDING_FROM_POPUP",
      })
    } catch (error) {
      reportNonFatalError(
        "Failed to send TOGGLE_PAUSE_RECORDING_FROM_POPUP from popup",
        error
      )
      setStopError(
        "Could not reach the recorder tab. Open it to pause the recording."
      )
    }
  }, [])

  /**
   * Escape hatch for a recording that can no longer be stopped — for example
   * when the recorder tab was closed or orphaned by an extension reload.
   */
  const resetRecordingState = useCallback(async () => {
    setStopError(null)

    try {
      await clearRecordingState()
    } catch (error) {
      reportNonFatalError("Failed to reset stuck recording state", error)
    }

    setIsRecordingInProgress(false)
    setRecorderTabId(null)
    setRecordingStartedAt(null)
    setRecordingCountdown(null)
    setRecordingDurationMs(0)
    setIsStoppingFromPopup(false)
  }, [clearRecordingState])

  return {
    isRecordingInProgress,
    isRecordingPaused,
    recordingCountdown,
    recordingDurationMs,
    isStoppingFromPopup,
    stopError,
    stopFromPopup,
    togglePauseFromPopup,
    resetRecordingState,
  }
}
