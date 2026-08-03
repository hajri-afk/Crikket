import { LayoutGrid } from "lucide-react"
import type { Metadata } from "next"

import type { RoomListItem } from "@/components/rooms/types"
import { client } from "@/utils/orpc"
import { getRequestErrorMessage } from "../settings/_lib/get-request-error-message"
import { RoomsManagement } from "./_components/rooms-management"

const META = {
  title: "Rooms",
  description: "Group bug reports per project you are testing",
}

export const metadata: Metadata = {
  title: META.title,
  description: META.description,
}

export default async function RoomsPage() {
  const roomsState = await client.room
    .list()
    .then((data) => ({ data, error: null as unknown }))
    .catch((error: unknown) => ({ data: [] as RoomListItem[], error }))

  return (
    <div className="flex flex-1 flex-col gap-5 pt-2 sm:gap-6">
      <div className="flex items-center gap-3">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary ring-1 ring-primary/15 sm:size-11">
          <LayoutGrid className="size-5" />
        </div>
        <div className="min-w-0">
          <h1 className="truncate font-bold text-xl tracking-tight sm:text-3xl">
            {META.title}
          </h1>
          <p className="mt-0.5 text-muted-foreground text-xs sm:text-sm">
            {META.description}
          </p>
        </div>
      </div>

      {roomsState.error ? (
        <p className="text-destructive text-sm">
          Failed to load rooms: {getRequestErrorMessage(roomsState.error)}
        </p>
      ) : null}

      <RoomsManagement initialRooms={roomsState.data} />
    </div>
  )
}
