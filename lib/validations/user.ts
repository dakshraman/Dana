import { z } from "zod"

import { pageSchema } from "@/lib/validations/common"
import { ROLES } from "@/lib/permissions"

const roleSchema = z.enum(ROLES)

export const userCreateSchema = z
  .object({
    name: z.string().trim().min(2, "Name is required.").max(120),
    email: z.email("Enter a valid email address."),
    password: z
      .string()
      .min(12, "Use at least 12 characters.")
      .max(200)
      .regex(/[a-z]/, "Include a lowercase letter.")
      .regex(/[A-Z]/, "Include an uppercase letter.")
      .regex(/[0-9]/, "Include a number."),
    role: roleSchema,
    isActive: z.boolean().default(true),
    branchIds: z.array(z.string().min(1)).default([]),
    regionIds: z.array(z.string().min(1)).default([]),
  })
  .superRefine((data, ctx) => {
    if (data.role === "REGIONAL_MANAGER" && data.regionIds.length === 0) {
      ctx.addIssue({
        code: "custom",
        path: ["regionIds"],
        message: "Assign at least one region to a regional manager.",
      })
    }
    if (
      (data.role === "BRANCH_MANAGER" || data.role === "BRANCH_EMPLOYEE") &&
      data.branchIds.length === 0
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["branchIds"],
        message: "Assign at least one branch.",
      })
    }
  })

export const userUpdateSchema = z.object({
  name: z.string().trim().min(2).max(120).optional(),
  role: roleSchema.optional(),
  isActive: z.boolean().optional(),
  branchIds: z.array(z.string().min(1)).optional(),
  regionIds: z.array(z.string().min(1)).optional(),
  password: z
    .string()
    .min(12, "Use at least 12 characters.")
    .max(200)
    .regex(/[a-z]/, "Include a lowercase letter.")
    .regex(/[A-Z]/, "Include an uppercase letter.")
    .regex(/[0-9]/, "Include a number.")
    .optional(),
})

export const userQuerySchema = pageSchema.extend({
  q: z.string().trim().max(120).optional(),
  role: z.enum([...ROLES, "all"]).default("all"),
  status: z.enum(["all", "active", "inactive"]).default("all"),
  branchId: z.string().max(64).optional(),
})

export const profileUpdateSchema = z.object({
  name: z.string().trim().min(2).max(120),
})

export type UserCreateInput = z.infer<typeof userCreateSchema>
export type UserUpdateInput = z.infer<typeof userUpdateSchema>
export type UserQueryInput = z.infer<typeof userQuerySchema>
