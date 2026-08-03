export type CaptureContext = { title?: string; url?: string }

export const CAPTURE_CONTEXT_STORAGE_KEY = "captureContext"
export const CAPTURE_TAB_ID_STORAGE_KEY = "captureTabId"
export const RECORDING_IN_PROGRESS_STORAGE_KEY = "recordingInProgress"
export const RECORDER_TAB_ID_STORAGE_KEY = "recorderTabId"
export const RECORDING_COUNTDOWN_ENDS_AT_STORAGE_KEY =
  "recordingCountdownEndsAt"
export const RECORDING_STARTED_AT_STORAGE_KEY = "recordingStartedAt"
/** True while the recorder is paused, so the popup can mirror the state. */
export const RECORDING_PAUSED_STORAGE_KEY = "recordingPaused"
/** Paused milliseconds from pause windows that have already been closed. */
export const RECORDING_PAUSED_MS_STORAGE_KEY = "recordingPausedMs"
/** Start of the pause that is still open, or absent when running. */
export const RECORDING_PAUSED_AT_STORAGE_KEY = "recordingPausedAt"
/** Last capture scope the user picked, so the popup can restore it. */
export const CAPTURE_SCOPE_STORAGE_KEY = "captureScope"
export const HOTKEY_START_VIDEO_CAPTURE_STORAGE_KEY = "hotkeyStartVideoCapture"
export const HOTKEY_START_SCREENSHOT_CAPTURE_STORAGE_KEY =
  "hotkeyStartScreenshotCapture"

const isExtensionUrl = (url?: string): boolean =>
  typeof url === "string" &&
  (url.startsWith("chrome-extension://") || url.startsWith("moz-extension://"))

export const sanitizeCaptureContext = (
  context?: CaptureContext
): CaptureContext => {
  if (!context) return {}
  if (isExtensionUrl(context.url)) return {}

  return {
    title: context.title ?? undefined,
    url: context.url ?? undefined,
  }
}

export const hasCaptureContext = (context: CaptureContext): boolean =>
  Boolean(context.title || context.url)

export const getActiveTabContext = async (): Promise<CaptureContext> => {
  const tabs = await chrome.tabs.query({
    active: true,
    currentWindow: true,
  })
  const activeTab = tabs[0]

  return sanitizeCaptureContext({
    title: activeTab?.title ?? undefined,
    url: activeTab?.url ?? undefined,
  })
}

export const readAndClearStoredCaptureContext =
  async (): Promise<CaptureContext> => {
    const stored = await chrome.storage.local.get([CAPTURE_CONTEXT_STORAGE_KEY])
    await chrome.storage.local.remove([CAPTURE_CONTEXT_STORAGE_KEY])

    return sanitizeCaptureContext(
      stored[CAPTURE_CONTEXT_STORAGE_KEY] as CaptureContext | undefined
    )
  }

/**
 * Drops every trace of an in-flight recording. Used both by the normal stop
 * flow and by the recovery paths, so a dead recorder tab can never leave the
 * popup stuck on "Recording now".
 */
export const clearRecordingState = async (): Promise<void> => {
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

/**
 * Mirrors the recorder's pause state into storage. The popup has no access to
 * the MediaRecorder, so this is how it learns to freeze its timer and show the
 * right label while a recording is on hold.
 */
export const writeRecordingPauseState = async (input: {
  isPaused: boolean
  closedPausedMs: number
  pausedAt: number | null
}): Promise<void> => {
  await chrome.storage.local.set({
    [RECORDING_PAUSED_STORAGE_KEY]: input.isPaused,
    [RECORDING_PAUSED_MS_STORAGE_KEY]: input.closedPausedMs,
  })

  if (input.pausedAt === null) {
    await chrome.storage.local.remove([RECORDING_PAUSED_AT_STORAGE_KEY])
    return
  }

  await chrome.storage.local.set({
    [RECORDING_PAUSED_AT_STORAGE_KEY]: input.pausedAt,
  })
}

/** Clears the recording state when the tab that owned the recording is gone. */
export const clearRecordingStateForClosedTab = async (
  closedTabId: number
): Promise<void> => {
  const stored = await chrome.storage.local.get([RECORDER_TAB_ID_STORAGE_KEY])
  if (stored[RECORDER_TAB_ID_STORAGE_KEY] !== closedTabId) {
    return
  }

  await clearRecordingState()
}

export const readAndClearCaptureTabId = async (): Promise<number | null> => {
  const stored = await chrome.storage.local.get([CAPTURE_TAB_ID_STORAGE_KEY])
  await chrome.storage.local.remove([CAPTURE_TAB_ID_STORAGE_KEY])

  const tabId = stored[CAPTURE_TAB_ID_STORAGE_KEY]
  return typeof tabId === "number" ? tabId : null
}
