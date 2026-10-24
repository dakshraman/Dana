import { describe, expect, it } from "vitest"

import {
  buildQueryString,
  formatCurrency,
  formatDate,
  formatDateTime,
  formatFileSize,
  formatNumber,
  formatPercent,
  humanizeEnum,
  initials,
  percentChange,
  slugify,
  titleCase,
  toDateInputValue,
  truncate,
} from "@/lib/format"

describe("date formatting", () => {
  it("renders timestamps in India Standard Time", () => {
    expect(formatDate("2026-10-23T23:30:00.000Z")).toBe("Oct 24, 2026")
    expect(formatDateTime("2026-10-23T23:30:00.000Z")).toBe(
      "Oct 24, 2026, 05:00"
    )
  })

  it("treats ISO strings without an offset as UTC", () => {
    expect(formatDate("2026-01-01T00:30:00")).toBe("Jan 1, 2026")
    expect(formatDateTime("2026-01-01T00:30:00")).toBe("Jan 1, 2026, 06:00")
  })

  it("returns the fallback for missing or invalid values", () => {
    expect(formatDate(null)).toBe("—")
    expect(formatDate("not-a-date", { fallback: "n/a" })).toBe("n/a")
  })

  it("produces date input values in company time", () => {
    expect(toDateInputValue(new Date("2026-07-04T12:00:00.000Z"))).toBe(
      "2026-07-04"
    )
    expect(toDateInputValue(new Date("2026-07-04T20:00:00.000Z"))).toBe(
      "2026-07-05"
    )
  })
})

describe("number formatting", () => {
  it("formats numbers, percentages and currency", () => {
    expect(formatNumber(1234567)).toBe("1,234,567")
    expect(formatNumber(null)).toBe("—")
    expect(formatPercent(0.925)).toBe("92.5%")
    expect(formatCurrency(12.5, "USD")).toBe("$12.50")
  })

  it("formats file sizes", () => {
    expect(formatFileSize(512)).toBe("512 B")
    expect(formatFileSize(1536)).toBe("1.5 KB")
    expect(formatFileSize(10 * 1024 * 1024)).toBe("10 MB")
  })

  it("computes percentage change safely", () => {
    expect(percentChange(120, 100)).toBe(20)
    expect(percentChange(0, 0)).toBe(0)
    expect(percentChange(5, 0)).toBe(100)
  })
})

describe("text helpers", () => {
  it("humanizes enum values", () => {
    expect(humanizeEnum("PENDING_REVIEW")).toBe("Pending review")
    expect(humanizeEnum("REGIONAL_MANAGER")).toBe("Regional manager")
    expect(humanizeEnum("")).toBe("—")
  })

  it("title cases and slugifies", () => {
    expect(titleCase("dailyOps_report")).toBe("Daily Ops Report")
    expect(slugify("North America / East")).toBe("north-america-east")
  })

  it("generates initials and truncates", () => {
    expect(initials("Raman Daksh")).toBe("RD")
    expect(initials("Prince")).toBe("P")
    expect(initials(null)).toBe("?")
    expect(truncate("abcdef", 4)).toBe("abc…")
  })

  it("builds query strings without blank values", () => {
    expect(
      buildQueryString({ page: 2, q: "acme", blank: "", missing: undefined })
    ).toBe("?page=2&q=acme")
    expect(buildQueryString({ blank: "" })).toBe("")
  })
})
