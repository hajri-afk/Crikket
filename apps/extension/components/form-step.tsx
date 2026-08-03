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
import { Textarea } from "@crikket/ui/components/ui/textarea"
import { useForm } from "@tanstack/react-form"
import { AlertTriangle, FlaskConical } from "lucide-react"
import { type SyntheticEvent, useCallback, useEffect, useRef } from "react"
import * as z from "zod"
import { RoomPicker, type RoomPickerOption } from "@/components/room-picker"
import { NO_ROOM_VALUE } from "@/hooks/use-rooms"

const priorityValues = Object.values(PRIORITY_OPTIONS) as [
  Priority,
  ...Priority[],
]

const formSchema = z.object({
  title: z.string().max(200, "Title must be at most 200 characters."),
  description: z
    .string()
    .max(3000, "Description must be at most 3000 characters."),
  priority: z.enum(priorityValues),
  testedFeature: z
    .string()
    .max(
      TESTED_FEATURE_MAX_LENGTH,
      `Feature must be at most ${TESTED_FEATURE_MAX_LENGTH} characters.`
    ),
  testScenario: z
    .string()
    .max(
      TEST_SCENARIO_MAX_LENGTH,
      `Test scenario must be at most ${TEST_SCENARIO_MAX_LENGTH} characters.`
    ),
  testCaseType: z.string(),
})

/** Select value used when QA has not classified the scenario. */
const NO_TEST_CASE_TYPE_VALUE = "__unset__"

interface DebuggerSummary {
  actions: number
  logs: number
  networkRequests: number
}

interface FormStepProps {
  captureType: "video" | "screenshot"
  previewUrl: string | null
  videoDurationMs: number | null
  initialTitle: string
  isSubmitting: boolean
  submitError: string | null
  preSubmitWarnings: string[]
  debuggerSummary: DebuggerSummary
  rooms: RoomPickerOption[]
  roomsError: string | null
  isLoadingRooms: boolean
  selectedRoomId: string
  onRoomChange: (roomId: string) => void
  onSubmit: (values: {
    title: string
    description: string
    priority: Priority
    testedFeature?: string
    testScenario?: string
    testCaseType?: TestCaseType
  }) => void
  onCancel: () => void
}

interface FormValues {
  title: string
  description: string
  priority: Priority
  testedFeature: string
  testScenario: string
  testCaseType: string
}

export function FormStep({
  captureType,
  previewUrl,
  videoDurationMs,
  initialTitle,
  isSubmitting,
  submitError,
  preSubmitWarnings,
  debuggerSummary,
  rooms,
  roomsError,
  isLoadingRooms,
  selectedRoomId,
  onRoomChange,
  onSubmit,
  onCancel,
}: FormStepProps) {
  const defaultValues: FormValues = {
    title: initialTitle,
    description: "",
    priority: PRIORITY_OPTIONS.none,
    testedFeature: "",
    testScenario: "",
    testCaseType: NO_TEST_CASE_TYPE_VALUE,
  }

  const form = useForm({
    defaultValues,
    validators: {
      onSubmit: formSchema,
    },
    onSubmit: async ({ value }) => {
      await onSubmit({
        title: value.title,
        description: value.description,
        priority: value.priority,
        testedFeature: value.testedFeature.trim() || undefined,
        testScenario: value.testScenario.trim() || undefined,
        testCaseType:
          value.testCaseType === NO_TEST_CASE_TYPE_VALUE
            ? undefined
            : (value.testCaseType as TestCaseType),
      })
    },
  })

  const isBusy = isSubmitting || form.state.isSubmitting
  const selectedRoom =
    selectedRoomId === NO_ROOM_VALUE
      ? null
      : (rooms.find((room) => room.id === selectedRoomId) ?? null)
  const totalCapturedEvents =
    debuggerSummary.actions +
    debuggerSummary.logs +
    debuggerSummary.networkRequests
  const isPrimingVideoDurationRef = useRef(false)

  useEffect(() => {
    if (!form.state.values.title && initialTitle) {
      form.setFieldValue("title", initialTitle)
    }
  }, [form, initialTitle])

  const handleVideoLoadedMetadata = useCallback(
    (event: SyntheticEvent<HTMLVideoElement>) => {
      const player = event.currentTarget
      if (isPrimingVideoDurationRef.current) {
        return
      }

      if (!(typeof videoDurationMs === "number" && videoDurationMs > 0)) {
        return
      }

      if (Number.isFinite(player.duration) && player.duration > 0) {
        return
      }

      const durationSeconds = videoDurationMs / 1000
      const safeSeekTargetSeconds = Math.max(0, durationSeconds - 0.001)
      if (safeSeekTargetSeconds <= 0) {
        return
      }

      isPrimingVideoDurationRef.current = true
      const originalTime = player.currentTime

      const restorePosition = () => {
        const maxDurationSeconds =
          Number.isFinite(player.duration) && player.duration > 0
            ? player.duration
            : durationSeconds
        player.currentTime = Math.min(originalTime, maxDurationSeconds)
        isPrimingVideoDurationRef.current = false
      }

      player.addEventListener("seeked", restorePosition, { once: true })

      try {
        player.currentTime = safeSeekTargetSeconds
      } catch {
        isPrimingVideoDurationRef.current = false
      }
    },
    [videoDurationMs]
  )

  return (
    <div className="space-y-6">
      {previewUrl && (
        <div className="overflow-hidden rounded-xl border bg-black shadow-sm">
          {captureType === "video" ? (
            <div className="relative">
              <video
                className="max-h-[400px] w-full bg-black object-contain"
                controls
                onLoadedMetadata={handleVideoLoadedMetadata}
                preload="metadata"
                src={previewUrl}
              >
                <track kind="captions" />
              </video>
            </div>
          ) : (
            <img
              alt="Screenshot preview"
              className="max-h-[400px] w-full bg-black object-contain"
              src={previewUrl}
            />
          )}
        </div>
      )}

      <form
        className="space-y-6"
        onSubmit={(event) => {
          event.preventDefault()
          event.stopPropagation()
          form.handleSubmit()
        }}
      >
        <div className="space-y-4">
          <section className="space-y-2 rounded-xl border bg-muted/20 p-4">
            <p className="font-medium text-sm">Captured debugger data</p>
            <p className="text-muted-foreground text-xs">
              {totalCapturedEvents} total events
            </p>
            <div className="flex flex-wrap items-center gap-2 text-muted-foreground text-xs">
              <span>Actions: {debuggerSummary.actions}</span>
              <span aria-hidden="true">•</span>
              <span>Logs: {debuggerSummary.logs}</span>
              <span aria-hidden="true">•</span>
              <span>Requests: {debuggerSummary.networkRequests}</span>
            </div>
          </section>

          <RoomPicker
            error={roomsError}
            helperText={
              selectedRoom
                ? `This report will be saved to "${selectedRoom.name}".`
                : "Pick a project room so this report does not have to be moved later."
            }
            isLoading={isLoadingRooms}
            onSelect={onRoomChange}
            rooms={rooms}
            selectedRoomId={selectedRoomId}
          />

          <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_190px]">
            <form.Field name="title">
              {(field) => {
                const isInvalid =
                  field.state.meta.isTouched &&
                  field.state.meta.errors.length > 0
                return (
                  <Field data-invalid={isInvalid}>
                    <FieldLabel htmlFor={field.name}>
                      Title (Optional)
                    </FieldLabel>
                    <Input
                      aria-invalid={isInvalid}
                      id={field.name}
                      onBlur={field.handleBlur}
                      onChange={(event) =>
                        field.handleChange(event.target.value)
                      }
                      placeholder="Give this report a quick title"
                      value={field.state.value}
                    />
                    {isInvalid && (
                      <FieldError errors={field.state.meta.errors} />
                    )}
                  </Field>
                )
              }}
            </form.Field>

            <form.Field name="priority">
              {(field) => {
                const isInvalid =
                  field.state.meta.isTouched &&
                  field.state.meta.errors.length > 0
                return (
                  <Field data-invalid={isInvalid}>
                    <FieldLabel htmlFor={field.name}>
                      Priority (Optional)
                    </FieldLabel>
                    <Select
                      onValueChange={(value) => {
                        if (value) {
                          field.handleChange(value as Priority)
                        }
                      }}
                      value={field.state.value}
                    >
                      <SelectTrigger
                        aria-invalid={isInvalid}
                        className="w-full"
                        id={field.name}
                      >
                        <SelectValue className="capitalize" />
                      </SelectTrigger>
                      <SelectContent>
                        {priorityValues.map((priority) => (
                          <SelectItem key={priority} value={priority}>
                            {formatPriorityLabel(priority)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {isInvalid && (
                      <FieldError errors={field.state.meta.errors} />
                    )}
                  </Field>
                )
              }}
            </form.Field>
          </div>

          <form.Field name="description">
            {(field) => {
              const isInvalid =
                field.state.meta.isTouched && field.state.meta.errors.length > 0
              return (
                <Field data-invalid={isInvalid}>
                  <FieldLabel htmlFor={field.name}>
                    Description (Optional)
                  </FieldLabel>
                  <Textarea
                    aria-invalid={isInvalid}
                    className="resize-none"
                    id={field.name}
                    onBlur={field.handleBlur}
                    onChange={(event) => field.handleChange(event.target.value)}
                    placeholder="Describe what went wrong..."
                    rows={4}
                    value={field.state.value}
                  />
                  {isInvalid && <FieldError errors={field.state.meta.errors} />}
                </Field>
              )
            }}
          </form.Field>

          {/* QA scope, separate from the bug description so devs and PM can see
              exactly what was exercised. */}
          <section className="space-y-4 rounded-xl border bg-muted/20 p-4">
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
                      Feature / menu tested (Optional)
                    </FieldLabel>
                    <Input
                      aria-invalid={isInvalid}
                      id={field.name}
                      maxLength={TESTED_FEATURE_MAX_LENGTH}
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
                        Which menu or feature you clicked through.
                      </span>
                    )}
                  </Field>
                )
              }}
            </form.Field>

            <form.Field name="testCaseType">
              {(field) => (
                <Field>
                  <FieldLabel htmlFor={field.name}>
                    Case type (Optional)
                  </FieldLabel>
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
                      {TEST_CASE_TYPE_VALUES.map((value) => (
                        <SelectItem key={value} value={value}>
                          {formatTestCaseTypeLabel(value)}
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
                      Scenario covered (Optional)
                    </FieldLabel>
                    <Textarea
                      aria-invalid={isInvalid}
                      className="resize-y"
                      id={field.name}
                      maxLength={TEST_SCENARIO_MAX_LENGTH}
                      onBlur={field.handleBlur}
                      onChange={(event) =>
                        field.handleChange(event.target.value)
                      }
                      placeholder={TEST_SCENARIO_PLACEHOLDER}
                      rows={6}
                      value={field.state.value}
                    />
                    <div className="flex items-center justify-between gap-2">
                      {isInvalid ? (
                        <FieldError errors={field.state.meta.errors} />
                      ) : (
                        <span className="text-muted-foreground text-xs">
                          List the positive and negative cases you checked.
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
          </section>
        </div>

        {preSubmitWarnings.length > 0 ? (
          <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4">
            <p className="flex items-center gap-2 font-medium text-amber-800 text-sm">
              <AlertTriangle className="h-4 w-4" />
              Review before submitting
            </p>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-amber-800 text-xs">
              {preSubmitWarnings.map((warning) => (
                <li key={warning}>{warning}</li>
              ))}
            </ul>
          </div>
        ) : null}

        {submitError && (
          <div className="mt-6 rounded-lg border border-red-500/20 bg-red-500/10 p-4">
            <p className="text-red-400 text-sm">{submitError}</p>
          </div>
        )}

        <div className="mt-6 flex gap-3">
          <Button
            className="flex-1"
            disabled={isBusy}
            onClick={() => {
              form.reset()
              onCancel()
            }}
            type="button"
            variant="outline"
          >
            Cancel
          </Button>
          <Button className="flex-1" disabled={isBusy} type="submit">
            {isBusy ? "Submitting..." : "Submit Bug Report"}
          </Button>
        </div>
      </form>
    </div>
  )
}

function formatPriorityLabel(priority: Priority): string {
  return `${priority.charAt(0).toUpperCase()}${priority.slice(1)}`
}
