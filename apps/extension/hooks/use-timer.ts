import { useEffect, useState } from "react"

/**
 * Elapsed recording time in ms. `getPausedMs` lets the caller subtract time
 * spent paused, so the timer matches the length of the produced video instead
 * of wall-clock time since the recording started.
 */
export function useTimer(
  startTime: number | null,
  isRunning: boolean,
  getPausedMs?: (now: number) => number
) {
  const [duration, setDuration] = useState(0)

  useEffect(() => {
    let interval: NodeJS.Timeout
    if (isRunning && startTime) {
      interval = setInterval(() => {
        const now = Date.now()
        const pausedMs = getPausedMs?.(now) ?? 0
        setDuration(Math.max(0, now - startTime - pausedMs))
      }, 100)
    }
    return () => clearInterval(interval)
  }, [getPausedMs, isRunning, startTime])

  return duration
}
