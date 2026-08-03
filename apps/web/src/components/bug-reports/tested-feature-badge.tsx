import { cn } from "@crikket/ui/lib/utils"
import { MousePointerClick } from "lucide-react"

interface TestedFeatureBadgeProps {
  className?: string
  value: string
}

/**
 * Primary QA badge: the feature or menu that was exercised. Reads far better in
 * a list than an abstract "positive/negative" label.
 */
export function TestedFeatureBadge({
  className,
  value,
}: TestedFeatureBadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex max-w-full items-center gap-1 rounded-md border border-primary/25 bg-primary/10 px-2 py-0.5 font-medium text-[11px] text-primary",
        className
      )}
      title={value}
    >
      <MousePointerClick className="size-3 shrink-0" />
      <span className="truncate">{value}</span>
    </span>
  )
}
