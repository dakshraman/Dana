import Link from "next/link"
import { ChevronRight } from "lucide-react"

import { cn } from "@/lib/utils"

export type PageBreadcrumb = {
  label: string
  href?: string
}

export type PageHeaderProps = {
  title: string
  description?: string
  breadcrumbs?: PageBreadcrumb[]
  actions?: React.ReactNode
  className?: string
}

export function PageHeader({
  title,
  description,
  breadcrumbs,
  actions,
  className,
}: PageHeaderProps) {
  return (
    <header
      data-slot="page-header"
      className={cn(
        "flex flex-col gap-4 border-b border-border pb-5",
        className
      )}
    >
      {breadcrumbs && breadcrumbs.length > 0 ? (
        <nav aria-label="Breadcrumb">
          <ol className="flex flex-wrap items-center gap-1.5 text-[0.6875rem] font-medium tracking-widest text-muted-foreground uppercase">
            {breadcrumbs.map((crumb, index) => {
              const isLast = index === breadcrumbs.length - 1

              return (
                <li
                  key={`${crumb.label}-${index}`}
                  className="flex items-center gap-1.5"
                >
                  {index > 0 ? (
                    <ChevronRight
                      className="size-3 text-muted-foreground/60"
                      aria-hidden="true"
                    />
                  ) : null}
                  {crumb.href && !isLast ? (
                    <Link
                      href={crumb.href}
                      className="underline-offset-4 transition-colors hover:text-foreground hover:underline"
                    >
                      {crumb.label}
                    </Link>
                  ) : (
                    <span
                      aria-current={isLast ? "page" : undefined}
                      className={cn(isLast && "text-foreground")}
                    >
                      {crumb.label}
                    </span>
                  )}
                </li>
              )
            })}
          </ol>
        </nav>
      ) : null}

      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex min-w-0 flex-col gap-1.5">
          <h1 className="font-heading text-2xl font-semibold tracking-wider text-balance uppercase">
            {title}
          </h1>
          {description ? (
            <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">
              {description}
            </p>
          ) : null}
        </div>

        {actions ? (
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            {actions}
          </div>
        ) : null}
      </div>
    </header>
  )
}
