import {
  ROOM_COLOR_OPTIONS,
  ROOM_DESCRIPTION_MAX_LENGTH,
  ROOM_NAME_MAX_LENGTH,
  type RoomColor,
} from "@crikket/shared/constants/room"
import * as z from "zod"

const colorValues = ROOM_COLOR_OPTIONS as unknown as [RoomColor, ...RoomColor[]]

export const roomFormSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Room name is required")
    .max(
      ROOM_NAME_MAX_LENGTH,
      `Room name must be ${ROOM_NAME_MAX_LENGTH} characters or fewer`
    ),
  description: z
    .string()
    .trim()
    .max(
      ROOM_DESCRIPTION_MAX_LENGTH,
      `Description must be ${ROOM_DESCRIPTION_MAX_LENGTH} characters or fewer`
    ),
  color: z.enum(colorValues),
})

export type RoomFormValues = z.infer<typeof roomFormSchema>
