"use client"

import { Button } from "@crikket/ui/components/ui/button"
import { Loader2, Video } from "lucide-react"

const SKELETON_KEYS = ["s1", "s2", "s3", "s4", "s5", "s6", "s7", "s8"]

import { SelectionActionBar } from "@/components/selection-action-bar"
import { useBugReportsActions } from "../../_hooks/use-bug-reports-actions"
import { useBugReportsData } from "../../_hooks/use-bug-reports-data"
import { useBugReportsFilters } from "../../_hooks/use-bug-reports-filters"
import { BugReportCard } from "./bug-report-card"
import { BugReportsBulkActions } from "./bug-reports-bulk-actions"
import { BugReportsDeleteDialogs } from "./bug-reports-delete-dialogs"
import { BugReportsToolbar } from "./bug-reports-toolbar"

interface BugReportsListProps {
  /** Scopes the list to a single room (used by the room detail page). */
  roomId?: string
}

export function BugReportsList({ roomId }: BugReportsListProps = {}) {
  const filtersState = useBugReportsFilters({ lockedRoomId: roomId })

  const {
    reports,
    stats,
    refetchAll,
    isError,
    errorMessage,
    isLoading,
    isFetching,
    refetch,
    loadMoreRef,
  } = useBugReportsData({
    search: filtersState.debouncedSearch,
    sort: filtersState.sort,
    filters: filtersState.filters,
  })

  const actionsState = useBugReportsActions({
    reportIds: reports.map((report) => report.id),
    refetchAll,
  })

  return (
    <div
      className={
        actionsState.selectedCount > 0
          ? "space-y-4 pb-40 sm:pb-32 lg:pb-28"
          : "space-y-4"
      }
    >
      <BugReportsToolbar
        filters={filtersState.filters}
        isRoomLocked={filtersState.isRoomLocked}
        onClearFilters={filtersState.clearFilters}
        onSearchChange={filtersState.setSearchValue}
        onSortChange={filtersState.setSort}
        onTogglePriority={filtersState.togglePriority}
        onToggleRoom={filtersState.toggleRoom}
        onToggleStatus={filtersState.toggleStatus}
        onToggleVisibility={filtersState.toggleVisibility}
        search={filtersState.searchValue}
        sort={filtersState.sort}
        stats={stats}
      />

      <SelectionActionBar
        actions={
          <BugReportsBulkActions
            bulkPriority={actionsState.bulkPriority}
            bulkRoom={actionsState.bulkRoom}
            bulkStatus={actionsState.bulkStatus}
            bulkTagsInput={actionsState.bulkTagsInput}
            bulkVisibility={actionsState.bulkVisibility}
            isMutating={actionsState.isMutating}
            onApplyUpdates={actionsState.handleBulkUpdate}
            onBulkPriorityChange={actionsState.setBulkPriority}
            onBulkRoomChange={actionsState.setBulkRoom}
            onBulkStatusChange={actionsState.setBulkStatus}
            onBulkTagsChange={actionsState.setBulkTagsInput}
            onBulkVisibilityChange={actionsState.setBulkVisibility}
            onRequestBulkDelete={() => actionsState.setBulkDeleteOpen(true)}
          />
        }
        onClearSelection={actionsState.clearSelection}
        selectedCount={actionsState.selectedCount}
      />

      {isError ? (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4">
          <p className="font-medium text-sm">Failed to load bug reports</p>
          <p className="mt-1 text-muted-foreground text-sm">
            {errorMessage || "Unexpected error"}
          </p>
          <Button
            className="mt-3"
            onClick={() => refetch()}
            size="sm"
            variant="outline"
          >
            Retry
          </Button>
        </div>
      ) : null}

      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
          {SKELETON_KEYS.map((skeletonKey) => (
            <div
              className="overflow-hidden rounded-xl border bg-card shadow-xs"
              key={skeletonKey}
            >
              <div className="aspect-video w-full animate-pulse bg-muted" />
              <div className="space-y-2 p-3">
                <div className="h-4 w-3/4 animate-pulse rounded bg-muted" />
                <div className="h-3 w-1/2 animate-pulse rounded bg-muted" />
                <div className="flex gap-1.5 pt-1">
                  <div className="h-5 w-14 animate-pulse rounded-md bg-muted" />
                  <div className="h-5 w-14 animate-pulse rounded-md bg-muted" />
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : null}

      {!isLoading && reports.length === 0 && !isError ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-4 rounded-xl border border-dashed bg-card/50 px-6 py-20 text-center">
          <div className="flex size-16 items-center justify-center rounded-2xl bg-primary/10 text-primary ring-1 ring-primary/15">
            <Video className="size-8" />
          </div>
          <div>
            <h2 className="font-semibold text-xl">
              {filtersState.hasActiveFilters
                ? "No matching reports"
                : "No bug reports yet"}
            </h2>
            <p className="mx-auto mt-2 max-w-sm text-muted-foreground text-sm">
              {filtersState.hasActiveFilters
                ? "Try adjusting your search or filters to find what you're looking for."
                : "Capture your first bug with the Crikket extension and it'll show up here."}
            </p>
          </div>
          {filtersState.hasActiveFilters ? (
            <Button
              onClick={filtersState.clearFilters}
              size="sm"
              variant="outline"
            >
              Clear filters
            </Button>
          ) : null}
        </div>
      ) : null}

      {reports.length > 0 ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
          {reports.map((report) => (
            <BugReportCard
              isChecked={actionsState.selectedIds.has(report.id)}
              isMutating={actionsState.isMutating}
              key={report.id}
              onReportUpdated={refetchAll}
              onRequestDelete={() => actionsState.setDeleteReportId(report.id)}
              onRetryDebuggerIngestion={() =>
                actionsState.retryIngestionMutation.mutate(report.id)
              }
              onToggleSelection={(checked) =>
                actionsState.toggleSelection(report.id, checked)
              }
              onUpdateReport={(input) =>
                actionsState.updateMutation.mutate({
                  id: report.id,
                  ...input,
                })
              }
              report={report}
            />
          ))}
        </div>
      ) : null}

      {isFetching ? (
        <div className="flex justify-center py-2">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : null}

      <div aria-hidden className="h-1 w-full" ref={loadMoreRef} />

      <BugReportsDeleteDialogs
        bulkDeleteOpen={actionsState.bulkDeleteOpen}
        deleteReportId={actionsState.deleteReportId}
        isBulkDeleteLoading={actionsState.bulkDeleteMutation.isPending}
        isSingleDeleteLoading={actionsState.deleteMutation.isPending}
        onBulkDeleteConfirm={actionsState.handleBulkDelete}
        onBulkDeleteOpenChange={actionsState.setBulkDeleteOpen}
        onSingleDeleteConfirm={async () => {
          if (!actionsState.deleteReportId) {
            return
          }

          await actionsState.deleteMutation.mutateAsync(
            actionsState.deleteReportId
          )
          actionsState.setDeleteReportId(null)
        }}
        onSingleDeleteOpenChange={(open) => {
          if (!open) {
            actionsState.setDeleteReportId(null)
          }
        }}
        selectedCount={actionsState.selectedCount}
      />
    </div>
  )
}
