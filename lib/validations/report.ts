import { z } from "zod"

import { isoDateSchema, pageSchema } from "@/lib/validations/common"

export const reportQuerySchema = pageSchema.extend({
  q: z.string().trim().max(120).optional(),
  branchId: z.string().max(64).optional(),
  regionId: z.string().max(64).optional(),
  country: z.string().trim().max(80).optional(),
  city: z.string().trim().max(80).optional(),
  categoryId: z.string().max(64).optional(),
  status: z
    .enum([
      "all",
      "DRAFT",
      "SUBMITTED",
      "APPROVED",
      "REJECTED",
      "RETURNED",
      "ARCHIVED",
    ])
    .default("all"),
  from: isoDateSchema.optional(),
  to: isoDateSchema.optional(),
  sort: z
    .enum(["recordDate", "recordNumber", "title", "status", "createdAt"])
    .default("recordDate"),
  direction: z.enum(["asc", "desc"]).default("desc"),
})

export const exportQuerySchema = reportQuerySchema.extend({
  format: z.enum(["csv", "xlsx", "pdf"]).default("csv"),
})

export type ReportQueryInput = z.infer<typeof reportQuerySchema>
export type ExportQueryInput = z.infer<typeof exportQuerySchema>
