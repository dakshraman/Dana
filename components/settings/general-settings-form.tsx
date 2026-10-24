"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"

import { FormField } from "@/components/shared/form-field"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { errorMessage, fieldErrors, patchJson } from "@/lib/client-api"
import type { SystemSettings } from "@/lib/settings"

export function GeneralSettingsForm({ settings }: { settings: SystemSettings }) {
  const router = useRouter()
  const [companyName, setCompanyName] = React.useState(settings.companyName)
  const [timezone, setTimezone] = React.useState(settings.timezone)
  const [allowSelfApproval, setAllowSelfApproval] = React.useState(
    settings.allowSelfApproval
  )
  const [overdueDays, setOverdueDays] = React.useState(String(settings.overdueDays))
  const [errors, setErrors] = React.useState<Record<string, string[]>>({})
  const [pending, setPending] = React.useState(false)

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setPending(true)
    setErrors({})

    try {
      await patchJson("/api/settings", {
        companyName,
        timezone,
        allowSelfApproval,
        overdueDays,
      })
      toast.success("Settings updated.")
      router.refresh()
    } catch (error) {
      setErrors(fieldErrors(error))
      toast.error(errorMessage(error))
    } finally {
      setPending(false)
    }
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-6">
      <div className="grid gap-5 sm:grid-cols-2">
        <FormField
          label="Company name"
          htmlFor="companyName"
          required
          description="Used in page titles, exports and system notifications."
          error={errors.companyName?.[0]}
        >
          <Input
            id="companyName"
            value={companyName}
            onChange={(event) => setCompanyName(event.target.value)}
            maxLength={120}
          />
        </FormField>

        <FormField
          label="Timezone"
          htmlFor="timezone"
          required
          description="IANA timezone used for business dates and reporting."
          error={errors.timezone?.[0]}
        >
          <Input
            id="timezone"
            value={timezone}
            onChange={(event) => setTimezone(event.target.value)}
            placeholder="UTC"
            maxLength={80}
          />
        </FormField>

        <FormField
          label="Overdue threshold"
          htmlFor="overdueDays"
          required
          description="Days after submission before a pending record is considered overdue."
          error={errors.overdueDays?.[0]}
        >
          <Input
            id="overdueDays"
            type="number"
            min={1}
            max={90}
            value={overdueDays}
            onChange={(event) => setOverdueDays(event.target.value)}
          />
        </FormField>

        <div className="flex flex-col justify-end gap-1.5">
          <label className="flex items-start gap-2 border border-border bg-muted/20 px-3 py-2.5 text-sm">
            <input
              type="checkbox"
              checked={allowSelfApproval}
              onChange={(event) => setAllowSelfApproval(event.target.checked)}
              className="mt-0.5 size-4 accent-primary"
            />
            <span>
              Allow self-approval
              <span className="block text-xs text-muted-foreground">
                When off, reviewers cannot approve records they submitted.
              </span>
            </span>
          </label>
        </div>
      </div>

      <div className="border-t pt-5">
        <Button type="submit" size="sm" disabled={pending}>
          {pending ? "Saving..." : "Save settings"}
        </Button>
      </div>
    </form>
  )
}
