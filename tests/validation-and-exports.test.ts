import { describe, expect, it } from "vitest"

import { defaultExportFilename } from "@/lib/exports/xlsx"
import { toCsv } from "@/lib/exports/csv"
import {
  Prisma,
  type CustomFieldDefinition,
} from "@/lib/generated/prisma/client"
import {
  missingRequiredFields,
  parseDateOnly,
  serializeRecordValues,
  validateRecordValues,
} from "@/lib/records/fields"
import { userCreateSchema } from "@/lib/validations/user"

function field(
  overrides: Partial<CustomFieldDefinition> = {}
): CustomFieldDefinition {
  return {
    id: "field-1",
    categoryId: "category-1",
    key: "amount",
    label: "Amount",
    type: "NUMBER",
    required: true,
    options: null,
    placeholder: null,
    helpText: null,
    minValue: null,
    maxValue: null,
    maxLength: null,
    sortOrder: 0,
    isActive: true,
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-01-01T00:00:00.000Z"),
    ...overrides,
  }
}

describe("validateRecordValues", () => {
  it("coerces numbers and dates", () => {
    const fields = [
      field(),
      field({
        id: "field-2",
        key: "day",
        label: "Day",
        type: "DATE",
      }),
    ]

    const values = validateRecordValues(fields, {
      amount: "42",
      day: "2026-02-28",
    })

    expect(values).toHaveLength(2)
    expect(values[0].valueNumber?.toNumber()).toBe(42)
    expect(values[1].valueDate?.toISOString()).toBe("2026-02-28T00:00:00.000Z")
  })

  it("rejects unknown keys", () => {
    expect(() => validateRecordValues([field()], { nope: 1 })).toThrow(
      /Unknown field/
    )
  })

  it("requires required fields but ignores inactive ones", () => {
    expect(() => validateRecordValues([field()], {})).toThrow(/required/)
    expect(
      validateRecordValues([field({ isActive: false })], {})
    ).toEqual([])
  })

  it("enforces numeric ranges and whole numbers", () => {
    expect(() =>
      validateRecordValues(
        [field({ type: "NUMBER", minValue: new Prisma.Decimal(10) })],
        { amount: 5 }
      )
    ).toThrow(/at least 10/)
    expect(() =>
      validateRecordValues([field({ type: "NUMBER" })], { amount: 1.5 })
    ).toThrow(/whole number/)
  })

  it("validates select options", () => {
    const select = field({
      key: "severity",
      label: "Severity",
      type: "SELECT",
      options: ["Low", "High"],
      required: false,
    })
    expect(
      validateRecordValues([select], { severity: "High" })[0].valueText
    ).toBe("High")
    expect(() => validateRecordValues([select], { severity: "Extreme" })).toThrow(
      /available options/
    )
  })
})

describe("field helpers", () => {
  it("parses only real calendar dates", () => {
    expect(parseDateOnly("2026-02-28")?.toISOString()).toBe(
      "2026-02-28T00:00:00.000Z"
    )
    expect(parseDateOnly("2026-02-31")).toBeNull()
    expect(parseDateOnly("28-02-2026")).toBeNull()
  })

  it("finds missing required values and serializes stored values", () => {
    const fields = [field(), field({ id: "field-2", key: "notes", type: "TEXT", required: false })]
    expect(missingRequiredFields(fields, { amount: 10 })).toEqual([])
    expect(missingRequiredFields(fields, {})).toHaveLength(1)

    const stored = [
      {
        id: "value-1",
        recordId: "record-1",
        fieldDefinitionId: "field-1",
        valueText: null,
        valueNumber: new Prisma.Decimal(12),
        valueDate: null,
        valueBoolean: null,
        valueJson: null,
        fieldDefinition: field(),
      },
    ]
    expect(serializeRecordValues(stored, fields)).toEqual({
      amount: 12,
      notes: null,
    })
  })
})

describe("CSV export", () => {
  it("escapes headers and cells according to RFC 4180", () => {
    const csv = toCsv(
      [
        { key: "a", label: "Plain" },
        { key: "b", label: "Has, comma" },
      ],
      [{ a: 'He said "hi"', b: "line\nbreak" }]
    )

    expect(csv).toBe(
      'Plain,"Has, comma"\r\n"He said ""hi""","line\nbreak"\r\n'
    )
  })

  it("supports a UTF-8 BOM and empty input", () => {
    expect(toCsv([{ key: "a", label: "A" }], [], { bom: true })).toBe(
      "\uFEFFA\r\n"
    )
    expect(toCsv([], [])).toBe("")
  })

  it("builds deterministic export filenames", () => {
    expect(
      defaultExportFilename("csv", new Date("2026-03-04T05:06:00.000Z"))
    ).toBe("dana-records-20260304-0506.csv")
  })
})

describe("user validation", () => {
  const base = {
    name: "Test User",
    email: "test@example.com",
    password: "LongPassword123",
    role: "SUPER_ADMIN" as const,
    isActive: true,
    branchIds: [],
    regionIds: [],
  }

  it("requires regions for regional managers", () => {
    const result = userCreateSchema.safeParse({
      ...base,
      role: "REGIONAL_MANAGER",
    })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues[0].path).toEqual(["regionIds"])
    }
  })

  it("requires branches for branch roles", () => {
    expect(
      userCreateSchema.safeParse({ ...base, role: "BRANCH_MANAGER" }).success
    ).toBe(false)
    expect(
      userCreateSchema.safeParse({
        ...base,
        role: "BRANCH_EMPLOYEE",
        branchIds: ["branch-1"],
      }).success
    ).toBe(true)
  })

  it("enforces password complexity", () => {
    expect(
      userCreateSchema.safeParse({
        ...base,
        password: "alllowercase123",
      }).success
    ).toBe(false)
  })
})
