import { env } from "@crikket/env/extension"
import { reportNonFatalError } from "@crikket/shared/lib/errors"
import { Button } from "@crikket/ui/components/ui/button"
import { Field, FieldLabel } from "@crikket/ui/components/ui/field"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@crikket/ui/components/ui/select"
import { getRoomColorClasses } from "@crikket/ui/lib/room-colors"
import { cn } from "@crikket/ui/lib/utils"
import { ExternalLink, LayoutGrid } from "lucide-react"

import { NO_ROOM_VALUE } from "@/hooks/use-rooms"

export interface RoomPickerOption {
  id: string
  name: string
  color: string
}

interface RoomPickerProps {
  /** Rendered above the control; omit to hide the label row. */
  label?: string
  helperText?: string
  isDisabled?: boolean
  isLoading: boolean
  error: string | null
  rooms: RoomPickerOption[]
  selectedRoomId: string
  onSelect: (roomId: string) => void
  /**
   * Only the popup may close itself after opening the dashboard. Closing the
   * recorder tab would discard a capture that has not been submitted yet.
   */
  closeWindowAfterDashboard?: boolean
}

async function openRoomsDashboard(closeWindow: boolean): Promise<void> {
  try {
    await chrome.tabs.create({ url: `${env.VITE_APP_URL}/rooms` })
    if (closeWindow) {
      window.close()
    }
  } catch (error: unknown) {
    reportNonFatalError("Failed to open the rooms dashboard", error)
  }
}

export function RoomDot({
  color,
  className,
}: {
  color?: string
  className?: string
}) {
  return (
    <span
      className={cn(
        "size-2 shrink-0 rounded-full",
        color ? getRoomColorClasses(color).dot : "bg-muted-foreground/40",
        className
      )}
    />
  )
}

/**
 * Lets the reporter pick the destination room before or after capturing, so a
 * report never has to be moved by hand afterwards.
 */
export function RoomPicker({
  label = "Save to room",
  helperText,
  isDisabled = false,
  isLoading,
  error,
  rooms,
  selectedRoomId,
  onSelect,
  closeWindowAfterDashboard = false,
}: RoomPickerProps) {
  const selectedRoom =
    selectedRoomId === NO_ROOM_VALUE
      ? null
      : (rooms.find((room) => room.id === selectedRoomId) ?? null)
  const hasNoRooms = !(isLoading || error) && rooms.length === 0

  return (
    <Field>
      {label ? (
        <FieldLabel htmlFor="room">
          <LayoutGrid className="size-3.5" />
          {label}
        </FieldLabel>
      ) : null}

      <Select
        disabled={isDisabled || isLoading || hasNoRooms}
        onValueChange={(value) => {
          if (value) {
            onSelect(value)
          }
        }}
        value={selectedRoomId}
      >
        <SelectTrigger className="w-full" id="room">
          <SelectValue>
            <span className="flex min-w-0 items-center gap-2">
              <RoomDot color={selectedRoom?.color} />
              <span className="truncate">
                {selectedRoom?.name ?? "No room"}
              </span>
            </span>
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={NO_ROOM_VALUE}>
            <span className="flex items-center gap-2">
              <RoomDot />
              No room
            </span>
          </SelectItem>
          {rooms.map((room) => (
            <SelectItem key={room.id} value={room.id}>
              <span className="flex min-w-0 items-center gap-2">
                <RoomDot color={room.color} />
                <span className="truncate">{room.name}</span>
              </span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {hasNoRooms ? (
        <Button
          className="h-auto justify-start p-0 text-xs"
          onClick={() => openRoomsDashboard(closeWindowAfterDashboard)}
          size="sm"
          type="button"
          variant="link"
        >
          Create your first room
          <ExternalLink className="size-3" />
        </Button>
      ) : (
        <p
          className={cn(
            "text-xs",
            error ? "text-amber-600" : "text-muted-foreground"
          )}
        >
          {isLoading
            ? "Loading rooms..."
            : (error ??
              helperText ??
              "This report lands in the selected project room.")}
        </p>
      )}
    </Field>
  )
}
