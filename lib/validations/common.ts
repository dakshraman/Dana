import { z } from "zod"

export const pageSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
})

export const isoDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Use a date in YYYY-MM-DD format.")

export const idSchema = z.string().min(1).max(64)

export const optionalTrimmed = (max = 200) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((value) => (value ? value : undefined))

export const emptyToUndefined = (value: unknown) =>
  value === "" || value === null || value === undefined ? undefined : value
