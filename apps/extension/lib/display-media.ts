/**
 * Where the video comes from. `tab` locks onto the website under test with no
 * OS picker; `screen` hands off to Chrome's picker so anything on the desktop
 * can be recorded.
 */
export type CaptureScope = "tab" | "screen"

export const CAPTURE_SCOPE_VALUES: readonly CaptureScope[] = ["tab", "screen"]

export function isCaptureScope(value: unknown): value is CaptureScope {
  return (
    typeof value === "string" &&
    (CAPTURE_SCOPE_VALUES as readonly string[]).includes(value)
  )
}

/**
 * Reads the scope straight off the recorder URL. Auto-start fires from an async
 * storage callback that captured its closure on the first render, so routing
 * this through React state would hand it a stale "tab" and silently record the
 * wrong surface.
 */
export function readCaptureScopeFromSearch(search: string): CaptureScope {
  const raw = new URLSearchParams(search).get("captureScope")
  return isCaptureScope(raw) ? raw : "tab"
}

interface TabCaptureConstraints extends MediaTrackConstraints {
  mandatory?: {
    chromeMediaSource: "tab"
    chromeMediaSourceId: string
  }
}

export const requestTabCaptureStream = async (
  tabId: number
): Promise<MediaStream> => {
  const streamId = await chrome.tabCapture.getMediaStreamId({
    targetTabId: tabId,
  })

  const stream = await navigator.mediaDevices.getUserMedia({
    audio: false,
    video: {
      mandatory: {
        chromeMediaSource: "tab",
        chromeMediaSourceId: streamId,
      },
    } as TabCaptureConstraints,
  })

  return stream
}

/**
 * Opens Chrome's screen picker with the plain web API — no extension
 * permission and no service worker in the path. `displaySurface` is only a
 * hint, so the user may still pick a window instead of a whole monitor.
 *
 * Needs transient user activation, which is why this scope waits for a click
 * instead of starting on its own.
 */
export const requestScreenCaptureStream = async (): Promise<MediaStream> => {
  return await navigator.mediaDevices.getDisplayMedia({
    audio: false,
    video: {
      displaySurface: "monitor",
    },
  })
}
