import { z } from "zod"

const fieldTypeSchema = z.enum([
  "TEXT",
  "TEXTAREA",
  "NUMBER",
  "DECIMAL",
  "DATE",
  "BOOLEAN",
  "SELECT",
])

export const customFieldSchema = z
  .object({
    id: z.string().optional(),
    key: z
      .string()
      .trim()
      .min(1, "Field key is required.")
      .max(60)
      .regex(
        /^[a-z][a-zA-Z0-9_]*$/,
        "Use lowerCamelCase letters, numbers and underscores, starting with a letter."
      ),
    label: z.string().trim().min(1, "Field label is required.").max(120),
    type: fieldTypeSchema,
    required: z.boolean().default(false),
    options: z.array(z.string().trim().min(1)).default([]),
    placeholder: z.string().trim().max(120).optional(),
    helpText: z.string().trim().max(300).optional(),
    minValue: z.coerce.number().optional(),
    maxValue: z.coerce.number().optional(),
    maxLength: z.coerce.number().int().min(1).max(10000).optional(),
    sortOrder: z.coerce.number().int().min(0).default(0),
    isActive: z.boolean().default(true),
  })
  .superRefine((field, ctx) => {
    if (field.type === "SELECT" && field.options.length === 0) {
      ctx.addIssue({
        code: "custom",
        path: ["options"],
        message: "Add at least one option for a select field.",
      })
    }
    if (
      field.minValue !== undefined &&
      field.maxValue !== undefined &&
      field.minValue > field.maxValue
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["maxValue"],
        message: "Maximum must be greater than the minimum.",
      })
    }
  })

export const categoryCreateSchema = z.object({
  code: z
    .string()
    .trim()
    .toUpperCase()
    .min(2)
    .max(30)
    .regex(/^[A-Z0-9][A-Z0-9-]*$/, "Use letters, numbers and hyphens."),
  name: z.string().trim().min(2).max(120),
  description: z.string().trim().max(500).optional(),
  isActive: z.boolean().default(true),
  sortOrder: z.coerce.number().int().min(0).default(0),
  fields: z.array(customFieldSchema).max(50).default([]),
})

export const categoryUpdateSchema = categoryCreateSchema.partial()

export const systemSettingsSchema = z.object({
  companyName: z.string().trim().min(2).max(120),
  timezone: z.string().trim().min(1).max(80),
  allowSelfApproval: z.boolean(),
  overdueDays: z.coerce.number().int().min(1).max(90),
})

export type CustomFieldInput = z.infer<typeof customFieldSchema>
export type CategoryCreateInput = z.infer<typeof categoryCreateSchema>
export type SystemSettingsInput = z.infer<typeof systemSettingsSchema>
