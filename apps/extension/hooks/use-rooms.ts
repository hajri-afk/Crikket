import type { AppRouterClient } from "@crikket/api/routers/index"
import { reportNonFatalError } from "@crikket/shared/lib/errors"
import { useCallback, useEffect, useState } from "react"
import { client } from "@/lib/orpc"

export type ExtensionRoom = Awaited<
  ReturnType<AppRouterClient["room"]["list"]>
>[number]

/** Remembers the room used for the previous capture. */
const LAST_ROOM_STORAGE_KEY = "crikket:last-room-id"

/** Select value used when a capture should not belong to any room. */
export const NO_ROOM_VALUE = "__none__"

async function readLastRoomId(): Promise<string | null> {
  try {
    const stored = await chrome.storage.local.get([LAST_ROOM_STORAGE_KEY])
    const value = stored[LAST_ROOM_STORAGE_KEY]
    return typeof value === "string" && value.length > 0 ? value : null
  } catch {
    return null
  }
}

async function writeLastRoomId(roomId: string | null): Promise<void> {
  try {
    if (roomId) {
      await chrome.storage.local.set({ [LAST_ROOM_STORAGE_KEY]: roomId })
      return
    }

    await chrome.storage.local.remove([LAST_ROOM_STORAGE_KEY])
  } catch (error) {
    reportNonFatalError("Failed to persist the last used room", error)
  }
}

/**
 * Loads the active organization's rooms so a recording can be filed into the
 * right project right from the recorder form. Signed-out users simply get an
 * empty list and submit without a room.
 */
export function useRooms() {
  const [rooms, setRooms] = useState<ExtensionRoom[]>([])
  const [selectedRoomId, setSelectedRoomId] = useState<string>(NO_ROOM_VALUE)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let isCancelled = false

    const load = async () => {
      try {
        const [availableRooms, lastRoomId] = await Promise.all([
          client.room.list(),
          readLastRoomId(),
        ])

        if (isCancelled) {
          return
        }

        setRooms(availableRooms)
        setError(null)

        const isLastRoomAvailable = availableRooms.some(
          (room) => room.id === lastRoomId
        )
        setSelectedRoomId(
          isLastRoomAvailable && lastRoomId ? lastRoomId : NO_ROOM_VALUE
        )
      } catch (loadError) {
        if (isCancelled) {
          return
        }

        reportNonFatalError("Failed to load rooms for the capture", loadError)
        setRooms([])
        setError(
          "Could not load rooms. Sign in to the dashboard, then reopen — the report is still submitted without a room."
        )
      } finally {
        if (!isCancelled) {
          setIsLoading(false)
        }
      }
    }

    load()

    return () => {
      isCancelled = true
    }
  }, [])

  // Keeps the popup and the recorder tab in sync: picking a room in one surface
  // immediately updates the other.
  useEffect(() => {
    const handleStorageChange = (
      changes: Record<string, chrome.storage.StorageChange>,
      areaName: string
    ) => {
      if (areaName !== "local" || !(LAST_ROOM_STORAGE_KEY in changes)) {
        return
      }

      const nextValue = changes[LAST_ROOM_STORAGE_KEY]?.newValue
      setSelectedRoomId(
        typeof nextValue === "string" && nextValue.length > 0
          ? nextValue
          : NO_ROOM_VALUE
      )
    }

    chrome.storage.onChanged.addListener(handleStorageChange)

    return () => {
      chrome.storage.onChanged.removeListener(handleStorageChange)
    }
  }, [])

  const selectRoom = useCallback((roomId: string) => {
    setSelectedRoomId(roomId)
    writeLastRoomId(roomId === NO_ROOM_VALUE ? null : roomId)
  }, [])

  return {
    error,
    isLoading,
    /** `undefined` when the capture should not be filed into a room. */
    resolvedRoomId:
      selectedRoomId === NO_ROOM_VALUE ? undefined : selectedRoomId,
    rooms,
    selectedRoomId,
    selectRoom,
  }
}
