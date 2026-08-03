import {
  buildDebuggerSubmissionPayload,
  hasDebuggerPayloadData,
} from "@crikket/capture-core/debugger/payload"
import { readDebuggerSessionIdFromSearch } from "@crikket/capture-core/debugger/recorder-session"
import type { BugReportDebuggerPayload } from "@crikket/capture-core/debugger/types"
import { env } from "@crikket/env/extension"
import type { Priority } from "@crikket/shared/constants/priorities"
import {
  TEST_SCENARIO_MAX_LENGTH,
  TESTED_FEATURE_MAX_LENGTH,
  type TestCaseType,
} from "@crikket/shared/constants/test-case"
import { reportNonFatalError } from "@crikket/shared/lib/errors"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@crikket/ui/components/ui/card"
import { AlertCircle } from "lucide-react"
import { useCallback, useEffect, useMemo, useState } from "react"
import { FormStep } from "@/components/form-step"
import { IdleStep } from "@/components/idle-step"
import { RecordingStep } from "@/components/recording-step"
import { SuccessStep } from "@/components/success-step"
import { useCaptureContext } from "@/hooks/use-capture-context"
import { useCommandShortcuts } from "@/hooks/use-command-shortcuts"
import { type CaptureType, useRecorderInit } from "@/hooks/use-recorder-init"
import { useRecorderRecordingSync } from "@/hooks/use-recorder-recording-sync"
import { useRooms } from "@/hooks/use-rooms"
import { useScreenCapture } from "@/hooks/use-screen-capture"
import { useTimer } from "@/hooks/use-timer"
import {
  discardDebuggerSession,
  getDebuggerSessionSnapshot,
  markDebuggerRecordingStarted,
} from "@/lib/bug-report-debugger/client"
import { submitBugReportWithUploads } from "@/lib/bug-report-upload"
import {
  type CaptureScope,
  readCaptureScopeFromSearch,
} from "@/lib/display-media"
import {
  buildCaptureContextSubmissionData,
  type DebuggerCaptureSummary,
  dedupeMessages,
  EMPTY_DEBUGGER_SUMMARY,
  getDebuggerCaptureSummary,
  getSubmissionErrorMessage,
  isUnauthorizedSubmissionError,
  normalizeOptionalText,
} from "@/lib/recorder-submit"
import { formatDuration, getDeviceInfo } from "@/lib/utils"

type State = "idle" | "recording" | "stopped" | "submitting" | "success"

interface DebuggerSubmissionInput {
  sessionId: string | null
  payload: BugReportDebuggerPayload | undefined
  summary: DebuggerCaptureSummary
  warnings: string[]
}

function getStateDescription(
  state: State,
  isPaused: boolean,
  captureScope: CaptureScope
): string {
  if (state === "idle") {
    return captureScope === "screen"
      ? "Pick what to record"
      : "Waiting for capture"
  }

  if (state === "recording") {
    return isPaused ? "Recording paused" : "Recording in progress..."
  }

  if (state === "stopped") {
    return "Review and submit"
  }

  if (state === "success") {
    return "Report submitted!"
  }

  return ""
}

function App() {
  const shortcuts = useCommandShortcuts()
  const [state, setState] = useState<State>("idle")
  const [captureType, setCaptureType] = useState<CaptureType>("video")
  const captureScope = useMemo(
    () => readCaptureScopeFromSearch(window.location.search),
    []
  )
  const [startTime, setStartTime] = useState<number | null>(null)
  const [recordedDurationMs, setRecordedDurationMs] = useState<number | null>(
    null
  )
  const [resultUrl, setResultUrl] = useState("")
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [submissionWarnings, setSubmissionWarnings] = useState<string[]>([])
  const [preSubmitWarnings, setPreSubmitWarnings] = useState<string[]>([])
  const [debuggerSummary, setDebuggerSummary] =
    useState<DebuggerCaptureSummary>(EMPTY_DEBUGGER_SUMMARY)
  const debuggerSessionId = useMemo(
    () => readDebuggerSessionIdFromSearch(window.location.search),
    []
  )

  const captureContext = useCaptureContext()
  const roomsState = useRooms()

  const {
    startRecording: startCapture,
    stopRecording: stopCapture,
    suspendRecording: suspendCapture,
    pauseRecording: pauseCapture,
    resumeRecording: resumeCapture,
    isPaused,
    takeScreenshot: captureScreenshot,
    recordedBlob,
    screenshotBlob,
    error: captureError,
    reset: resetCapture,
    setRecordedBlob,
    setScreenshotBlob,
    getPauseWindows,
    getPausedMs,
  } = useScreenCapture()

  const duration = useTimer(startTime, state === "recording", getPausedMs)

  const handleTogglePause = useCallback(() => {
    if (isPaused) {
      resumeCapture()
      return
    }

    pauseCapture().catch((error: unknown) => {
      reportNonFatalError("Failed to pause the recording", error)
    })
  }, [isPaused, pauseCapture, resumeCapture])

  const clearDebuggerState = useCallback(async () => {
    if (debuggerSessionId) {
      await discardDebuggerSession(debuggerSessionId).catch(
        (error: unknown) => {
          reportNonFatalError(
            "Failed to discard debugger session during reset",
            error
          )
        }
      )
    }
  }, [debuggerSessionId])

  const getDebuggerSubmissionInput = useCallback(async () => {
    const warnings: string[] = []
    const sessionId = debuggerSessionId
    if (!sessionId) {
      warnings.push(
        "Debugger session was not found. This report may be missing captured logs."
      )
      return {
        sessionId: null,
        payload: undefined,
        summary: EMPTY_DEBUGGER_SUMMARY,
        warnings,
      } satisfies DebuggerSubmissionInput
    }

    const snapshot = await getDebuggerSessionSnapshot(sessionId).catch(
      (error: unknown) => {
        reportNonFatalError(
          `Failed to load debugger snapshot for session ${sessionId}`,
          error
        )
        return null
      }
    )

    if (!snapshot) {
      warnings.push(
        "Debugger snapshot could not be loaded. This report may be missing captured logs."
      )
      return {
        sessionId,
        payload: undefined,
        summary: EMPTY_DEBUGGER_SUMMARY,
        warnings,
      } satisfies DebuggerSubmissionInput
    }

    const payload = buildDebuggerSubmissionPayload(snapshot, {
      pauseWindows: getPauseWindows(),
    })
    const summary = getDebuggerCaptureSummary(payload)
    const hasPayloadData = hasDebuggerPayloadData(payload)

    if (!hasPayloadData) {
      warnings.push(
        "No debugger events were captured yet. Reproduce the issue once before submitting if you need network/action logs."
      )
    } else if (summary.networkRequests === 0) {
      warnings.push(
        "No network requests were captured in this recording. API-level debugging data may be incomplete."
      )
    }

    return {
      sessionId,
      payload: hasPayloadData ? payload : undefined,
      summary,
      warnings,
    } satisfies DebuggerSubmissionInput
  }, [debuggerSessionId, getPauseWindows])

  const handleStopRecording = useCallback(async () => {
    const stoppedAt = Date.now()
    const pausedMs = getPausedMs(stoppedAt)
    const previewBlob = await suspendCapture()
    if (previewBlob) {
      setRecordedBlob(previewBlob)
    } else {
      // The stream already died, so there is nothing left to suspend.
      await stopCapture()
    }

    if (startTime) {
      setRecordedDurationMs(Math.max(0, stoppedAt - startTime - pausedMs))
    }
    setState("stopped")
  }, [getPausedMs, setRecordedBlob, startTime, stopCapture, suspendCapture])

  /**
   * Continues the suspended recording from the review screen. The stale
   * preview is cleared so the "recording finished" effect does not bounce
   * straight back to review.
   */
  const handleContinueRecording = useCallback(() => {
    if (!resumeCapture()) {
      return
    }

    setRecordedBlob(null)
    setRecordedDurationMs(null)
    setSubmitError(null)
    setPreSubmitWarnings([])
    setState("recording")
  }, [resumeCapture, setRecordedBlob])

  useRecorderRecordingSync({
    captureType,
    getPauseWindows,
    isPaused,
    onStopFromPopup: handleStopRecording,
    onTogglePauseFromPopup: handleTogglePause,
    state,
  })

  const startVideoCapture = useCallback(async () => {
    const success = await startCapture(captureScope)
    if (success) {
      const startedAt = Date.now()
      const sessionId = debuggerSessionId
      if (sessionId) {
        await markDebuggerRecordingStarted({
          sessionId,
          recordingStartedAt: startedAt,
        }).catch((error: unknown) => {
          reportNonFatalError(
            `Failed to mark debugger recording start for session ${sessionId}`,
            error
          )
        })
      }

      setStartTime(startedAt)
      setRecordedDurationMs(null)
      setState("recording")
    }
  }, [captureScope, debuggerSessionId, startCapture])

  const handleStartCapture = useCallback(async () => {
    if (captureType === "screenshot") {
      const blob = await captureScreenshot()
      if (blob) {
        setRecordedDurationMs(null)
        setState("stopped")
      }
      return
    }

    await startVideoCapture()
  }, [captureScreenshot, captureType, startVideoCapture])

  useEffect(() => {
    if (state === "recording" && recordedBlob) {
      if (startTime) {
        const endedAt = Date.now()
        setRecordedDurationMs(
          Math.max(0, endedAt - startTime - getPausedMs(endedAt))
        )
      }
      setState("stopped")
    }
  }, [getPausedMs, recordedBlob, startTime, state])

  useEffect(() => {
    if (state !== "stopped") {
      setPreSubmitWarnings([])
      return
    }

    let isCancelled = false

    getDebuggerSubmissionInput()
      .then((debuggerInput) => {
        if (isCancelled) {
          return
        }

        setDebuggerSummary(debuggerInput.summary)
        setPreSubmitWarnings(debuggerInput.warnings)
      })
      .catch((error: unknown) => {
        reportNonFatalError(
          "Failed to inspect debugger data before bug report submission",
          error
        )
        if (isCancelled) {
          return
        }

        setDebuggerSummary(EMPTY_DEBUGGER_SUMMARY)
        setPreSubmitWarnings([
          "Could not validate debugger data before submitting.",
        ])
      })

    return () => {
      isCancelled = true
    }
  }, [getDebuggerSubmissionInput, state])

  useRecorderInit({
    onCaptureTypeChange: setCaptureType,
    onScreenshotLoaded: (blob) => {
      setScreenshotBlob(blob)
      setRecordedDurationMs(null)
      setState("stopped")
    },
    onStartRecording: handleStartCapture,
    onError: (err) => setSubmitError(err),
  })

  const handleReset = () => {
    resetCapture()
    setState("idle")
    setResultUrl("")
    setSubmitError(null)
    setSubmissionWarnings([])
    setPreSubmitWarnings([])
    setDebuggerSummary(EMPTY_DEBUGGER_SUMMARY)
    setRecordedDurationMs(null)
    setStartTime(null)
    clearDebuggerState().catch((error: unknown) => {
      reportNonFatalError("Failed to clear debugger state after reset", error)
    })
  }

  /**
   * The recorder stays suspended while reviewing, so finalize it here to get
   * the complete video rather than the preview snapshot taken at stop time.
   */
  const resolveSubmissionBlob = useCallback(async (): Promise<Blob | null> => {
    if (captureType !== "video") {
      return screenshotBlob
    }

    if (isPaused) {
      return (await stopCapture()) ?? recordedBlob
    }

    return recordedBlob
  }, [captureType, isPaused, recordedBlob, screenshotBlob, stopCapture])

  const resolveDurationMs = useCallback((): number => {
    if (captureType !== "video") {
      return 0
    }

    if (recordedDurationMs !== null) {
      return Math.max(0, recordedDurationMs)
    }

    return startTime ? Math.max(0, Date.now() - startTime - getPausedMs()) : 0
  }, [captureType, getPausedMs, recordedDurationMs, startTime])

  const handleSubmit = async (values: {
    title: string
    description: string
    priority: Priority
    isReportDetailActive: boolean
    testedFeature?: string
    testScenario?: string
    testCaseType?: TestCaseType
  }) => {
    const blob = await resolveSubmissionBlob()
    if (!blob || blob.size === 0) {
      setSubmitError("Capture data is missing. Please capture again.")
      setState("stopped")
      return
    }

    setState("submitting")
    setSubmitError(null)
    setSubmissionWarnings([])

    try {
      const durationMs = resolveDurationMs()
      const debuggerSubmission = await getDebuggerSubmissionInput()
      const captureContextSubmissionData =
        buildCaptureContextSubmissionData(captureContext)
      const warnings = [
        ...debuggerSubmission.warnings,
        ...captureContextSubmissionData.warnings,
      ]

      const result = await submitBugReportWithUploads({
        attachment: blob,
        attachmentType: captureType,
        roomId: values.isReportDetailActive
          ? roomsState.resolvedRoomId
          : undefined,
        testedFeature: normalizeOptionalText(
          values.testedFeature,
          TESTED_FEATURE_MAX_LENGTH
        ),
        testScenario: normalizeOptionalText(
          values.testScenario,
          TEST_SCENARIO_MAX_LENGTH
        ),
        testCaseType: values.testCaseType,
        title: normalizeOptionalText(values.title, 200),
        priority: values.priority,
        description: normalizeOptionalText(values.description, 3000),
        url: captureContextSubmissionData.normalizedUrl,
        metadata: {
          duration: formatDuration(durationMs),
          durationMs,
          pageTitle: captureContextSubmissionData.normalizedPageTitle,
        },
        deviceInfo: getDeviceInfo(),
        debuggerPayload: debuggerSubmission.payload,
        debuggerSummary: debuggerSubmission.summary,
      })

      if (debuggerSubmission.sessionId) {
        await discardDebuggerSession(debuggerSubmission.sessionId).catch(
          (error: unknown) => {
            reportNonFatalError(
              `Failed to discard debugger session ${debuggerSubmission.sessionId} after submission`,
              error
            )
          }
        )
      }

      setResultUrl(`${env.VITE_APP_URL}${result.shareUrl}`)
      setSubmissionWarnings(
        dedupeMessages([...warnings, ...(result.warnings ?? [])])
      )
      setState("success")
    } catch (error) {
      if (isUnauthorizedSubmissionError(error)) {
        const loginUrl = new URL("/login", env.VITE_APP_URL).toString()
        window.open(loginUrl, "_blank", "noopener,noreferrer")
      }
      setSubmitError(getSubmissionErrorMessage(error))
      setState("stopped")
    }
  }

  const activeBlob = captureType === "video" ? recordedBlob : screenshotBlob
  const suggestedTitle =
    captureContext.title?.trim() ||
    (captureType === "video" ? "Video bug report" : "Screenshot bug report")
  const previewUrl = useMemo(() => {
    if (!activeBlob) return null
    return URL.createObjectURL(activeBlob)
  }, [activeBlob])

  const error = captureError || submitError

  useEffect(() => {
    if (state === "recording") {
      const label = isPaused ? "Paused" : "Recording"
      document.title = `${label} ${formatDuration(duration)} - Crikket`
      return
    }

    document.title = "Crikket Bug Report"
  }, [duration, isPaused, state])

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-slate-50 to-slate-100/80 p-6 sm:p-8">
      <Card className="w-full max-w-3xl border-border/80 shadow-lg shadow-slate-950/5">
        <CardHeader className="gap-2 border-b bg-muted/20 text-left">
          <CardTitle className="flex items-center gap-2 text-xl sm:text-2xl">
            Crikket Bug Report
          </CardTitle>
          <CardDescription className="text-sm">
            {getStateDescription(state, isPaused, captureScope)}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6 px-6 py-6">
          {error ? (
            <div className="flex items-center gap-2 rounded-md bg-destructive/15 p-4 text-destructive">
              <AlertCircle className="h-4 w-4" />
              <span className="font-medium text-sm">{error}</span>
            </div>
          ) : null}

          {state === "idle" ? (
            <IdleStep
              captureScope={captureScope}
              onStartFullScreen={handleStartCapture}
            />
          ) : null}

          {state === "recording" ? (
            <RecordingStep
              duration={duration}
              isPaused={isPaused}
              onStopRecording={handleStopRecording}
              onTogglePause={handleTogglePause}
              pauseRecordingShortcut={shortcuts.pauseRecording}
              stopRecordingShortcut={shortcuts.stopRecording}
            />
          ) : null}

          {state === "stopped" || state === "submitting" ? (
            <FormStep
              canContinueRecording={captureType === "video" && isPaused}
              captureType={captureType}
              debuggerSummary={debuggerSummary}
              initialTitle={suggestedTitle}
              isLoadingRooms={roomsState.isLoading}
              isSubmitting={state === "submitting"}
              onCancel={handleReset}
              onContinueRecording={handleContinueRecording}
              onRoomChange={roomsState.selectRoom}
              onSubmit={handleSubmit}
              preSubmitWarnings={preSubmitWarnings}
              previewUrl={previewUrl}
              rooms={roomsState.rooms}
              roomsError={roomsState.error}
              selectedRoomId={roomsState.selectedRoomId}
              submitError={submitError}
              videoDurationMs={
                captureType === "video"
                  ? (recordedDurationMs ?? (duration > 0 ? duration : null))
                  : null
              }
            />
          ) : null}

          {state === "success" ? (
            <SuccessStep
              onClose={() => window.close()}
              onCopyLink={() => navigator.clipboard.writeText(resultUrl)}
              onOpenRecording={() => window.open(resultUrl, "_blank")}
              warnings={submissionWarnings}
            />
          ) : null}
        </CardContent>
      </Card>
    </div>
  )
}

export default App
