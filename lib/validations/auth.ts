import { z } from "zod"

export const loginSchema = z.object({
  email: z.email("Enter a valid email address."),
  password: z.string().min(1, "Password is required.").max(200),
})

export type LoginInput = z.infer<typeof loginSchema>

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, "Current password is required."),
    newPassword: z
      .string()
      .min(12, "Use at least 12 characters.")
      .max(200)
      .regex(/[a-z]/, "Include a lowercase letter.")
      .regex(/[A-Z]/, "Include an uppercase letter.")
      .regex(/[0-9]/, "Include a number."),
    confirmPassword: z.string(),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: "Passwords do not match.",
    path: ["confirmPassword"],
  })

export type ChangePasswordInput = z.infer<typeof changePasswordSchema>
