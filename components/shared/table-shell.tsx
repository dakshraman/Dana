import * as React from "react"

import { EmptyState } from "@/components/shared/empty-state"
import { cn } from "@/lib/utils"

export type TableShellProps = {
  children: React.ReactNode
  toolbar?: React.ReactNode
  footer?: React.ReactNode
  /** Render the empty state instead of `children`. */
  isEmpty?: boolean
  /** Custom empty content. Defaults to an `EmptyState`. */
  empty?: React.ReactNode
  emptyTitle?: string
  emptyDescription?: string
  className?: string
}

export function TableShell({
  children,
  toolbar,
  footer,
  isEmpty = false,
  empty,
  emptyTitle = "No records found",
  emptyDescription,
  className,
}: TableShellProps) {
  return (
    <section
      data-slot="table-shell"
      className={cn("border border-border bg-card", className)}
    >
      {toolbar ? <TableToolbar>{toolbar}</TableToolbar> : null}

      <div className="w-full overflow-x-auto">
        {isEmpty ? (
          empty ?? (
            <EmptyState
              title={emptyTitle}
              description={emptyDescription}
              className="border-0 bg-transparent"
            />
          )
        ) : (
          children
        )}
      </div>

      {footer ? (
        <div className="border-t border-border px-4 py-3">{footer}</div>
      ) : null}
    </section>
  )
}

export function TableToolbar({
  className,
  children,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="table-toolbar"
      className={cn(
        "flex flex-col gap-3 border-b border-border px-4 py-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between",
        className
      )}
      {...props}
    >
      {children}
    </div>
  )
}
