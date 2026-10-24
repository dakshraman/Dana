import type { LucideIcon } from "lucide-react"

import { cn } from "@/lib/utils"

export type EmptyStateProps = {
  icon?: LucideIcon
  title: string
  description?: string
  action?: React.ReactNode
  className?: string
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
}: EmptyStateProps) {
  return (
    <div
      data-slot="empty-state"
      className={cn(
        "flex flex-col items-center justify-center gap-3 border border-dashed border-border bg-muted/20 px-6 py-12 text-center",
        className
      )}
    >
      {Icon ? (
        <div className="flex size-10 items-center justify-center border border-border bg-background text-muted-foreground">
          <Icon className="size-4" aria-hidden="true" />
        </div>
      ) : null}

      <div className="flex flex-col gap-1">
        <p className="text-sm font-semibold tracking-wider uppercase">
          {title}
        </p>
        {description ? (
          <p className="mx-auto max-w-md text-sm leading-relaxed text-muted-foreground">
            {description}
          </p>
        ) : null}
      </div>

      {action ? <div className="pt-1">{action}</div> : null}
    </div>
  )
}
