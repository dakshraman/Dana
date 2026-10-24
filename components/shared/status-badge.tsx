import {
  STATUS_LABELS,
  type RecordStatusValue,
} from "@/lib/permissions"
import { cn } from "@/lib/utils"

export type StatusBadgeProps = {
  status: RecordStatusValue
  label?: string
  className?: string
}

type StatusStyle = {
  badge: string
  dot: string
}

const STATUS_STYLES: Record<RecordStatusValue, StatusStyle> = {
  DRAFT: {
    badge: "border-border bg-muted/40 text-muted-foreground",
    dot: "bg-muted-foreground/60",
  },
  SUBMITTED: {
    badge:
      "border-sky-600/25 bg-sky-500/10 text-sky-700 dark:border-sky-400/25 dark:text-sky-300",
    dot: "bg-sky-500",
  },
  APPROVED: {
    badge: "border-primary/30 bg-primary/10 text-primary",
    dot: "bg-primary",
  },
  REJECTED: {
    badge: "border-destructive/30 bg-destructive/10 text-destructive",
    dot: "bg-destructive",
  },
  RETURNED: {
    badge:
      "border-amber-600/30 bg-amber-500/10 text-amber-700 dark:border-amber-400/25 dark:text-amber-300",
    dot: "bg-amber-500",
  },
  ARCHIVED: {
    badge: "border-border bg-transparent text-muted-foreground",
    dot: "bg-muted-foreground/40",
  },
}

export function StatusBadge({ status, label, className }: StatusBadgeProps) {
  const style = STATUS_STYLES[status]

  return (
    <span
      data-slot="status-badge"
      data-status={status}
      className={cn(
        "inline-flex w-fit shrink-0 items-center gap-1.5 rounded-none border px-2 py-0.5 text-[0.625rem] font-semibold tracking-widest whitespace-nowrap uppercase",
        style.badge,
        className
      )}
    >
      <span
        aria-hidden="true"
        className={cn("size-1.5 shrink-0", style.dot)}
      />
      {label ?? STATUS_LABELS[status]}
    </span>
  )
}
