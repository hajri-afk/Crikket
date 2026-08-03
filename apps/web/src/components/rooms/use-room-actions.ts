"use client"

import type { RoomColor, RoomStatus } from "@crikket/shared/constants/room"
import { useMutation } from "@tanstack/react-query"
import { toast } from "sonner"

import { client, queryClient } from "@/utils/orpc"

export function useRoomActions() {
  const createMutation = useMutation({
    mutationFn: async (input: {
      name: string
      description?: string
      color?: RoomColor
    }) => client.room.create(input),
    onSuccess: async (room) => {
      await queryClient.invalidateQueries()
      toast.success(`Room "${room.name}" created`)
    },
    onError: (error) => {
      toast.error(error.message || "Failed to create room")
    },
  })

  const updateMutation = useMutation({
    mutationFn: async (input: {
      roomId: string
      name?: string
      description?: string | null
      color?: RoomColor
      status?: RoomStatus
    }) => client.room.update(input),
    onSuccess: async () => {
      await queryClient.invalidateQueries()
      toast.success("Room updated")
    },
    onError: (error) => {
      toast.error(error.message || "Failed to update room")
    },
  })

  const deleteMutation = useMutation({
    mutationFn: async (input: { roomId: string }) => client.room.delete(input),
    onSuccess: async (result) => {
      await queryClient.invalidateQueries()
      toast.success(
        result.releasedReportCount > 0
          ? `Room deleted. ${result.releasedReportCount} report(s) moved to Unassigned.`
          : "Room deleted"
      )
    },
    onError: (error) => {
      toast.error(error.message || "Failed to delete room")
    },
  })

  const assignReportsMutation = useMutation({
    mutationFn: async (input: { reportIds: string[]; roomId: string | null }) =>
      client.room.assignReports(input),
    onSuccess: async (result) => {
      await queryClient.invalidateQueries()
      toast.success(`Moved ${result.updatedCount} report(s)`)
    },
    onError: (error) => {
      toast.error(error.message || "Failed to move reports")
    },
  })

  return {
    assignReportsMutation,
    createMutation,
    deleteMutation,
    updateMutation,
  }
}
