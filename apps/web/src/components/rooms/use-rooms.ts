"use client"

import { ROOM_STATUS_OPTIONS } from "@crikket/shared/constants/room"
import { useQuery } from "@tanstack/react-query"
import { useMemo } from "react"

import { orpc } from "@/utils/orpc"
import type { RoomListItem } from "./types"

interface UseRoomsInput {
  initialData?: RoomListItem[]
  /** Archived rooms stay visible on the rooms page but not in pickers. */
  includeArchived?: boolean
}

export function useRooms(input?: UseRoomsInput) {
  const query = useQuery({
    ...orpc.room.list.queryOptions(),
    initialData: input?.initialData,
  })

  const rooms = useMemo(() => query.data ?? [], [query.data])

  const visibleRooms = useMemo(
    () =>
      input?.includeArchived
        ? rooms
        : rooms.filter((room) => room.status === ROOM_STATUS_OPTIONS.active),
    [input?.includeArchived, rooms]
  )

  return {
    ...query,
    rooms,
    visibleRooms,
  }
}
