import {
  formatTestCaseTypeLabel,
  TEST_CASE_TYPE_OPTIONS,
  type TestCaseType,
} from "@crikket/shared/constants/test-case"
import { cn } from "@crikket/ui/lib/utils"
import { CircleCheck, CircleSlash, Shuffle } from "lucide-react"

const TEST_CASE_TYPE_STYLES: Record<
  TestCaseType,
  { className: string; Icon: typeof CircleCheck }
> = {
  [TEST_CASE_TYPE_OPTIONS.positive]: {
    className:
      "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
    Icon: CircleCheck,
  },
  [TEST_CASE_TYPE_OPTIONS.negative]: {
    className:
      "border-rose-500/30 bg-rose-500/10 text-rose-700 dark:text-rose-400",
    Icon: CircleSlash,
  },
  [TEST_CASE_TYPE_OPTIONS.both]: {
    className:
      "border-violet-500/30 bg-violet-500/10 text-violet-700 dark:text-violet-400",
    Icon: Shuffle,
  },
}

interface TestCaseTypeBadgeProps {
  value: TestCaseType
  className?: string
  /** Drops the label and keeps only the icon, for dense card layouts. */
  compact?: boolean
}

export function TestCaseTypeBadge({
  value,
  className,
  compact = false,
}: TestCaseTypeBadgeProps) {
  const { className: toneClassName, Icon } = TEST_CASE_TYPE_STYLES[value]
  const label = formatTestCaseTypeLabel(value)

  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1 rounded-md border px-1.5 py-0.5 font-medium text-[11px]",
        toneClassName,
        className
      )}
      title={label}
    >
      <Icon className="size-3" />
      {compact ? <span className="sr-only">{label}</span> : label}
    </span>
  )
}
