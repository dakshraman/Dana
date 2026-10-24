/**
 * Presentation formatting helpers.
 *
 * Locale and timezone are pinned so server and client output match. Timestamps
 * are rendered in the company timezone (India Standard Time), which has a
 * fixed offset and therefore needs no timezone database or library.
 *
 * This module is framework free and safe to use from server components,
 * client components, and tests.
 */
import { format, formatDistanceStrict } from "date-fns"
import { enUS } from "date-fns/locale/en-US"

import { COMPANY_TIME_OFFSET_MS } from "@/lib/company-time"

export type DateInput = Date | string | number | null | undefined

const DEFAULT_LOCALE = "en-US"
const FALLBACK = "—"
const NAIVE_DATE_TIME =
  /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{1,3}))?)?$/

function toDate(value: DateInput): Date | null {
  if (value === null || value === undefined) return null

  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value
  }

  if (typeof value === "number") {
    const date = new Date(value)
    return Number.isNaN(date.getTime()) ? null : date
  }

  const input = value.trim()
  if (!input) return null

  // JavaScript parses ISO date-times without an offset as local time. Treat
  // them as UTC so the rendered value does not depend on the runtime timezone.
  const naive = NAIVE_DATE_TIME.exec(input)
  if (naive) {
    const [, year, month, day, hours, minutes, seconds, milliseconds] = naive
    const date = new Date(
      Date.UTC(
        Number(year),
        Number(month) - 1,
        Number(day),
        Number(hours),
        Number(minutes),
        Number(seconds ?? 0),
        Number((milliseconds ?? "0").padEnd(3, "0"))
      )
    )
    return Number.isNaN(date.getTime()) ? null : date
  }

  const date = new Date(input)
  return Number.isNaN(date.getTime()) ? null : date
}

/**
 * date-fns renders using local getters. Constructing a Date whose local fields
 * match the company-time fields produces stable output on any machine without a
 * timezone library.
 */
function toCompanyWallClock(date: Date): Date {
  const shifted = new Date(date.getTime() + COMPANY_TIME_OFFSET_MS)
  const wallClock = new Date(0)
  wallClock.setFullYear(
    shifted.getUTCFullYear(),
    shifted.getUTCMonth(),
    shifted.getUTCDate()
  )
  wallClock.setHours(
    shifted.getUTCHours(),
    shifted.getUTCMinutes(),
    shifted.getUTCSeconds(),
    shifted.getUTCMilliseconds()
  )
  return wallClock
}

export type DateFormatOptions = {
  /** A date-fns format pattern. Defaults to `MMM d, yyyy`. */
  pattern?: string
  /** Returned for null or invalid dates. Defaults to an em dash. */
  fallback?: string
}

export function formatDate(
  value: DateInput,
  options: DateFormatOptions = {}
): string {
  const { pattern = "MMM d, yyyy", fallback = FALLBACK } = options
  const date = toDate(value)
  if (!date) return fallback

  return format(toCompanyWallClock(date), pattern, { locale: enUS })
}

export function formatDateTime(
  value: DateInput,
  options: DateFormatOptions = {}
): string {
  return formatDate(value, {
    pattern: "MMM d, yyyy, HH:mm",
    ...options,
  })
}

export type RelativeFormatOptions = {
  /**
   * Reference point. Pass a server-provided timestamp when this is rendered in
   * a client component to keep SSR and hydration output identical.
   */
  now?: DateInput
  /** Include "ago" / "in". Defaults to true. */
  addSuffix?: boolean
  /** Returned for null or invalid dates. Defaults to an em dash. */
  fallback?: string
}

export function formatRelative(
  value: DateInput,
  options: RelativeFormatOptions = {}
): string {
  const { now, addSuffix = true, fallback = FALLBACK } = options
  const date = toDate(value)
  const base = toDate(now) ?? new Date()
  if (!date) return fallback

  return formatDistanceStrict(date, base, {
    addSuffix,
    locale: enUS,
  })
}

/** Alias kept for call sites that read more naturally with the suffix. */
export function formatRelativeTime(
  value: DateInput,
  now: DateInput = new Date()
): string {
  return formatRelative(value, { now })
}

export function formatNumber(
  value: number | null | undefined,
  options: Intl.NumberFormatOptions = {}
): string {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return FALLBACK
  }

  return new Intl.NumberFormat(DEFAULT_LOCALE, options).format(value)
}

export function formatDecimal(
  value: number | null | undefined,
  fractionDigits = 2
): string {
  return formatNumber(value, {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  })
}

/**
 * Formats a ratio as a percentage: `formatPercent(0.925)` → `"92.5%"`.
 * Pass `fractionDigits` to override the precision.
 */
export function formatPercent(
  value: number | null | undefined,
  fractionDigits = 1
): string {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return FALLBACK
  }

  return new Intl.NumberFormat(DEFAULT_LOCALE, {
    style: "percent",
    maximumFractionDigits: fractionDigits,
  }).format(value)
}

export function formatCurrency(
  value: number | null | undefined,
  currency = "USD",
  options: Intl.NumberFormatOptions = {}
): string {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return FALLBACK
  }

  return new Intl.NumberFormat(DEFAULT_LOCALE, {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
    ...options,
  }).format(value)
}

export function formatFileSize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return FALLBACK
  if (bytes < 1024) return `${bytes} B`

  const units = ["KB", "MB", "GB", "TB"]
  let value = bytes / 1024
  let unit = 0

  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024
    unit += 1
  }

  return `${value.toFixed(value >= 10 ? 0 : 1)} ${units[unit]}`
}

/** Value suitable for `<input type="date" />` (`yyyy-MM-dd`, company time). */
export function toDateInputValue(value: DateInput): string {
  return formatDate(value, { pattern: "yyyy-MM-dd", fallback: "" })
}

/** Alias for `toDateInputValue`, kept for readability in export code. */
export function formatIsoDate(value: DateInput): string {
  return toDateInputValue(value)
}

/** Parse a `YYYY-MM-DD` input as a UTC midnight business date. */
export function toDateOnly(value: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null
  const date = new Date(`${value}T00:00:00.000Z`)
  return Number.isNaN(date.getTime()) ? null : date
}

/**
 * Serialises params for a GET form or link. Skips null, undefined, and blank
 * values. Returns a string with a leading `?`, or an empty string.
 */
export function buildQueryString(
  params: Record<string, string | number | undefined | null>
): string {
  const search = new URLSearchParams()

  for (const [key, raw] of Object.entries(params)) {
    if (raw === null || raw === undefined) continue
    const value = String(raw).trim()
    if (!value) continue
    search.append(key, value)
  }

  const query = search.toString()
  return query ? `?${query}` : ""
}

/** `"Raman Daksh"` → `"RD"`. */
export function initials(name: string | null | undefined): string {
  const parts = name?.trim().split(/\s+/).filter(Boolean) ?? []
  if (parts.length === 0) return "?"

  return parts
    .slice(0, 2)
    .map((part) => part.charAt(0))
    .join("")
    .toUpperCase()
}

/** `"PENDING_REVIEW"` → `"Pending review"`. */
export function humanizeEnum(value: string | null | undefined): string {
  if (!value) return FALLBACK

  const words = value
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .trim()
    .toLowerCase()

  if (!words) return FALLBACK
  return words.charAt(0).toUpperCase() + words.slice(1)
}

/** `"pending_review"` → `"Pending Review"`. */
export function titleCase(value: string | null | undefined): string {
  if (!value) return FALLBACK

  return value
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .trim()
    .split(/\s+/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ")
}

export function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
}

export function truncate(value: string, max = 80): string {
  if (value.length <= max) return value
  return `${value.slice(0, Math.max(0, max - 1)).trimEnd()}…`
}

/** Percentage change between two values, e.g. `percentChange(120, 100)` → `20`. */
export function percentChange(current: number, previous: number): number {
  if (previous === 0) return current === 0 ? 0 : 100
  return ((current - previous) / previous) * 100
}
