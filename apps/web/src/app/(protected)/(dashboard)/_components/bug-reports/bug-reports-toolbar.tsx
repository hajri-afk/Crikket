"use client"

import type {
  BugReportSort,
  BugReportStatus,
  BugReportVisibility,
} from "@crikket/shared/constants/bug-report"
import type { Priority } from "@crikket/shared/constants/priorities"
import { UNASSIGNED_ROOM_FILTER_VALUE } from "@crikket/shared/constants/room"
import { Button } from "@crikket/ui/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@crikket/ui/components/ui/dropdown-menu"
import { Input } from "@crikket/ui/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@crikket/ui/components/ui/select"
import { cn } from "@crikket/ui/lib/utils"
import {
  Filter,
  LayoutGrid,
  Search,
  Shield,
  Tag,
  TriangleAlert,
  UserRound,
} from "lucide-react"
import type { ReactNode } from "react"

import { useRooms } from "@/components/rooms/use-rooms"
import { getRoomColorClasses } from "@/lib/rooms"
import {
  type DashboardFilters,
  formatPriorityLabel,
  formatStatusLabel,
  formatVisibilityLabel,
  PRIORITY_FILTER_OPTIONS,
  SORT_OPTIONS,
  STATUS_OPTIONS,
  VISIBILITY_OPTIONS,
} from "./filters"
import type { BugReportStats } from "./types"

interface BugReportsToolbarProps {
  search: string
  sort: BugReportSort
  filters: DashboardFilters
  stats?: BugReportStats
  /** Hides the room filter when the list is already scoped to one room. */
  isRoomLocked?: boolean
  onSearchChange: (value: string) => void
  onSortChange: (value: BugReportSort) => void
  onToggleStatus: (value: BugReportStatus) => void
  onTogglePriority: (value: Priority) => void
  onToggleVisibility: (value: BugReportVisibility) => void
  onToggleRoom: (value: string) => void
  onClearFilters: () => void
}

function countActiveFilters(
  filters: DashboardFilters,
  isRoomLocked: boolean
): number {
  return (
    filters.statuses.length +
    filters.priorities.length +
    filters.visibilities.length +
    (isRoomLocked ? 0 : filters.rooms.length)
  )
}

export function BugReportsToolbar({
  search,
  sort,
  filters,
  stats,
  isRoomLocked = false,
  onSearchChange,
  onSortChange,
  onToggleStatus,
  onTogglePriority,
  onToggleVisibility,
  onToggleRoom,
  onClearFilters,
}: BugReportsToolbarProps) {
  const activeFilters = countActiveFilters(filters, isRoomLocked)
  const selectedSortLabel =
    SORT_OPTIONS.find((option) => option.value === sort)?.label ?? "Sort"
  const { visibleRooms } = useRooms()
  const selectedRooms = isRoomLocked ? [] : filters.rooms

  return (
    <div className="space-y-3 rounded-xl border bg-card p-3 shadow-sm">
      <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
        <div className="relative w-full lg:max-w-sm">
          <Search className="pointer-events-none absolute top-2.5 left-2.5 size-4 text-muted-foreground" />
          <Input
            className="pl-9"
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder="Search title, description, or URL"
            value={search}
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Select
            onValueChange={(value) => onSortChange(value as BugReportSort)}
            value={sort}
          >
            <SelectTrigger className="w-[200px]">
              <SelectValue>{selectedSortLabel}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              {SORT_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button size="sm" variant="outline">
                  <Filter className="size-4" />
                  Filters
                  {activeFilters > 0 ? ` (${activeFilters})` : ""}
                </Button>
              }
            />
            <DropdownMenuContent align="end" className="w-64">
              {isRoomLocked ? null : (
                <>
                  <DropdownMenuGroup>
                    <DropdownMenuLabel>Room</DropdownMenuLabel>
                    <DropdownMenuCheckboxItem
                      checked={selectedRooms.includes(
                        UNASSIGNED_ROOM_FILTER_VALUE
                      )}
                      onCheckedChange={() =>
                        onToggleRoom(UNASSIGNED_ROOM_FILTER_VALUE)
                      }
                    >
                      Unassigned
                    </DropdownMenuCheckboxItem>
                    {visibleRooms.map((room) => (
                      <DropdownMenuCheckboxItem
                        checked={selectedRooms.includes(room.id)}
                        key={room.id}
                        onCheckedChange={() => onToggleRoom(room.id)}
                      >
                        <span className="flex items-center gap-2">
                          <span
                            className={cn(
                              "size-1.5 rounded-full",
                              getRoomColorClasses(room.color).dot
                            )}
                          />
                          {room.name}
                        </span>
                      </DropdownMenuCheckboxItem>
                    ))}
                    {visibleRooms.length === 0 ? (
                      <p className="px-2 py-1.5 text-muted-foreground text-xs">
                        No rooms yet. Create one from the Rooms page.
                      </p>
                    ) : null}
                  </DropdownMenuGroup>
                  <DropdownMenuSeparator />
                </>
              )}
              <DropdownMenuGroup>
                <DropdownMenuLabel>Status</DropdownMenuLabel>
                {STATUS_OPTIONS.map((status) => (
                  <DropdownMenuCheckboxItem
                    checked={filters.statuses.includes(status.value)}
                    key={status.value}
                    onCheckedChange={() => onToggleStatus(status.value)}
                  >
                    {status.label}
                  </DropdownMenuCheckboxItem>
                ))}
              </DropdownMenuGroup>
              <DropdownMenuSeparator />
              <DropdownMenuGroup>
                <DropdownMenuLabel>Priority</DropdownMenuLabel>
                {PRIORITY_FILTER_OPTIONS.map((priority) => (
                  <DropdownMenuCheckboxItem
                    checked={filters.priorities.includes(priority.value)}
                    key={priority.value}
                    onCheckedChange={() => onTogglePriority(priority.value)}
                  >
                    {priority.label}
                  </DropdownMenuCheckboxItem>
                ))}
              </DropdownMenuGroup>
              <DropdownMenuSeparator />
              <DropdownMenuGroup>
                <DropdownMenuLabel>Visibility</DropdownMenuLabel>
                {VISIBILITY_OPTIONS.map((visibility) => (
                  <DropdownMenuCheckboxItem
                    checked={filters.visibilities.includes(visibility.value)}
                    key={visibility.value}
                    onCheckedChange={() => onToggleVisibility(visibility.value)}
                  >
                    {visibility.label}
                  </DropdownMenuCheckboxItem>
                ))}
              </DropdownMenuGroup>
            </DropdownMenuContent>
          </DropdownMenu>

          <Button
            disabled={activeFilters === 0}
            onClick={onClearFilters}
            size="sm"
            variant="ghost"
          >
            Clear filters
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <StatChip
          accent="bg-amber-500/10 text-amber-600 dark:text-amber-400"
          icon={<TriangleAlert className="size-3.5" />}
          label="Open"
          value={stats?.open ?? 0}
        />
        <StatChip
          accent="bg-blue-500/10 text-blue-600 dark:text-blue-400"
          icon={<Shield className="size-3.5" />}
          label="Untriaged"
          value={stats?.untriaged ?? 0}
        />
        <StatChip
          accent="bg-primary/10 text-primary"
          icon={<UserRound className="size-3.5" />}
          label="Mine"
          value={stats?.mine ?? 0}
        />
        {isRoomLocked ? null : (
          <StatChip
            accent="bg-violet-500/10 text-violet-600 dark:text-violet-400"
            icon={<LayoutGrid className="size-3.5" />}
            label="Unassigned"
            value={stats?.unassigned ?? 0}
          />
        )}
        <StatChip
          accent="bg-muted text-muted-foreground"
          icon={<Tag className="size-3.5" />}
          label="Total"
          value={stats?.total ?? 0}
        />
        {selectedRooms.map((roomValue) => (
          <Pill key={roomValue}>
            {roomValue === UNASSIGNED_ROOM_FILTER_VALUE
              ? "Unassigned"
              : (visibleRooms.find((room) => room.id === roomValue)?.name ??
                "Room")}
          </Pill>
        ))}
        {filters.statuses.map((status) => (
          <Pill key={status}>{formatStatusLabel(status)}</Pill>
        ))}
        {filters.priorities.map((priority) => (
          <Pill key={priority}>{formatPriorityLabel(priority)}</Pill>
        ))}
        {filters.visibilities.map((visibility) => (
          <Pill key={visibility}>{formatVisibilityLabel(visibility)}</Pill>
        ))}
      </div>
    </div>
  )
}

function StatChip({
  icon,
  label,
  value,
  accent,
}: {
  icon: ReactNode
  label: string
  value: number
  accent: string
}) {
  return (
    <span className="inline-flex items-center gap-2 rounded-lg border bg-background px-2.5 py-1.5 text-xs shadow-xs">
      <span
        className={cn(
          "flex size-5 items-center justify-center rounded-md",
          accent
        )}
      >
        {icon}
      </span>
      <span className="text-muted-foreground">{label}</span>
      <span className="font-semibold text-foreground text-sm tabular-nums">
        {value}
      </span>
    </span>
  )
}

function Pill({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-primary/20 bg-primary/10 px-2.5 py-1 font-medium text-primary text-xs">
      {children}
    </span>
  )
}
