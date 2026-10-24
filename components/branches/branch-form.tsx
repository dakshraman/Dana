"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"

import { FormField } from "@/components/shared/form-field"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { errorMessage, fieldErrors, patchJson, postJson } from "@/lib/client-api"

type Option = { id: string; code: string; name: string }

export type BranchFormValues = {
  id?: string
  code: string
  name: string
  country: string
  state: string
  city: string
  address: string
  contactPerson: string
  email: string
  phone: string
  regionId: string
  managerId: string | null
  isActive: boolean
}

const EMPTY: BranchFormValues = {
  code: "",
  name: "",
  country: "",
  state: "",
  city: "",
  address: "",
  contactPerson: "",
  email: "",
  phone: "",
  regionId: "",
  managerId: "",
  isActive: true,
}

export function BranchForm({
  mode,
  initial,
  regions,
  managers,
}: {
  mode: "create" | "edit"
  initial?: Partial<BranchFormValues>
  regions: Option[]
  managers: (Option & { email: string })[]
}) {
  const router = useRouter()
  const [values, setValues] = useState<BranchFormValues>({
    ...EMPTY,
    ...initial,
    managerId: initial?.managerId ?? "",
  })
  const [errors, setErrors] = useState<Record<string, string[]>>({})
  const [pending, setPending] = useState(false)

  function update<K extends keyof BranchFormValues>(
    key: K,
    value: BranchFormValues[K]
  ) {
    setValues((current) => ({ ...current, [key]: value }))
  }

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setPending(true)
    setErrors({})

    const payload = {
      ...values,
      managerId: values.managerId ? values.managerId : null,
    }

    try {
      if (mode === "create") {
        const branch = await postJson<{ id: string }>("/api/branches", payload)
        toast.success("Branch created.")
        router.push(`/branches/${branch.id}`)
      } else {
        await patchJson(`/api/branches/${values.id}`, payload)
        toast.success("Branch updated.")
        router.push(`/branches/${values.id}`)
        router.refresh()
      }
    } catch (error) {
      setErrors(fieldErrors(error))
      toast.error(errorMessage(error))
    } finally {
      setPending(false)
    }
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-8">
      <fieldset className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        <legend className="mb-3 text-[11px] font-semibold tracking-widest text-muted-foreground uppercase">
          Identification
        </legend>

        <FormField label="Branch code" htmlFor="code" required error={errors.code?.[0]}>
          <Input
            id="code"
            value={values.code}
            onChange={(event) => update("code", event.target.value.toUpperCase())}
            placeholder="DET"
            autoComplete="off"
          />
        </FormField>

        <FormField label="Branch name" htmlFor="name" required error={errors.name?.[0]}>
          <Input
            id="name"
            value={values.name}
            onChange={(event) => update("name", event.target.value)}
            placeholder="Detroit Operations"
          />
        </FormField>

        <FormField label="Region" htmlFor="regionId" required error={errors.regionId?.[0]}>
          <select
            id="regionId"
            value={values.regionId}
            onChange={(event) => update("regionId", event.target.value)}
            className="h-10 w-full border-b border-input bg-transparent px-0 text-sm outline-none focus-visible:border-b-ring"
          >
            <option value="">Select a region</option>
            {regions.map((region) => (
              <option key={region.id} value={region.id}>
                {region.name} ({region.code})
              </option>
            ))}
          </select>
        </FormField>

        <FormField
          label="Branch manager"
          htmlFor="managerId"
          description="Managers can review submissions for this branch."
          error={errors.managerId?.[0]}
        >
          <select
            id="managerId"
            value={values.managerId ?? ""}
            onChange={(event) => update("managerId", event.target.value)}
            className="h-10 w-full border-b border-input bg-transparent px-0 text-sm outline-none focus-visible:border-b-ring"
          >
            <option value="">Unassigned</option>
            {managers.map((manager) => (
              <option key={manager.id} value={manager.id}>
                {manager.name} — {manager.email}
              </option>
            ))}
          </select>
        </FormField>

        <FormField label="Status" htmlFor="isActive">
          <label className="flex h-10 items-center gap-2 text-sm">
            <input
              id="isActive"
              type="checkbox"
              checked={values.isActive}
              onChange={(event) => update("isActive", event.target.checked)}
              className="size-4 accent-primary"
            />
            Active branch
          </label>
        </FormField>
      </fieldset>

      <fieldset className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        <legend className="mb-3 text-[11px] font-semibold tracking-widest text-muted-foreground uppercase">
          Location & contact
        </legend>

        <FormField label="Country" htmlFor="country" required error={errors.country?.[0]}>
          <Input
            id="country"
            value={values.country}
            onChange={(event) => update("country", event.target.value)}
          />
        </FormField>

        <FormField label="State / province" htmlFor="state" required error={errors.state?.[0]}>
          <Input
            id="state"
            value={values.state}
            onChange={(event) => update("state", event.target.value)}
          />
        </FormField>

        <FormField label="City" htmlFor="city" required error={errors.city?.[0]}>
          <Input
            id="city"
            value={values.city}
            onChange={(event) => update("city", event.target.value)}
          />
        </FormField>

        <FormField
          label="Street address"
          htmlFor="address"
          required
          error={errors.address?.[0]}
          className="sm:col-span-2"
        >
          <Input
            id="address"
            value={values.address}
            onChange={(event) => update("address", event.target.value)}
          />
        </FormField>

        <FormField
          label="Contact person"
          htmlFor="contactPerson"
          required
          error={errors.contactPerson?.[0]}
        >
          <Input
            id="contactPerson"
            value={values.contactPerson}
            onChange={(event) => update("contactPerson", event.target.value)}
          />
        </FormField>

        <FormField label="Email" htmlFor="email" required error={errors.email?.[0]}>
          <Input
            id="email"
            type="email"
            value={values.email}
            onChange={(event) => update("email", event.target.value)}
          />
        </FormField>

        <FormField label="Phone" htmlFor="phone" required error={errors.phone?.[0]}>
          <Input
            id="phone"
            value={values.phone}
            onChange={(event) => update("phone", event.target.value)}
          />
        </FormField>
      </fieldset>

      <div className="flex flex-wrap items-center gap-2 border-t pt-5">
        <Button type="submit" disabled={pending}>
          {pending ? "Saving..." : mode === "create" ? "Create branch" : "Save changes"}
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => router.back()}
          disabled={pending}
        >
          Cancel
        </Button>
      </div>
    </form>
  )
}
