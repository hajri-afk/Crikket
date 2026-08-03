import { cn } from "@crikket/ui/lib/utils"
import { LayoutGrid } from "lucide-react"

import { getRoomColorClasses } from "@/lib/rooms"

interface RoomBadgeProps {
  className?: string
  color: string | undefined
  name: string
  showIcon?: boolean
}

export function RoomBadge({
  className,
  color,
  name,
  showIcon = true,
}: RoomBadgeProps) {
  const colorClasses = getRoomColorClasses(color)

  return (
    <span
      className={cn(
        "inline-flex max-w-full items-center gap-1 rounded-md border px-2 py-0.5 font-medium text-[11px]",
        colorClasses.badge,
        className
      )}
      title={name}
    >
      {showIcon ? (
        <LayoutGrid className="size-3 shrink-0" />
      ) : (
        <span
          className={cn("size-1.5 shrink-0 rounded-full", colorClasses.dot)}
        />
      )}
      <span className="truncate">{name}</span>
    </span>
  )
}
