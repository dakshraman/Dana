"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { ChevronRight, Home } from "lucide-react"

import { breadcrumbLabel } from "@/lib/navigation"

export function Breadcrumbs() {
  const pathname = usePathname()
  const segments = pathname.split("/").filter(Boolean)

  return (
    <nav aria-label="Breadcrumb" className="min-w-0">
      <ol className="flex items-center gap-1.5 text-[11px] tracking-wider uppercase">
        <li>
          <Link
            href="/dashboard"
            className="text-muted-foreground transition-colors hover:text-foreground"
            aria-label="Dashboard"
          >
            <Home className="size-3.5" />
          </Link>
        </li>
        {segments.map((segment, index) => {
          const href = `/${segments.slice(0, index + 1).join("/")}`
          const label = breadcrumbLabel(segment, index, segments)
          const last = index === segments.length - 1

          return (
            <li key={href} className="flex min-w-0 items-center gap-1.5">
              <ChevronRight className="size-3 shrink-0 text-muted-foreground/60" />
              {last ? (
                <span className="truncate font-medium text-foreground">
                  {label}
                </span>
              ) : (
                <Link
                  href={href}
                  className="truncate text-muted-foreground transition-colors hover:text-foreground"
                >
                  {label}
                </Link>
              )}
            </li>
          )
        })}
      </ol>
    </nav>
  )
}
