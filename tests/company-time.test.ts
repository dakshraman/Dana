import { describe, expect, it } from "vitest"

import {
  addDays,
  companyDateOnly,
  companyDayStart,
  companyMonthStart,
  shiftToCompanyTime,
} from "@/lib/company-time"

describe("company time (Asia/Kolkata)", () => {
  it("shifts a UTC instant by the fixed +05:30 offset", () => {
    expect(
      shiftToCompanyTime(new Date("2026-10-23T18:30:00.000Z")).toISOString()
    ).toBe("2026-10-24T00:00:00.000Z")
  })

  it("rolls the business date over at IST midnight, not UTC midnight", () => {
    expect(
      companyDateOnly(new Date("2026-10-23T18:29:59.000Z")).toISOString()
    ).toBe("2026-10-23T00:00:00.000Z")
    expect(
      companyDateOnly(new Date("2026-10-23T18:30:00.000Z")).toISOString()
    ).toBe("2026-10-24T00:00:00.000Z")
  })

  it("returns the instant an IST business day starts", () => {
    expect(
      companyDayStart(new Date("2026-10-24T06:00:00.000Z")).toISOString()
    ).toBe("2026-10-23T18:30:00.000Z")
  })

  it("returns the first day of the IST month as a date-only value", () => {
    expect(
      companyMonthStart(new Date("2026-10-31T20:00:00.000Z")).toISOString()
    ).toBe("2026-11-01T00:00:00.000Z")
    expect(
      companyMonthStart(new Date("2026-10-30T20:00:00.000Z")).toISOString()
    ).toBe("2026-10-01T00:00:00.000Z")
  })

  it("adds whole days without DST surprises", () => {
    expect(addDays(new Date("2026-10-24T00:00:00.000Z"), 1).toISOString()).toBe(
      "2026-10-25T00:00:00.000Z"
    )
  })
})
