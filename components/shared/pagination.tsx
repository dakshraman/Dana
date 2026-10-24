"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { ChevronLeft, ChevronRight, MoreHorizontal } from "lucide-react"

import { buttonVariants } from "@/components/ui/button"
import { formatNumber } from "@/lib/format"
import { cn } from "@/lib/utils"

export type PaginationSearchParams = Record<
  string,
  string | string[] | undefined
>

export type PaginationProps = {
  page: number
  totalPages: number
  total?: number
  pageSize?: number
  basePath?: string
  searchParams?: PaginationSearchParams
  className?: string
}

type PageItem = number | "ellipsis"

function buildHref(
  basePath: string,
  searchParams: PaginationSearchParams,
  page: number
) {
  const params = new URLSearchParams()

  for (const [key, value] of Object.entries(searchParams)) {
    if (key === "page" || value === undefined) continue
    if (Array.isArray(value)) {
      for (const item of value) {
        if (item !== "") params.append(key, item)
      }
    } else if (value !== "") {
      params.set(key, value)
    }
  }

  if (page > 1) params.set("page", String(page))

  const query = params.toString()
  return query ? `${basePath}?${query}` : basePath
}

function getPageItems(page: number, totalPages: number): PageItem[] {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, index) => index + 1)
  }

  const visible = new Set<number>([1, totalPages, page - 1, page, page + 1])
  const pages = [...visible]
    .filter((item) => item >= 1 && item <= totalPages)
    .sort((a, b) => a - b)

  const items: PageItem[] = []
  let previous = 0

  for (const current of pages) {
    if (previous > 0) {
      if (current - previous === 2) {
        items.push(previous + 1)
      } else if (current - previous > 2) {
        items.push("ellipsis")
      }
    }
    items.push(current)
    previous = current
  }

  return items
}

export function Pagination({
  page,
  totalPages,
  total,
  pageSize,
  basePath,
  searchParams = {},
  className,
}: PaginationProps) {
  const pathname = usePathname()

  if (totalPages <= 1) return null

  const base = basePath ?? pathname ?? ""
  const requestedPage = Number.isFinite(page) ? Math.trunc(page) : 1
  const currentPage = Math.min(Math.max(requestedPage, 1), totalPages)
  const pageItems = getPageItems(currentPage, totalPages)

  const from =
    typeof total === "number" && pageSize
      ? (currentPage - 1) * pageSize + 1
      : undefined
  const to =
    typeof total === "number" && pageSize
      ? Math.min(currentPage * pageSize, total)
      : undefined

  return (
    <nav
      aria-label="Pagination"
      data-slot="pagination"
      className={cn(
        "flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between",
        className
      )}
    >
      <div className="min-h-5 text-xs tracking-wide text-muted-foreground">
        {typeof total === "number" ? (
          total === 0 ? (
            "No results"
          ) : from !== undefined && to !== undefined ? (
            <>
              Showing{" "}
              <span className="font-medium tabular-nums text-foreground">
                {formatNumber(from)}–{formatNumber(to)}
              </span>{" "}
              of{" "}
              <span className="font-medium tabular-nums text-foreground">
                {formatNumber(total)}
              </span>
            </>
          ) : (
            <>
              <span className="font-medium tabular-nums text-foreground">
                {formatNumber(total)}
              </span>{" "}
              total
            </>
          )
        ) : null}
      </div>

      <div className="flex items-center gap-1">
        {currentPage > 1 ? (
          <Link
            href={buildHref(base, searchParams, currentPage - 1)}
            aria-label="Previous page"
            className={cn(
              buttonVariants({ variant: "outline", size: "icon-sm" })
            )}
          >
            <ChevronLeft aria-hidden="true" />
          </Link>
        ) : (
          <span
            aria-disabled="true"
            aria-label="Previous page"
            className={cn(
              buttonVariants({ variant: "outline", size: "icon-sm" }),
              "pointer-events-none opacity-40"
            )}
          >
            <ChevronLeft aria-hidden="true" />
          </span>
        )}

        <div className="hidden items-center gap-1 sm:flex">
          {pageItems.map((item, index) =>
            item === "ellipsis" ? (
              <span
                key={`ellipsis-${index}`}
                aria-hidden="true"
                className="flex size-9 items-center justify-center text-muted-foreground"
              >
                <MoreHorizontal />
              </span>
            ) : (
              <Link
                key={item}
                href={buildHref(base, searchParams, item)}
                aria-label={`Page ${item}`}
                aria-current={item === currentPage ? "page" : undefined}
                className={cn(
                  buttonVariants({
                    variant: item === currentPage ? "default" : "outline",
                    size: "icon-sm",
                  }),
                  "tabular-nums"
                )}
              >
                {item}
              </Link>
            )
          )}
        </div>

        <span className="px-2 text-xs tracking-wider text-muted-foreground uppercase sm:hidden">
          Page {currentPage} of {totalPages}
        </span>

        {currentPage < totalPages ? (
          <Link
            href={buildHref(base, searchParams, currentPage + 1)}
            aria-label="Next page"
            className={cn(
              buttonVariants({ variant: "outline", size: "icon-sm" })
            )}
          >
            <ChevronRight aria-hidden="true" />
          </Link>
        ) : (
          <span
            aria-disabled="true"
            aria-label="Next page"
            className={cn(
              buttonVariants({ variant: "outline", size: "icon-sm" }),
              "pointer-events-none opacity-40"
            )}
          >
            <ChevronRight aria-hidden="true" />
          </span>
        )}
      </div>
    </nav>
  )
}
