import {
  Prisma,
  type CustomFieldDefinition,
  type RecordValue,
} from "@/lib/generated/prisma/client"
import { badRequest } from "@/lib/http"

/** A stored record value together with its field definition. */
export type FieldWithDefinition = RecordValue & {
  fieldDefinition: CustomFieldDefinition
}

export type ValidatedRecordValue = {
  fieldDefinitionId: string
  valueText?: string
  valueNumber?: Prisma.Decimal
  valueDate?: Date
  valueBoolean?: boolean
  valueJson?: Prisma.InputJsonValue
}

export type RecordValueInput = string | number | boolean | null

const DECIMAL_PLACES = 4

/**
 * Validate and coerce untrusted custom field input for a category.
 *
 * Only active fields are processed. Keys belonging to inactive fields are
 * ignored (so historical values survive a field being deactivated), while keys
 * that do not belong to the category at all are rejected to prevent callers
 * from writing arbitrary field definitions.
 */
export function validateRecordValues(
  fields: CustomFieldDefinition[],
  values: Record<string, RecordValueInput>
): ValidatedRecordValue[] {
  const knownKeys = new Set(fields.map((field) => field.key))
  const unknownKeys = Object.keys(values).filter((key) => !knownKeys.has(key))

  if (unknownKeys.length > 0) {
    throw badRequest(
      `Unknown field${unknownKeys.length === 1 ? "" : "s"}: ${unknownKeys.join(
        ", "
      )}.`
    )
  }

  const result: ValidatedRecordValue[] = []

  for (const field of fields) {
    if (!field.isActive) continue

    const raw = values[field.key]

    if (isBlank(raw)) {
      if (field.required) {
        throw badRequest(`${field.label} is required.`)
      }
      continue
    }

    result.push(validateFieldValue(field, raw))
  }

  return result
}

/** Values keyed by field key, suitable for forms and submit-time checks. */
export function serializeRecordValues(
  recordValues: FieldWithDefinition[],
  fields: Pick<CustomFieldDefinition, "id" | "key" | "type">[]
): Record<string, RecordValueInput> {
  const valuesByFieldId = new Map(
    recordValues.map(
      (recordValue): [string, FieldWithDefinition] => [
        recordValue.fieldDefinitionId,
        recordValue,
      ]
    )
  )
  const result: Record<string, RecordValueInput> = {}

  for (const field of fields) {
    const recordValue = valuesByFieldId.get(field.id)

    if (!recordValue) {
      result[field.key] = null
      continue
    }

    switch (field.type) {
      case "TEXT":
      case "TEXTAREA":
      case "SELECT":
        result[field.key] = recordValue.valueText
        break
      case "NUMBER":
      case "DECIMAL":
        result[field.key] = recordValue.valueNumber
          ? recordValue.valueNumber.toNumber()
          : null
        break
      case "DATE":
        result[field.key] = recordValue.valueDate
          ? recordValue.valueDate.toISOString().slice(0, 10)
          : null
        break
      case "BOOLEAN":
        result[field.key] = recordValue.valueBoolean
        break
    }
  }

  return result
}

/** Active required fields that have no value in the supplied map. */
export function missingRequiredFields(
  fields: CustomFieldDefinition[],
  values: Record<string, RecordValueInput>
): CustomFieldDefinition[] {
  return fields.filter(
    (field) =>
      field.isActive && field.required && isBlank(values[field.key] ?? null)
  )
}

/**
 * Parse a `YYYY-MM-DD` string into a UTC midnight Date. Returns null for
 * impossible dates such as 2026-02-31 as well as malformed input.
 */
export function parseDateOnly(value: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null

  const date = new Date(`${value}T00:00:00.000Z`)
  if (Number.isNaN(date.getTime())) return null

  return date.toISOString().slice(0, 10) === value ? date : null
}

function validateFieldValue(
  field: CustomFieldDefinition,
  raw: RecordValueInput
): ValidatedRecordValue {
  switch (field.type) {
    case "TEXT":
    case "TEXTAREA": {
      const text = coerceText(field, raw)

      if (field.maxLength !== null && text.length > field.maxLength) {
        throw badRequest(
          `${field.label} must be at most ${field.maxLength} characters.`
        )
      }

      return { fieldDefinitionId: field.id, valueText: text }
    }

    case "NUMBER": {
      const value = coerceDecimal(field, raw)

      if (value.decimalPlaces() !== 0) {
        throw badRequest(`${field.label} must be a whole number.`)
      }

      assertInRange(field, value)
      return { fieldDefinitionId: field.id, valueNumber: value }
    }

    case "DECIMAL": {
      const value = coerceDecimal(field, raw)

      if (value.decimalPlaces() > DECIMAL_PLACES) {
        throw badRequest(
          `${field.label} must have at most ${DECIMAL_PLACES} decimal places.`
        )
      }

      assertInRange(field, value)
      return { fieldDefinitionId: field.id, valueNumber: value }
    }

    case "DATE": {
      if (typeof raw !== "string") {
        throw badRequest(`${field.label} must be a valid date.`)
      }

      const date = parseDateOnly(raw.trim())
      if (!date) {
        throw badRequest(
          `${field.label} must be a valid date in YYYY-MM-DD format.`
        )
      }

      return { fieldDefinitionId: field.id, valueDate: date }
    }

    case "BOOLEAN":
      return {
        fieldDefinitionId: field.id,
        valueBoolean: coerceBoolean(field, raw),
      }

    case "SELECT": {
      const value = coerceText(field, raw)
      const options = selectOptions(field)

      if (!options.includes(value)) {
        throw badRequest(
          `${field.label} must be one of the available options.`
        )
      }

      return { fieldDefinitionId: field.id, valueText: value }
    }
  }
}

function coerceText(
  field: CustomFieldDefinition,
  raw: RecordValueInput
): string {
  if (typeof raw === "string") return raw.trim()
  if (typeof raw === "number" || typeof raw === "boolean") return String(raw)

  throw badRequest(`${field.label} must be text.`)
}

function coerceDecimal(
  field: CustomFieldDefinition,
  raw: RecordValueInput
): Prisma.Decimal {
  if (typeof raw === "boolean") {
    throw badRequest(`${field.label} must be a number.`)
  }

  const text = typeof raw === "string" ? raw.trim() : String(raw)
  if (text === "") {
    throw badRequest(`${field.label} must be a number.`)
  }

  try {
    const value = new Prisma.Decimal(text)
    if (!value.isFinite()) throw new Error("not finite")
    return value
  } catch {
    throw badRequest(`${field.label} must be a valid number.`)
  }
}

function assertInRange(
  field: CustomFieldDefinition,
  value: Prisma.Decimal
): void {
  if (field.minValue !== null && value.lt(field.minValue)) {
    throw badRequest(
      `${field.label} must be at least ${field.minValue.toString()}.`
    )
  }

  if (field.maxValue !== null && value.gt(field.maxValue)) {
    throw badRequest(
      `${field.label} must be at most ${field.maxValue.toString()}.`
    )
  }
}

function coerceBoolean(
  field: CustomFieldDefinition,
  raw: RecordValueInput
): boolean {
  if (typeof raw === "boolean") return raw

  if (typeof raw === "number") {
    if (raw === 1) return true
    if (raw === 0) return false
  }

  if (typeof raw === "string") {
    const normalized = raw.trim().toLowerCase()
    if (normalized === "true" || normalized === "1") return true
    if (normalized === "false" || normalized === "0") return false
  }

  throw badRequest(`${field.label} must be true or false.`)
}

function selectOptions(field: CustomFieldDefinition): string[] {
  if (!Array.isArray(field.options)) return []
  return field.options.filter(
    (option): option is string => typeof option === "string"
  )
}

function isBlank(value: RecordValueInput | undefined): boolean {
  return (
    value === null ||
    value === undefined ||
    (typeof value === "string" && value.trim() === "")
  )
}
