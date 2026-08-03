import type { AppRouterClient } from "@crikket/api/routers/index"

export type RoomListResponse = Awaited<
  ReturnType<AppRouterClient["room"]["list"]>
>

export type RoomListItem = RoomListResponse[number]
