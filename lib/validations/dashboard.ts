import { z } from "zod"

import { isoDateSchema } from "@/lib/validations/common"

export const dashboardQuerySchema = z.object({
  from: isoDateSchema.optional(),
  to: isoDateSchema.optional(),
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
    .optional(),
  granularity: z.enum(["day", "week", "month", "year"]).optional(),
})

export type DashboardQueryInput = z.infer<typeof dashboardQuerySchema>
