import { z } from "zod"

import { pageSchema } from "@/lib/validations/common"

export const branchCreateSchema = z.object({
  code: z
    .string()
    .trim()
    .toUpperCase()
    .min(2, "Branch code must be at least 2 characters.")
    .max(20, "Branch code must be at most 20 characters.")
    .regex(
      /^[A-Z0-9][A-Z0-9-]*$/,
      "Use letters, numbers and hyphens only."
    ),
  name: z.string().trim().min(2, "Branch name is required.").max(160),
  country: z.string().trim().min(2, "Country is required.").max(80),
  state: z.string().trim().min(2, "State or province is required.").max(80),
  city: z.string().trim().min(2, "City is required.").max(80),
  address: z.string().trim().min(5, "Address is required.").max(300),
  contactPerson: z.string().trim().min(2, "Contact person is required.").max(120),
  email: z.email("Enter a valid email address."),
  phone: z.string().trim().min(5, "Phone number is required.").max(40),
  regionId: z.string().min(1, "Region is required."),
  managerId: z.string().min(1).nullable().optional(),
  isActive: z.boolean().default(true),
})

export const branchUpdateSchema = branchCreateSchema.partial()

export const branchQuerySchema = pageSchema.extend({
  q: z.string().trim().max(120).optional(),
  country: z.string().trim().max(80).optional(),
  regionId: z.string().max(64).optional(),
  city: z.string().trim().max(80).optional(),
  status: z.enum(["all", "active", "inactive"]).default("all"),
  sort: z.enum(["name", "code", "country", "createdAt"]).default("name"),
  direction: z.enum(["asc", "desc"]).default("asc"),
})

export type BranchCreateInput = z.infer<typeof branchCreateSchema>
export type BranchUpdateInput = z.infer<typeof branchUpdateSchema>
export type BranchQueryInput = z.infer<typeof branchQuerySchema>

export const regionCreateSchema = z.object({
  code: z
    .string()
    .trim()
    .toUpperCase()
    .min(2)
    .max(20)
    .regex(/^[A-Z0-9][A-Z0-9-]*$/),
  name: z.string().trim().min(2).max(120),
  description: z.string().trim().max(500).optional(),
})
