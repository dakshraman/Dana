import { z } from "zod"

import { isoDateSchema, pageSchema } from "@/lib/validations/common"

export const recordValueInputSchema = z.union([
  z.string(),
  z.number(),
  z.boolean(),
  z.null(),
])

export const recordValuesSchema = z.record(
  z.string().min(1).max(80),
  recordValueInputSchema
)

export const recordCreateSchema = z.object({
  branchId: z.string().min(1, "Branch is required."),
  categoryId: z.string().min(1, "Category is required."),
  recordDate: isoDateSchema,
  title: z.string().trim().min(3, "Title must be at least 3 characters.").max(200),
  referenceNumber: z.string().trim().max(80).optional(),
  remarks: z.string().trim().max(4000).optional(),
  values: recordValuesSchema.default({}),
  submit: z.boolean().default(false),
})

export const recordUpdateSchema = z.object({
  categoryId: z.string().min(1).optional(),
  recordDate: isoDateSchema.optional(),
  title: z.string().trim().min(3).max(200).optional(),
  referenceNumber: z.string().trim().max(80).nullable().optional(),
  remarks: z.string().trim().max(4000).nullable().optional(),
  values: recordValuesSchema.optional(),
})

export const recordQuerySchema = pageSchema.extend({
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
    .enum(["recordDate", "recordNumber", "title", "status", "createdAt", "updatedAt"])
    .default("createdAt"),
  direction: z.enum(["asc", "desc"]).default("desc"),
})

export const reviewSchema = z
  .object({
    decision: z.enum(["APPROVE", "REJECT", "RETURN"]),
    comment: z.string().trim().max(2000).optional(),
  })
  .superRefine((data, ctx) => {
    if (data.decision !== "APPROVE" && !data.comment) {
      ctx.addIssue({
        code: "custom",
        path: ["comment"],
        message: "A comment is required when rejecting or returning a record.",
      })
    }
  })

export const submitSchema = z.object({
  comment: z.string().trim().max(2000).optional(),
})

export const archiveSchema = z.object({
  reason: z.string().trim().max(500).optional(),
})

export type RecordCreateInput = z.infer<typeof recordCreateSchema>
export type RecordUpdateInput = z.infer<typeof recordUpdateSchema>
export type RecordQueryInput = z.infer<typeof recordQuerySchema>
export type ReviewInput = z.infer<typeof reviewSchema>
