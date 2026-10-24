"use client"

import * as React from "react"
import { toast } from "sonner"

import { FormField } from "@/components/shared/form-field"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { errorMessage, fieldErrors, postJson } from "@/lib/client-api"

const EMPTY = {
  currentPassword: "",
  newPassword: "",
  confirmPassword: "",
}

export function PasswordForm() {
  const [values, setValues] = React.useState(EMPTY)
  const [errors, setErrors] = React.useState<Record<string, string[]>>({})
  const [pending, setPending] = React.useState(false)

  function update(key: keyof typeof EMPTY, value: string) {
    setValues((current) => ({ ...current, [key]: value }))
  }

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setPending(true)
    setErrors({})

    try {
      await postJson("/api/account/password", values)
      toast.success("Password changed.")
      setValues(EMPTY)
    } catch (error) {
      setErrors(fieldErrors(error))
      toast.error(errorMessage(error))
    } finally {
      setPending(false)
    }
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4">
      <FormField
        label="Current password"
        htmlFor="currentPassword"
        required
        error={errors.currentPassword?.[0]}
      >
        <Input
          id="currentPassword"
          type="password"
          value={values.currentPassword}
          onChange={(event) => update("currentPassword", event.target.value)}
          autoComplete="current-password"
        />
      </FormField>

      <FormField
        label="New password"
        htmlFor="newPassword"
        required
        description="At least 12 characters with upper and lower case letters and a number."
        error={errors.newPassword?.[0]}
      >
        <Input
          id="newPassword"
          type="password"
          value={values.newPassword}
          onChange={(event) => update("newPassword", event.target.value)}
          autoComplete="new-password"
        />
      </FormField>

      <FormField
        label="Confirm new password"
        htmlFor="confirmPassword"
        required
        error={errors.confirmPassword?.[0]}
      >
        <Input
          id="confirmPassword"
          type="password"
          value={values.confirmPassword}
          onChange={(event) => update("confirmPassword", event.target.value)}
          autoComplete="new-password"
        />
      </FormField>

      <div>
        <Button type="submit" size="sm" disabled={pending}>
          {pending ? "Updating..." : "Change password"}
        </Button>
      </div>
    </form>
  )
}
