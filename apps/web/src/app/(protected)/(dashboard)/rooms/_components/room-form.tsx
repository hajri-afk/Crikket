"use client"

import {
  DEFAULT_ROOM_COLOR,
  ROOM_DESCRIPTION_MAX_LENGTH,
  ROOM_NAME_MAX_LENGTH,
  type RoomColor,
} from "@crikket/shared/constants/room"
import { Button } from "@crikket/ui/components/ui/button"
import { Field, FieldError, FieldLabel } from "@crikket/ui/components/ui/field"
import { Input } from "@crikket/ui/components/ui/input"
import { Textarea } from "@crikket/ui/components/ui/textarea"
import { cn } from "@crikket/ui/lib/utils"
import { useForm } from "@tanstack/react-form"
import { Check, LayoutGrid } from "lucide-react"

import { getRoomColorClasses, ROOM_COLOR_CHOICES } from "@/lib/rooms"
import { roomFormSchema } from "@/lib/schema/room"

interface RoomFormProps {
  defaultValues?: {
    name: string
    description: string
    color: RoomColor
  }
  isPending: boolean
  onCancel?: () => void
  onSubmit: (input: {
    name: string
    description: string
    color: RoomColor
  }) => Promise<void>
  submitLabel: string
  submittingLabel: string
}

export function RoomForm({
  defaultValues,
  isPending,
  onCancel,
  onSubmit,
  submitLabel,
  submittingLabel,
}: RoomFormProps) {
  const form = useForm({
    defaultValues: {
      color: defaultValues?.color ?? DEFAULT_ROOM_COLOR,
      description: defaultValues?.description ?? "",
      name: defaultValues?.name ?? "",
    },
    validators: {
      onChange: roomFormSchema,
    },
    onSubmit: async ({ value }) => {
      await onSubmit({
        color: value.color,
        description: value.description,
        name: value.name,
      })
    },
  })

  const isBusy = isPending || form.state.isSubmitting

  return (
    <form
      className="grid gap-5"
      onSubmit={(event) => {
        event.preventDefault()
        event.stopPropagation()
        form.handleSubmit()
      }}
    >
      {/* Live preview so the name/color choice is obvious before saving. */}
      <form.Subscribe
        selector={(state) => ({
          color: state.values.color,
          name: state.values.name,
        })}
      >
        {({ color, name }) => {
          const previewClasses = getRoomColorClasses(color)

          return (
            <div className="flex items-center gap-3 overflow-hidden rounded-xl border bg-muted/30 p-3">
              <span
                className={cn(
                  "flex size-10 shrink-0 items-center justify-center rounded-xl ring-1",
                  previewClasses.surface
                )}
              >
                <LayoutGrid className="size-5" />
              </span>
              <div className="min-w-0">
                <p className="truncate font-semibold text-sm">
                  {name.trim() || "Your room name"}
                </p>
                <p className="text-muted-foreground text-xs">Preview</p>
              </div>
            </div>
          )
        }}
      </form.Subscribe>

      <form.Field name="name">
        {(field) => {
          const isInvalid =
            field.state.meta.isTouched && field.state.meta.errors.length > 0

          return (
            <Field data-invalid={isInvalid}>
              <FieldLabel htmlFor={field.name}>Room name</FieldLabel>
              <Input
                aria-invalid={isInvalid}
                autoComplete="off"
                id={field.name}
                maxLength={ROOM_NAME_MAX_LENGTH}
                onBlur={field.handleBlur}
                onChange={(event) => field.handleChange(event.target.value)}
                placeholder="e.g. Checkout Revamp QA"
                value={field.state.value}
              />
              {isInvalid ? (
                <FieldError errors={field.state.meta.errors} />
              ) : (
                <p className="text-muted-foreground text-xs">
                  One room per project you run testing sessions for.
                </p>
              )}
            </Field>
          )
        }}
      </form.Field>

      <form.Field name="color">
        {(field) => (
          <Field>
            <FieldLabel htmlFor="room-color">Color</FieldLabel>
            <div className="flex flex-wrap gap-2" id="room-color">
              {ROOM_COLOR_CHOICES.map((choice) => {
                const isSelected = field.state.value === choice.value

                return (
                  <label
                    className="cursor-pointer"
                    key={choice.value}
                    title={choice.label}
                  >
                    <input
                      checked={isSelected}
                      className="peer sr-only"
                      name="room-color"
                      onChange={() => field.handleChange(choice.value)}
                      type="radio"
                      value={choice.value}
                    />
                    <span
                      className={cn(
                        "flex size-9 items-center justify-center rounded-full ring-offset-2 ring-offset-background transition-all",
                        "peer-focus-visible:ring-2 peer-focus-visible:ring-ring",
                        getRoomColorClasses(choice.value).dot,
                        isSelected
                          ? "ring-2 ring-foreground/70"
                          : "opacity-70 hover:scale-110 hover:opacity-100"
                      )}
                    >
                      {isSelected ? (
                        <Check className="size-4 text-white drop-shadow" />
                      ) : null}
                      <span className="sr-only">{choice.label}</span>
                    </span>
                  </label>
                )
              })}
            </div>
          </Field>
        )}
      </form.Field>

      <form.Field name="description">
        {(field) => {
          const isInvalid =
            field.state.meta.isTouched && field.state.meta.errors.length > 0

          return (
            <Field data-invalid={isInvalid}>
              <FieldLabel htmlFor={field.name}>
                Description{" "}
                <span className="font-normal text-muted-foreground">
                  (optional)
                </span>
              </FieldLabel>
              <Textarea
                aria-invalid={isInvalid}
                className="min-h-20 resize-y"
                id={field.name}
                maxLength={ROOM_DESCRIPTION_MAX_LENGTH}
                onBlur={field.handleBlur}
                onChange={(event) => field.handleChange(event.target.value)}
                placeholder="What is tested in this room?"
                value={field.state.value}
              />
              <div className="flex items-center justify-between gap-2">
                {isInvalid ? (
                  <FieldError errors={field.state.meta.errors} />
                ) : (
                  <span />
                )}
                <span className="shrink-0 text-muted-foreground text-xs tabular-nums">
                  {field.state.value.length}/{ROOM_DESCRIPTION_MAX_LENGTH}
                </span>
              </div>
            </Field>
          )
        }}
      </form.Field>

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        {onCancel ? (
          <Button
            className="w-full sm:w-auto"
            disabled={isBusy}
            onClick={onCancel}
            type="button"
            variant="outline"
          >
            Cancel
          </Button>
        ) : null}
        <Button className="w-full sm:w-auto" disabled={isBusy} type="submit">
          {isBusy ? submittingLabel : submitLabel}
        </Button>
      </div>
    </form>
  )
}
