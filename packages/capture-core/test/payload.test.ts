import { describe, expect, it } from "bun:test"

import {
  buildDebuggerSubmissionPayload,
  hasDebuggerPayloadData,
} from "../src/debugger/payload"
import type { DebuggerSessionSnapshot } from "../src/debugger/types"

describe("debugger payload regression", () => {
  it("sorts events and computes offsets from recording start when available", () => {
    const snapshot: DebuggerSessionSnapshot = {
      sessionId: "session_1",
      captureTabId: 12,
      captureType: "video",
      startedAt: 1000,
      recordingStartedAt: 1500,
      events: [
        {
          kind: "network",
          timestamp: 2100,
          method: "POST",
          url: "https://example.com/api/report",
          status: 201,
        },
        {
          kind: "action",
          timestamp: 1200,
          actionType: "click",
          target: "button.submit",
          metadata: {
            source: "checkout",
          },
        },
        {
          kind: "console",
          timestamp: 1800,
          level: "error",
          message: "Network failed",
          metadata: {
            attempts: 2,
          },
        },
      ],
    }

    const payload = buildDebuggerSubmissionPayload(snapshot)

    expect(payload).toEqual({
      actions: [
        {
          type: "click",
          target: "button.submit",
          timestamp: new Date(1200).toISOString(),
          offset: null,
          metadata: {
            source: "checkout",
          },
        },
      ],
      logs: [
        {
          level: "error",
          message: "Network failed",
          timestamp: new Date(1800).toISOString(),
          offset: 300,
          metadata: {
            attempts: 2,
          },
        },
      ],
      networkRequests: [
        {
          method: "POST",
          url: "https://example.com/api/report",
          status: 201,
          duration: undefined,
          requestHeaders: undefined,
          responseHeaders: undefined,
          requestBody: undefined,
          responseBody: undefined,
          timestamp: new Date(2100).toISOString(),
          offset: 600,
        },
      ],
    })
  })

  it("subtracts paused time so offsets stay aligned with the video timeline", () => {
    const snapshot: DebuggerSessionSnapshot = {
      sessionId: "session_2",
      captureTabId: 12,
      captureType: "video",
      startedAt: 1000,
      recordingStartedAt: 1000,
      events: [
        // Before any pause: offset is untouched.
        { kind: "console", timestamp: 1500, level: "info", message: "before" },
        // Inside the pause window: collapses onto the moment of the pause.
        { kind: "console", timestamp: 2500, level: "info", message: "during" },
        // After the pause: shifted back by the full 2000ms pause.
        { kind: "console", timestamp: 5000, level: "info", message: "after" },
      ],
    }

    const payload = buildDebuggerSubmissionPayload(snapshot, {
      pauseWindows: [{ pausedAt: 2000, resumedAt: 4000 }],
    })

    expect(payload.logs.map((log) => [log.message, log.offset])).toEqual([
      ["before", 500],
      ["during", 1000],
      ["after", 2000],
    ])
  })

  it("treats an unresolved pause as lasting until the end of the recording", () => {
    const snapshot: DebuggerSessionSnapshot = {
      sessionId: "session_3",
      captureTabId: 12,
      captureType: "video",
      startedAt: 1000,
      recordingStartedAt: 1000,
      events: [
        { kind: "console", timestamp: 3000, level: "info", message: "paused" },
      ],
    }

    const payload = buildDebuggerSubmissionPayload(snapshot, {
      pauseWindows: [{ pausedAt: 2000, resumedAt: null }],
    })

    expect(payload.logs[0].offset).toBe(1000)
  })

  it("merges overlapping pause windows so paused time is not double counted", () => {
    const snapshot: DebuggerSessionSnapshot = {
      sessionId: "session_4",
      captureTabId: 12,
      captureType: "video",
      startedAt: 1000,
      recordingStartedAt: 1000,
      events: [
        { kind: "console", timestamp: 9000, level: "info", message: "late" },
      ],
    }

    const payload = buildDebuggerSubmissionPayload(snapshot, {
      pauseWindows: [
        { pausedAt: 5000, resumedAt: 7000 },
        { pausedAt: 2000, resumedAt: 4000 },
        // Overlaps the first window; only the union counts.
        { pausedAt: 6000, resumedAt: 6500 },
      ],
    })

    expect(payload.logs[0].offset).toBe(4000)
  })

  it("ignores pause windows that closed before the recording started", () => {
    const snapshot: DebuggerSessionSnapshot = {
      sessionId: "session_5",
      captureTabId: 12,
      captureType: "video",
      startedAt: 500,
      recordingStartedAt: 2000,
      events: [
        { kind: "console", timestamp: 3000, level: "info", message: "event" },
      ],
    }

    const payload = buildDebuggerSubmissionPayload(snapshot, {
      pauseWindows: [{ pausedAt: 800, resumedAt: 1200 }],
    })

    expect(payload.logs[0].offset).toBe(1000)
  })

  it("detects whether a payload contains any debugger data", () => {
    expect(
      hasDebuggerPayloadData({
        actions: [],
        logs: [],
        networkRequests: [],
      })
    ).toBe(false)

    expect(
      hasDebuggerPayloadData({
        actions: [
          {
            type: "click",
            timestamp: new Date(1000).toISOString(),
            offset: 0,
          },
        ],
        logs: [],
        networkRequests: [],
      })
    ).toBe(true)
  })
})
