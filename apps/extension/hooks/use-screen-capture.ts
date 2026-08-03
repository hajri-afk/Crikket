import type { RecordingPauseWindow } from "@crikket/capture-core/debugger/payload"
import { useCallback, useRef, useState } from "react"
import { readAndClearCaptureTabId } from "@/lib/capture-context"
import {
  type CaptureScope,
  requestScreenCaptureStream,
  requestTabCaptureStream,
} from "@/lib/display-media"

export interface UseScreenCaptureReturn {
  isRecording: boolean
  isPaused: boolean
  recordedBlob: Blob | null
  screenshotBlob: Blob | null
  error: string | null
  startRecording: (scope: CaptureScope) => Promise<boolean>
  pauseRecording: () => Promise<boolean>
  resumeRecording: () => boolean
  /**
   * Pauses without tearing down the stream and returns a playable snapshot of
   * everything captured so far. Lets the review screen show a preview while
   * keeping the recorder alive, so recording can be continued into the same
   * video instead of starting a second one.
   */
  suspendRecording: () => Promise<Blob | null>
  stopRecording: () => Promise<Blob | null>
  takeScreenshot: () => Promise<Blob | null>
  reset: () => void
  setRecordedBlob: (blob: Blob | null) => void
  setScreenshotBlob: (blob: Blob | null) => void
  /** Wall-clock windows where the recorder was paused, oldest first. */
  getPauseWindows: () => RecordingPauseWindow[]
  /** Total paused milliseconds so far, including an in-progress pause. */
  getPausedMs: (now?: number) => number
}

/**
 * Tab scope locks onto the tab the popup pinned, so no picker appears and only
 * the site under test is recorded. Screen scope defers to Chrome's picker.
 */
async function acquireStream(scope: CaptureScope): Promise<MediaStream> {
  if (scope === "screen") {
    try {
      return await requestScreenCaptureStream()
    } catch (error) {
      // Chrome reports both a dismissed picker and a blocked call as
      // NotAllowedError, so say what to do rather than guessing which it was.
      if (error instanceof DOMException && error.name === "NotAllowedError") {
        throw new Error(
          'No screen was shared. Click "Choose screen & start" again and pick a screen or window.'
        )
      }

      throw error
    }
  }

  const captureTabId = await readAndClearCaptureTabId()
  if (!captureTabId) {
    throw new Error(
      "Could not lock the source tab. Please start recording from the extension popup."
    )
  }

  return await requestTabCaptureStream(captureTabId)
}

export function useScreenCapture(): UseScreenCaptureReturn {
  const [isRecording, setIsRecording] = useState(false)
  const [isPaused, setIsPaused] = useState(false)
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null)
  const [screenshotBlob, setScreenshotBlob] = useState<Blob | null>(null)
  const [error, setError] = useState<string | null>(null)

  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const pauseWindowsRef = useRef<RecordingPauseWindow[]>([])

  /**
   * Closes an open pause window so paused time stops accumulating. Called on
   * resume and on stop, since stopping while paused still ends the pause.
   */
  const closeOpenPauseWindow = useCallback((closedAt: number) => {
    const openWindow = pauseWindowsRef.current.at(-1)
    if (openWindow && openWindow.resumedAt === null) {
      openWindow.resumedAt = closedAt
    }
  }, [])

  const getPauseWindows = useCallback(
    () => pauseWindowsRef.current.map((window) => ({ ...window })),
    []
  )

  const getPausedMs = useCallback((now: number = Date.now()) => {
    let paused = 0
    for (const window of pauseWindowsRef.current) {
      paused += (window.resumedAt ?? now) - window.pausedAt
    }
    return Math.max(0, Math.floor(paused))
  }, [])

  const startRecording = useCallback(
    async (scope: CaptureScope): Promise<boolean> => {
      try {
        setError(null)
        setRecordedBlob(null)
        setIsPaused(false)
        pauseWindowsRef.current = []

        const stream = await acquireStream(scope)

        streamRef.current = stream

        const mediaRecorder = new MediaRecorder(stream, {
          mimeType: "video/webm;codecs=vp9",
        })

        mediaRecorderRef.current = mediaRecorder
        chunksRef.current = []

        mediaRecorder.ondataavailable = (event) => {
          if (event.data.size > 0) {
            chunksRef.current.push(event.data)
          }
        }

        mediaRecorder.onstop = () => {
          closeOpenPauseWindow(Date.now())
          const blob = new Blob(chunksRef.current, { type: "video/webm" })
          setRecordedBlob(blob)
          setIsRecording(false)
          setIsPaused(false)

          for (const track of stream.getTracks()) {
            track.stop()
          }
        }
        stream.getVideoTracks()[0].onended = () => {
          // The user can end the share while paused, so treat both live states
          // as stoppable.
          const recorderState = mediaRecorderRef.current?.state
          if (recorderState === "recording" || recorderState === "paused") {
            mediaRecorderRef.current?.stop()
          }
        }

        mediaRecorder.start(1000)
        setIsRecording(true)
        return true
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Failed to start recording"
        setError(message)
        setIsRecording(false)
        setIsPaused(false)
        return false
      }
    },
    [closeOpenPauseWindow]
  )

  /**
   * Flushes the in-flight timeslice, then pauses. Without the flush up to one
   * second of tail stays buffered in the encoder and would be missing from any
   * preview built while paused.
   */
  const flushAndPause = useCallback((): Promise<Blob | null> => {
    return new Promise((resolve) => {
      const recorder = mediaRecorderRef.current
      if (recorder?.state !== "recording") {
        resolve(null)
        return
      }

      const handleData = (event: BlobEvent) => {
        recorder.removeEventListener("dataavailable", handleData)

        // `ondataavailable` may or may not have run first depending on
        // listener order, so only push a chunk we have not already stored.
        if (event.data.size > 0 && chunksRef.current.at(-1) !== event.data) {
          chunksRef.current.push(event.data)
        }

        recorder.pause()
        pauseWindowsRef.current.push({ pausedAt: Date.now(), resumedAt: null })
        setIsPaused(true)
        resolve(new Blob(chunksRef.current, { type: "video/webm" }))
      }

      recorder.addEventListener("dataavailable", handleData)
      recorder.requestData()
    })
  }, [])

  const pauseRecording = useCallback(async (): Promise<boolean> => {
    const blob = await flushAndPause()
    return blob !== null
  }, [flushAndPause])

  const resumeRecording = useCallback((): boolean => {
    const recorder = mediaRecorderRef.current
    if (recorder?.state !== "paused") {
      return false
    }

    recorder.resume()
    closeOpenPauseWindow(Date.now())
    setIsPaused(false)
    return true
  }, [closeOpenPauseWindow])

  const suspendRecording = useCallback(async (): Promise<Blob | null> => {
    // Already paused from the recording screen, where the tail was flushed
    // when the pause started, so the stored chunks are the whole preview.
    if (mediaRecorderRef.current?.state === "paused") {
      return new Blob(chunksRef.current, { type: "video/webm" })
    }

    return await flushAndPause()
  }, [flushAndPause])

  const stopRecording = useCallback((): Promise<Blob | null> => {
    return new Promise((resolve) => {
      const recorder = mediaRecorderRef.current
      if (
        !recorder ||
        (recorder.state !== "recording" && recorder.state !== "paused")
      ) {
        resolve(null)
        return
      }

      recorder.onstop = () => {
        closeOpenPauseWindow(Date.now())
        const blob = new Blob(chunksRef.current, { type: "video/webm" })
        setRecordedBlob(blob)
        setIsRecording(false)
        setIsPaused(false)

        if (streamRef.current) {
          for (const track of streamRef.current.getTracks()) {
            track.stop()
          }
        }

        resolve(blob)
      }

      recorder.stop()
    })
  }, [closeOpenPauseWindow])

  const takeScreenshot = useCallback(async (): Promise<Blob | null> => {
    try {
      setError(null)
      setScreenshotBlob(null)

      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          displaySurface: "browser",
        },
        audio: false,
      })

      const videoTrack = stream.getVideoTracks()[0]
      const settings = videoTrack.getSettings()

      const video = document.createElement("video")
      video.srcObject = stream
      video.autoplay = true

      await new Promise<void>((resolve) => {
        video.onloadedmetadata = () => {
          video.play()
          resolve()
        }
      })

      await new Promise((resolve) => setTimeout(resolve, 100))

      const canvas = document.createElement("canvas")
      canvas.width = settings.width || video.videoWidth
      canvas.height = settings.height || video.videoHeight

      const ctx = canvas.getContext("2d")
      if (!ctx) {
        throw new Error("Could not get canvas context")
      }

      ctx.drawImage(video, 0, 0)

      for (const track of stream.getTracks()) {
        track.stop()
      }
      return new Promise((resolve) => {
        canvas.toBlob((blob) => {
          setScreenshotBlob(blob)
          resolve(blob)
        }, "image/png")
      })
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to take screenshot"
      setError(message)
      return null
    }
  }, [])

  const reset = useCallback(() => {
    setRecordedBlob(null)
    setScreenshotBlob(null)
    setError(null)
    setIsRecording(false)
    setIsPaused(false)
    pauseWindowsRef.current = []

    const recorderState = mediaRecorderRef.current?.state
    if (recorderState === "recording" || recorderState === "paused") {
      mediaRecorderRef.current?.stop()
    }
    if (streamRef.current) {
      for (const track of streamRef.current.getTracks()) {
        track.stop()
      }
    }
  }, [])

  return {
    isRecording,
    isPaused,
    recordedBlob,
    screenshotBlob,
    error,
    startRecording,
    pauseRecording,
    resumeRecording,
    suspendRecording,
    stopRecording,
    takeScreenshot,
    reset,
    setRecordedBlob,
    setScreenshotBlob,
    getPauseWindows,
    getPausedMs,
  }
}
