"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"

import { FormField } from "@/components/shared/form-field"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { errorMessage, fieldErrors, patchJson } from "@/lib/client-api"

export function ProfileForm({ name }: { name: string }) {
  const router = useRouter()
  const [value, setValue] = React.useState(name)
  const [errors, setErrors] = React.useState<Record<string, string[]>>({})
  const [pending, setPending] = React.useState(false)

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setPending(true)
    setErrors({})

    try {
      await patchJson("/api/account/profile", { name: value })
      toast.success("Profile updated.")
      router.refresh()
    } catch (error) {
      setErrors(fieldErrors(error))
      toast.error(errorMessage(error))
    } finally {
      setPending(false)
    }
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4">
      <FormField label="Display name" htmlFor="name" required error={errors.name?.[0]}>
        <Input
          id="name"
          value={value}
          onChange={(event) => setValue(event.target.value)}
          autoComplete="name"
          maxLength={120}
        />
      </FormField>
      <div>
        <Button type="submit" size="sm" disabled={pending || value.trim() === name}>
          {pending ? "Saving..." : "Save profile"}
        </Button>
      </div>
    </form>
  )
}
