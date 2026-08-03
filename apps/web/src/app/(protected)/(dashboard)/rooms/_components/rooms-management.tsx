"use client"

import {
  DEFAULT_ROOM_COLOR,
  isRoomColor,
  ROOM_STATUS_OPTIONS,
} from "@crikket/shared/constants/room"
import { ConfirmationDialog } from "@crikket/ui/components/dialogs/confirmation-dialog"
import { Button } from "@crikket/ui/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@crikket/ui/components/ui/dialog"
import { Input } from "@crikket/ui/components/ui/input"
import { Skeleton } from "@crikket/ui/components/ui/skeleton"
import { cn } from "@crikket/ui/lib/utils"
import { LayoutGrid, Plus, Search, SearchX, X } from "lucide-react"
import { useMemo, useState } from "react"

import type { RoomListItem } from "@/components/rooms/types"
import { useRoomActions } from "@/components/rooms/use-room-actions"
import { useRooms } from "@/components/rooms/use-rooms"
import { RoomCard } from "./room-card"
import { RoomForm } from "./room-form"

type RoomsView = "active" | "archived" | "all"

const SKELETON_KEYS = ["r1", "r2", "r3", "r4"]

interface RoomsManagementProps {
  initialRooms: RoomListItem[]
}

export function RoomsManagement({ initialRooms }: RoomsManagementProps) {
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [editingRoom, setEditingRoom] = useState<RoomListItem | null>(null)
  const [deletingRoom, setDeletingRoom] = useState<RoomListItem | null>(null)
  const [view, setView] = useState<RoomsView>("active")
  const [search, setSearch] = useState("")

  const { rooms, isLoading } = useRooms({
    includeArchived: true,
    initialData: initialRooms,
  })
  const { createMutation, deleteMutation, updateMutation } = useRoomActions()

  const isMutating =
    createMutation.isPending ||
    updateMutation.isPending ||
    deleteMutation.isPending

  const counts = useMemo(() => {
    const active = rooms.filter(
      (room) => room.status === ROOM_STATUS_OPTIONS.active
    )
    const archived = rooms.filter(
      (room) => room.status === ROOM_STATUS_OPTIONS.archived
    )

    return {
      active: active.length,
      all: rooms.length,
      archived: archived.length,
      openReports: rooms.reduce(
        (total, room) => total + room.openReportCount,
        0
      ),
      totalReports: rooms.reduce((total, room) => total + room.reportCount, 0),
    }
  }, [rooms])

  const visibleRooms = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase()

    return rooms
      .filter((room) => {
        if (view === "active") {
          return room.status === ROOM_STATUS_OPTIONS.active
        }

        if (view === "archived") {
          return room.status === ROOM_STATUS_OPTIONS.archived
        }

        return true
      })
      .filter((room) => {
        if (!normalizedSearch) {
          return true
        }

        return (
          room.name.toLowerCase().includes(normalizedSearch) ||
          room.slug.toLowerCase().includes(normalizedSearch) ||
          (room.description ?? "").toLowerCase().includes(normalizedSearch)
        )
      })
  }, [rooms, search, view])

  const handleToggleArchive = async (room: RoomListItem) => {
    await updateMutation.mutateAsync({
      roomId: room.id,
      status:
        room.status === ROOM_STATUS_OPTIONS.archived
          ? ROOM_STATUS_OPTIONS.active
          : ROOM_STATUS_OPTIONS.archived,
    })
  }

  const hasNoRoomsAtAll = !isLoading && rooms.length === 0
  const isFilteredEmpty =
    !isLoading && rooms.length > 0 && visibleRooms.length === 0

  return (
    <div className="space-y-5">
      {rooms.length > 0 ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <SummaryTile label="Rooms" value={counts.active} />
          <SummaryTile label="Archived" value={counts.archived} />
          <SummaryTile label="Reports" value={counts.totalReports} />
          <SummaryTile label="Open" tone="warning" value={counts.openReports} />
        </div>
      ) : null}

      <div className="flex flex-col gap-3 rounded-xl border bg-card p-3 shadow-xs lg:flex-row lg:items-center lg:justify-between">
        <div className="relative w-full lg:max-w-xs">
          <Search className="pointer-events-none absolute top-2.5 left-2.5 size-4 text-muted-foreground" />
          <Input
            className="pl-9"
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search rooms..."
            value={search}
          />
          {search ? (
            <button
              aria-label="Clear search"
              className="absolute top-2.5 right-2.5 text-muted-foreground transition-colors hover:text-foreground"
              onClick={() => setSearch("")}
              type="button"
            >
              <X className="size-4" />
            </button>
          ) : null}
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <div className="flex w-full rounded-lg border bg-muted/40 p-0.5 sm:w-auto">
            <ViewTab
              count={counts.active}
              isActive={view === "active"}
              label="Active"
              onSelect={() => setView("active")}
            />
            <ViewTab
              count={counts.archived}
              isActive={view === "archived"}
              label="Archived"
              onSelect={() => setView("archived")}
            />
            <ViewTab
              count={counts.all}
              isActive={view === "all"}
              label="All"
              onSelect={() => setView("all")}
            />
          </div>

          <Button
            className="w-full sm:w-auto"
            onClick={() => setIsCreateOpen(true)}
            type="button"
          >
            <Plus className="size-4" />
            New room
          </Button>
        </div>
      </div>

      {isLoading && rooms.length === 0 ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {SKELETON_KEYS.map((key) => (
            <div className="space-y-3 rounded-xl border bg-card p-4" key={key}>
              <div className="flex items-center gap-3">
                <Skeleton className="size-10 rounded-xl" />
                <div className="flex-1 space-y-1.5">
                  <Skeleton className="h-4 w-2/3" />
                  <Skeleton className="h-3 w-1/3" />
                </div>
              </div>
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-1.5 w-full rounded-full" />
              <Skeleton className="h-3 w-1/2" />
            </div>
          ))}
        </div>
      ) : null}

      {hasNoRoomsAtAll ? (
        <div className="flex flex-col items-center justify-center gap-4 rounded-xl border border-dashed bg-card/50 px-6 py-14 text-center sm:py-20">
          <div className="flex size-16 items-center justify-center rounded-2xl bg-primary/10 text-primary ring-1 ring-primary/15">
            <LayoutGrid className="size-8" />
          </div>
          <div>
            <h2 className="font-semibold text-lg sm:text-xl">No rooms yet</h2>
            <p className="mx-auto mt-2 max-w-sm text-muted-foreground text-sm">
              Create one room per project. When you record with the Crikket
              extension, pick the room and the capture lands there
              automatically.
            </p>
          </div>
          <Button
            className="w-full sm:w-auto"
            onClick={() => setIsCreateOpen(true)}
            type="button"
          >
            <Plus className="size-4" />
            Create your first room
          </Button>
        </div>
      ) : null}

      {isFilteredEmpty ? (
        <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed bg-card/50 px-6 py-12 text-center">
          <div className="flex size-12 items-center justify-center rounded-xl bg-muted text-muted-foreground">
            <SearchX className="size-6" />
          </div>
          <p className="font-medium text-sm">No rooms match this view</p>
          <Button
            onClick={() => {
              setSearch("")
              setView("all")
            }}
            size="sm"
            variant="outline"
          >
            Reset filters
          </Button>
        </div>
      ) : null}

      {visibleRooms.length > 0 ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {visibleRooms.map((room) => (
            <RoomCard
              isMutating={isMutating}
              key={room.id}
              onEdit={() => setEditingRoom(room)}
              onRequestDelete={() => setDeletingRoom(room)}
              onToggleArchive={() => handleToggleArchive(room)}
              room={room}
            />
          ))}
        </div>
      ) : null}

      <Dialog onOpenChange={setIsCreateOpen} open={isCreateOpen}>
        <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Create room</DialogTitle>
            <DialogDescription>
              Rooms group bug reports per project so every recording lands in
              the right place.
            </DialogDescription>
          </DialogHeader>
          <RoomForm
            isPending={createMutation.isPending}
            onCancel={() => setIsCreateOpen(false)}
            onSubmit={async (input) => {
              await createMutation.mutateAsync({
                color: input.color,
                description: input.description || undefined,
                name: input.name,
              })
              setIsCreateOpen(false)
            }}
            submitLabel="Create room"
            submittingLabel="Creating..."
          />
        </DialogContent>
      </Dialog>

      <Dialog
        onOpenChange={(open) => {
          if (!open) {
            setEditingRoom(null)
          }
        }}
        open={editingRoom !== null}
      >
        <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit room</DialogTitle>
            <DialogDescription>
              Rename the room, change its description, or pick another color.
            </DialogDescription>
          </DialogHeader>
          {editingRoom ? (
            <RoomForm
              defaultValues={{
                color: isRoomColor(editingRoom.color)
                  ? editingRoom.color
                  : DEFAULT_ROOM_COLOR,
                description: editingRoom.description ?? "",
                name: editingRoom.name,
              }}
              isPending={updateMutation.isPending}
              onCancel={() => setEditingRoom(null)}
              onSubmit={async (input) => {
                await updateMutation.mutateAsync({
                  color: input.color,
                  description: input.description || null,
                  name: input.name,
                  roomId: editingRoom.id,
                })
                setEditingRoom(null)
              }}
              submitLabel="Save changes"
              submittingLabel="Saving..."
            />
          ) : null}
        </DialogContent>
      </Dialog>

      <ConfirmationDialog
        confirmText="Delete room"
        description={
          deletingRoom && deletingRoom.reportCount > 0
            ? `"${deletingRoom.name}" still holds ${deletingRoom.reportCount} report(s). The reports are kept and moved to Unassigned.`
            : "This room will be removed. Bug reports are never deleted with a room."
        }
        isLoading={deleteMutation.isPending}
        onConfirm={async () => {
          if (!deletingRoom) {
            return
          }

          await deleteMutation.mutateAsync({ roomId: deletingRoom.id })
          setDeletingRoom(null)
        }}
        onOpenChange={(open) => {
          if (!open) {
            setDeletingRoom(null)
          }
        }}
        open={deletingRoom !== null}
        title={
          deletingRoom ? `Delete "${deletingRoom.name}"?` : "Delete this room?"
        }
        variant="destructive"
      />
    </div>
  )
}

function SummaryTile({
  label,
  value,
  tone = "default",
}: {
  label: string
  value: number
  tone?: "default" | "warning"
}) {
  return (
    <div className="rounded-xl border bg-card p-3 shadow-xs">
      <p className="text-muted-foreground text-xs">{label}</p>
      <p
        className={cn(
          "mt-1 font-semibold text-xl tabular-nums",
          tone === "warning" && "text-amber-600 dark:text-amber-400"
        )}
      >
        {value}
      </p>
    </div>
  )
}

function ViewTab({
  count,
  isActive,
  label,
  onSelect,
}: {
  count: number
  isActive: boolean
  label: string
  onSelect: () => void
}) {
  return (
    <button
      className={cn(
        "flex flex-1 items-center justify-center gap-1.5 rounded-md px-3 py-1.5 font-medium text-xs transition-all sm:flex-none",
        isActive
          ? "bg-background text-foreground shadow-xs"
          : "text-muted-foreground hover:text-foreground"
      )}
      onClick={onSelect}
      type="button"
    >
      {label}
      <span className="rounded bg-muted px-1 text-[10px] tabular-nums">
        {count}
      </span>
    </button>
  )
}
