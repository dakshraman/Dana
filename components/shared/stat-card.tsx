import { ArrowDownRight, ArrowUpRight, Minus, type LucideIcon } from "lucide-react"

import { formatNumber } from "@/lib/format"
import { cn } from "@/lib/utils"

export type StatCardTone = "default" | "positive" | "warning" | "danger"

export type StatCardTrend = {
  /** Percentage change. Positive renders as an increase. */
  value: number
  label?: string
}

export type StatCardProps = {
  label: string
  value: string | number
  hint?: string
  trend?: StatCardTrend
  icon?: LucideIcon
  tone?: StatCardTone
  className?: string
}

const TONE_ACCENT: Record<StatCardTone, string> = {
  default: "bg-border",
  positive: "bg-primary",
  warning: "bg-amber-500",
  danger: "bg-destructive",
}

const TONE_ICON: Record<StatCardTone, string> = {
  default: "text-muted-foreground",
  positive: "text-primary",
  warning: "text-amber-600 dark:text-amber-400",
  danger: "text-destructive",
}

export function StatCard({
  label,
  value,
  hint,
  trend,
  icon: Icon,
  tone = "default",
  className,
}: StatCardProps) {
  const trendValue = trend?.value ?? 0
  const isFlat = trendValue === 0
  const isUp = trendValue > 0
  const TrendIcon = isFlat ? Minus : isUp ? ArrowUpRight : ArrowDownRight

  return (
    <div
      data-slot="stat-card"
      className={cn(
        "relative flex flex-col gap-4 overflow-hidden border border-border bg-card p-4",
        className
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          "absolute inset-y-0 left-0 w-0.5",
          TONE_ACCENT[tone]
        )}
      />

      <div className="flex items-start justify-between gap-3">
        <p className="text-[0.6875rem] font-semibold tracking-widest text-muted-foreground uppercase">
          {label}
        </p>
        {Icon ? (
          <Icon
            className={cn("size-4 shrink-0", TONE_ICON[tone])}
            aria-hidden="true"
          />
        ) : null}
      </div>

      <div className="flex flex-col gap-1">
        <p className="font-heading text-2xl font-semibold tracking-tight tabular-nums">
          {typeof value === "number" ? formatNumber(value) : value}
        </p>

        {trend ? (
          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
            <span
              className={cn(
                "inline-flex items-center gap-0.5 text-xs font-medium tabular-nums",
                isFlat
                  ? "text-muted-foreground"
                  : isUp
                    ? "text-primary"
                    : "text-destructive"
              )}
            >
              <TrendIcon className="size-3.5" aria-hidden="true" />
              <span aria-hidden="true">
                {isUp ? "+" : ""}
                {formatNumber(trendValue, { maximumFractionDigits: 1 })}%
              </span>
              <span className="sr-only">
                {isFlat
                  ? "No change"
                  : `${isUp ? "Increase" : "Decrease"} of ${formatNumber(
                      Math.abs(trendValue),
                      { maximumFractionDigits: 1 }
                    )}%`}
              </span>
            </span>

            {trend.label ? (
              <span className="text-xs text-muted-foreground">
                {trend.label}
              </span>
            ) : null}
          </div>
        ) : null}

        {hint ? (
          <p className="text-xs leading-relaxed text-muted-foreground">
            {hint}
          </p>
        ) : null}
      </div>
    </div>
  )
}
