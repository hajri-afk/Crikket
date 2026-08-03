"use client"

import {
  BUG_REPORT_STATUS_OPTIONS,
  BUG_REPORT_VISIBILITY_OPTIONS,
  type BugReportStatus,
  type BugReportVisibility,
} from "@crikket/shared/constants/bug-report"
import {
  PRIORITY_OPTIONS,
  type Priority,
} from "@crikket/shared/constants/priorities"
import {
  formatTestCaseTypeLabel,
  TEST_CASE_TYPE_VALUES,
  TEST_SCENARIO_MAX_LENGTH,
  TEST_SCENARIO_PLACEHOLDER,
  TESTED_FEATURE_MAX_LENGTH,
  TESTED_FEATURE_PLACEHOLDER,
  type TestCaseType,
} from "@crikket/shared/constants/test-case"
import { Button } from "@crikket/ui/components/ui/button"
import { Field, FieldError, FieldLabel } from "@crikket/ui/components/ui/field"
import { Input } from "@crikket/ui/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@crikket/ui/components/ui/select"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@crikket/ui/components/ui/sheet"
import { Textarea } from "@crikket/ui/components/ui/textarea"
import { useForm } from "@tanstack/react-form"
import { FlaskConical } from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"

import { RoomBadge } from "@/components/rooms/room-badge"
import { useRooms } from "@/components/rooms/use-rooms"
import { editBugReportFormSchema } from "@/lib/schema/bug-report"
import { client } from "@/utils/orpc"

/** Select value used for "no room". */
const NO_ROOM_VALUE = "__none__"

/** Select value used when QA has not classified the scenario yet. */
const NO_TEST_CASE_TYPE_VALUE = "__unset__"

const testCaseTypeOptions: Array<{ label: string; value: TestCaseType }> =
  TEST_CASE_TYPE_VALUES.map((value) => ({
    label: formatTestCaseTypeLabel(value),
    value,
  }))

const statusOptions: Array<{ label: string; value: BugReportStatus }> = [
  { label: "Open", value: BUG_REPORT_STATUS_OPTIONS.open },
  { label: "In Progress", value: BUG_REPORT_STATUS_OPTIONS.inProgress },
  { label: "Resolved", value: BUG_REPORT_STATUS_OPTIONS.resolved },
  { label: "Closed", value: BUG_REPORT_STATUS_OPTIONS.closed },
]

const priorityOptions: Array<{ label: string; value: Priority }> = [
  { label: "Critical", value: PRIORITY_OPTIONS.critical },
  { label: "High", value: PRIORITY_OPTIONS.high },
  { label: "Medium", value: PRIORITY_OPTIONS.medium },
  { label: "Low", value: PRIORITY_OPTIONS.low },
  { label: "None", value: PRIORITY_OPTIONS.none },
]

const visibilityOptions: Array<{ label: string; value: BugReportVisibility }> =
  [
    { label: "Private", value: BUG_REPORT_VISIBILITY_OPTIONS.private },
    { label: "Public", value: BUG_REPORT_VISIBILITY_OPTIONS.public },
  ]

function getStatusLabel(value: BugReportStatus): string {
  return statusOptions.find((option) => option.value === value)?.label ?? value
}

function getPriorityLabel(value: Priority): string {
  return (
    priorityOptions.find((option) => option.value === value)?.label ?? value
  )
}

function getVisibilityLabel(value: BugReportVisibility): string {
  return (
    visibilityOptions.find((option) => option.value === value)?.label ?? value
  )
}

function parseTagInput(tagInput: string): string[] {
  return Array.from(
    new Set(
      tagInput
        .split(",")
        .map((tag) => tag.trim())
        .filter((tag) => tag.length > 0)
    )
  )
}

interface EditBugReportSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onUpdated?: () => Promise<void> | void
  report: {
    id: string
    title: string | null | undefined
    tags: string[]
    status: BugReportStatus
    priority: Priority
    visibility: BugReportVisibility
    roomId: string | null
    roomName?: string | null
    roomColor?: string | null
    testedFeature?: string | null
    testScenario?: string | null
    testCaseType?: TestCaseType | null
  }
}

export function EditBugReportSheet({
  open,
  onOpenChange,
  onUpdated,
  report,
}: EditBugReportSheetProps) {
  const [isSaving, setIsSaving] = useState(false)
  const { visibleRooms } = useRooms()

  const form = useForm({
    defaultValues: {
      title: report.title ?? "",
      tagsInput: report.tags.join(", "),
      status: report.status,
      priority: report.priority,
      visibility: report.visibility,
      room: report.roomId ?? NO_ROOM_VALUE,
      testedFeature: report.testedFeature ?? "",
      testScenario: report.testScenario ?? "",
      testCaseType: report.testCaseType ?? NO_TEST_CASE_TYPE_VALUE,
    },
    validators: {
      onChange: editBugReportFormSchema,
    },
    onSubmit: async ({ value }) => {
      setIsSaving(true)

      try {
        await client.bugReport.update({
          id: report.id,
          title: value.title.trim(),
          tags: parseTagInput(value.tagsInput),
          status: value.status,
          priority: value.priority,
          visibility: value.visibility,
          roomId: value.room === NO_ROOM_VALUE ? null : value.room,
          testedFeature: value.testedFeature.trim() || null,
          testScenario: value.testScenario.trim() || null,
          testCaseType:
            value.testCaseType === NO_TEST_CASE_TYPE_VALUE
              ? null
              : (value.testCaseType as TestCaseType),
        })
        await onUpdated?.()
        toast.success("Bug report updated")
        onOpenChange(false)
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Failed to update bug report"
        toast.error(message)
      } finally {
        setIsSaving(false)
      }
    },
  })

  const resetFormValues = () => {
    form.reset({
      title: report.title ?? "",
      tagsInput: report.tags.join(", "),
      status: report.status,
      priority: report.priority,
      visibility: report.visibility,
      room: report.roomId ?? NO_ROOM_VALUE,
      testedFeature: report.testedFeature ?? "",
      testScenario: report.testScenario ?? "",
      testCaseType: report.testCaseType ?? NO_TEST_CASE_TYPE_VALUE,
    })
  }

  const handleOpenChange = (nextOpen: boolean) => {
    if (nextOpen) {
      resetFormValues()
    }
    onOpenChange(nextOpen)
  }

  return (
    <Sheet onOpenChange={handleOpenChange} open={open}>
      {/* Full width on phones, roomier on desktop: the form grew past a
          single screen once the QA scenario panel was added. */}
      <SheetContent className="flex w-full flex-col data-[side=right]:w-full data-[side=right]:sm:max-w-lg">
        <SheetHeader className="shrink-0">
          <SheetTitle>Edit bug report</SheetTitle>
          <SheetDescription>
            Update report details, QA scenario, tags, priority, status, and
            privacy.
          </SheetDescription>
        </SheetHeader>

        <form
          className="flex min-h-0 flex-1 flex-col"
          onSubmit={(event) => {
            event.preventDefault()
            event.stopPropagation()
            form.handleSubmit()
          }}
        >
          {/* Only the fields scroll; header and footer stay put. */}
          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 pb-4">
            <form.Field name="title">
              {(field) => {
                const isInvalid =
                  field.state.meta.isTouched &&
                  field.state.meta.errors.length > 0

                return (
                  <Field data-invalid={isInvalid}>
                    <FieldLabel htmlFor={field.name}>Name</FieldLabel>
                    <Input
                      aria-invalid={isInvalid}
                      id={field.name}
                      maxLength={200}
                      name={field.name}
                      onBlur={field.handleBlur}
                      onChange={(event) =>
                        field.handleChange(event.target.value)
                      }
                      placeholder="Bug report title"
                      value={field.state.value}
                    />
                    {isInvalid ? (
                      <FieldError errors={field.state.meta.errors} />
                    ) : null}
                  </Field>
                )
              }}
            </form.Field>

            <form.Field name="tagsInput">
              {(field) => {
                const isInvalid =
                  field.state.meta.isTouched &&
                  field.state.meta.errors.length > 0

                return (
                  <Field data-invalid={isInvalid}>
                    <FieldLabel htmlFor={field.name}>Tags</FieldLabel>
                    <Input
                      aria-invalid={isInvalid}
                      id={field.name}
                      name={field.name}
                      onBlur={field.handleBlur}
                      onChange={(event) =>
                        field.handleChange(event.target.value)
                      }
                      placeholder="auth, dashboard, onboarding"
                      value={field.state.value}
                    />
                    {isInvalid ? (
                      <FieldError errors={field.state.meta.errors} />
                    ) : null}
                  </Field>
                )
              }}
            </form.Field>

            {/* QA scope, kept separate from the bug description. */}
            <div className="space-y-4 rounded-xl border bg-muted/20 p-3">
              <div className="flex items-center gap-1.5">
                <FlaskConical className="size-4 text-muted-foreground" />
                <p className="font-medium text-sm">Test scenario (QA)</p>
              </div>

              <form.Field name="testedFeature">
                {(field) => {
                  const isInvalid =
                    field.state.meta.isTouched &&
                    field.state.meta.errors.length > 0

                  return (
                    <Field data-invalid={isInvalid}>
                      <FieldLabel htmlFor={field.name}>
                        Feature / menu tested
                      </FieldLabel>
                      <Input
                        aria-invalid={isInvalid}
                        id={field.name}
                        maxLength={TESTED_FEATURE_MAX_LENGTH}
                        name={field.name}
                        onBlur={field.handleBlur}
                        onChange={(event) =>
                          field.handleChange(event.target.value)
                        }
                        placeholder={TESTED_FEATURE_PLACEHOLDER}
                        value={field.state.value}
                      />
                      {isInvalid ? (
                        <FieldError errors={field.state.meta.errors} />
                      ) : (
                        <span className="text-muted-foreground text-xs">
                          Shown as the main badge on the report card.
                        </span>
                      )}
                    </Field>
                  )
                }}
              </form.Field>

              <form.Field name="testCaseType">
                {(field) => (
                  <Field>
                    <FieldLabel htmlFor={field.name}>Case type</FieldLabel>
                    <Select
                      onValueChange={(value) => {
                        if (value) {
                          field.handleChange(value)
                        }
                      }}
                      value={field.state.value}
                    >
                      <SelectTrigger className="w-full" id={field.name}>
                        <SelectValue>
                          {field.state.value === NO_TEST_CASE_TYPE_VALUE
                            ? "Not set"
                            : formatTestCaseTypeLabel(
                                field.state.value as TestCaseType
                              )}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={NO_TEST_CASE_TYPE_VALUE}>
                          Not set
                        </SelectItem>
                        {testCaseTypeOptions.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Field>
                )}
              </form.Field>

              <form.Field name="testScenario">
                {(field) => {
                  const isInvalid =
                    field.state.meta.isTouched &&
                    field.state.meta.errors.length > 0

                  return (
                    <Field data-invalid={isInvalid}>
                      <FieldLabel htmlFor={field.name}>
                        Scenario covered
                      </FieldLabel>
                      <Textarea
                        aria-invalid={isInvalid}
                        className="min-h-28 resize-y"
                        id={field.name}
                        maxLength={TEST_SCENARIO_MAX_LENGTH}
                        name={field.name}
                        onBlur={field.handleBlur}
                        onChange={(event) =>
                          field.handleChange(event.target.value)
                        }
                        placeholder={TEST_SCENARIO_PLACEHOLDER}
                        value={field.state.value}
                      />
                      <div className="flex items-center justify-between gap-2">
                        {isInvalid ? (
                          <FieldError errors={field.state.meta.errors} />
                        ) : (
                          <span className="text-muted-foreground text-xs">
                            Scope checked by QA — visible to devs and PM.
                          </span>
                        )}
                        <span className="shrink-0 text-muted-foreground text-xs tabular-nums">
                          {field.state.value.length}/{TEST_SCENARIO_MAX_LENGTH}
                        </span>
                      </div>
                    </Field>
                  )
                }}
              </form.Field>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <form.Field name="status">
                {(field) => (
                  <Field>
                    <FieldLabel htmlFor={field.name}>Status</FieldLabel>
                    <Select
                      onValueChange={(value) =>
                        field.handleChange(value as BugReportStatus)
                      }
                      value={field.state.value}
                    >
                      <SelectTrigger className="w-full" id={field.name}>
                        <SelectValue>
                          {getStatusLabel(field.state.value)}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        {statusOptions.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Field>
                )}
              </form.Field>

              <form.Field name="priority">
                {(field) => (
                  <Field>
                    <FieldLabel htmlFor={field.name}>Priority</FieldLabel>
                    <Select
                      onValueChange={(value) =>
                        field.handleChange(value as Priority)
                      }
                      value={field.state.value}
                    >
                      <SelectTrigger className="w-full" id={field.name}>
                        <SelectValue>
                          {getPriorityLabel(field.state.value)}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        {priorityOptions.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Field>
                )}
              </form.Field>
            </div>

            <form.Field name="room">
              {(field) => {
                const currentRoom = visibleRooms.find(
                  (room) => room.id === field.state.value
                )
                const isArchivedRoom =
                  field.state.value !== NO_ROOM_VALUE && !currentRoom

                return (
                  <Field>
                    <FieldLabel htmlFor={field.name}>Room</FieldLabel>
                    <Select
                      onValueChange={(value) => {
                        if (value) {
                          field.handleChange(value)
                        }
                      }}
                      value={field.state.value}
                    >
                      <SelectTrigger className="w-full" id={field.name}>
                        <SelectValue>
                          {field.state.value === NO_ROOM_VALUE
                            ? "No room"
                            : (currentRoom?.name ??
                              report.roomName ??
                              "Current room")}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={NO_ROOM_VALUE}>No room</SelectItem>
                        {isArchivedRoom && report.roomId ? (
                          <SelectItem value={report.roomId}>
                            {report.roomName ?? "Current room"} (archived)
                          </SelectItem>
                        ) : null}
                        {visibleRooms.map((room) => (
                          <SelectItem key={room.id} value={room.id}>
                            {room.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {report.roomName && report.roomId ? (
                      <RoomBadge
                        className="w-fit"
                        color={report.roomColor ?? undefined}
                        name={`Currently in ${report.roomName}`}
                      />
                    ) : null}
                  </Field>
                )
              }}
            </form.Field>

            <form.Field name="visibility">
              {(field) => (
                <Field>
                  <FieldLabel htmlFor={field.name}>Privacy</FieldLabel>
                  <Select
                    onValueChange={(value) =>
                      field.handleChange(value as BugReportVisibility)
                    }
                    value={field.state.value}
                  >
                    <SelectTrigger className="w-full" id={field.name}>
                      <SelectValue>
                        {getVisibilityLabel(field.state.value)}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {visibilityOptions.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
              )}
            </form.Field>
          </div>

          <SheetFooter className="mt-0 shrink-0 flex-col-reverse gap-2 border-t bg-background pt-3 sm:flex-row sm:justify-end">
            <Button
              className="w-full sm:w-auto"
              onClick={() => onOpenChange(false)}
              type="button"
              variant="ghost"
            >
              Cancel
            </Button>
            <Button
              className="w-full sm:w-auto"
              disabled={isSaving || form.state.isSubmitting}
              type="submit"
            >
              {isSaving || form.state.isSubmitting
                ? "Saving..."
                : "Save changes"}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  )
}
