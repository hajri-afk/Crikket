import type { BugReportDebuggerPayload, DebuggerSessionSnapshot } from "./types"

/**
 * A stretch of wall-clock time where the video recorder was paused. No frames
 * are written to the video during this window, so it must be subtracted from
 * event offsets to keep them aligned with the playback timeline.
 */
export interface RecordingPauseWindow {
  pausedAt: number
  /** `null` while the recording is still paused. */
  resumedAt: number | null
}

interface BuildDebuggerSubmissionPayloadOptions {
  pauseWindows?: RecordingPauseWindow[]
}

export function hasDebuggerPayloadData(
  payload: BugReportDebuggerPayload
): boolean {
  return (
    payload.actions.length > 0 ||
    payload.logs.length > 0 ||
    payload.networkRequests.length > 0
  )
}

export function buildDebuggerSubmissionPayload(
  snapshot: DebuggerSessionSnapshot,
  options: BuildDebuggerSubmissionPayloadOptions = {}
): BugReportDebuggerPayload {
  const anchorTimestamp = snapshot.recordingStartedAt ?? snapshot.startedAt
  const pauseWindows = normalizePauseWindows(
    options.pauseWindows,
    anchorTimestamp
  )
  const events = [...snapshot.events].sort((a, b) => a.timestamp - b.timestamp)

  const payload: BugReportDebuggerPayload = {
    actions: [],
    logs: [],
    networkRequests: [],
  }

  for (const event of events) {
    const timestamp = new Date(event.timestamp).toISOString()
    const offset = toOffset(event.timestamp, anchorTimestamp, pauseWindows)

    if (event.kind === "action") {
      payload.actions.push({
        type: event.actionType,
        target: event.target,
        timestamp,
        offset,
        metadata: event.metadata,
      })
      continue
    }

    if (event.kind === "console") {
      payload.logs.push({
        level: event.level,
        message: event.message,
        timestamp,
        offset,
        metadata: event.metadata,
      })
      continue
    }

    payload.networkRequests.push({
      method: event.method,
      url: event.url,
      status: event.status,
      duration: event.duration,
      requestHeaders: event.requestHeaders,
      responseHeaders: event.responseHeaders,
      requestBody: event.requestBody,
      responseBody: event.responseBody,
      timestamp,
      offset,
    })
  }

  return payload
}

function toOffset(
  eventTimestamp: number,
  anchorTimestamp: number,
  pauseWindows: RecordingPauseWindow[]
): number | null {
  const rawOffset = Math.floor(eventTimestamp - anchorTimestamp)
  if (rawOffset < 0) {
    return null
  }

  const pausedBefore = pausedMsBefore(eventTimestamp, pauseWindows)
  return Math.max(0, rawOffset - pausedBefore)
}

/**
 * Total paused time that elapsed before `timestamp`. An event that landed
 * inside a pause window has no matching video frame, so it collapses onto the
 * moment the pause started.
 */
function pausedMsBefore(
  timestamp: number,
  pauseWindows: RecordingPauseWindow[]
): number {
  let paused = 0

  for (const window of pauseWindows) {
    if (window.pausedAt >= timestamp) {
      break
    }

    const resumedAt = window.resumedAt ?? Number.POSITIVE_INFINITY
    paused += Math.min(resumedAt, timestamp) - window.pausedAt
  }

  return Math.floor(paused)
}

/**
 * Drops windows that closed before the recording started, clamps the rest to
 * the anchor, and merges overlaps so paused time is never counted twice.
 */
function normalizePauseWindows(
  pauseWindows: RecordingPauseWindow[] | undefined,
  anchorTimestamp: number
): RecordingPauseWindow[] {
  if (!pauseWindows?.length) {
    return []
  }

  const sorted = pauseWindows
    .map((window) => ({
      pausedAt: Math.max(window.pausedAt, anchorTimestamp),
      resumedAt:
        window.resumedAt === null
          ? null
          : Math.max(window.resumedAt, anchorTimestamp),
    }))
    .filter(
      (window) =>
        window.resumedAt === null || window.resumedAt > window.pausedAt
    )
    .sort((a, b) => a.pausedAt - b.pausedAt)

  const merged: RecordingPauseWindow[] = []

  for (const window of sorted) {
    const previous = merged.at(-1)

    if (!previous) {
      merged.push(window)
      continue
    }

    // An open-ended previous window swallows everything after it.
    if (previous.resumedAt === null) {
      continue
    }

    if (window.pausedAt <= previous.resumedAt) {
      previous.resumedAt =
        window.resumedAt === null
          ? null
          : Math.max(previous.resumedAt, window.resumedAt)
      continue
    }

    merged.push(window)
  }

  return merged
}
