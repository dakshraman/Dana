"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { toast } from "sonner"

import { FormField } from "@/components/shared/form-field"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { errorMessage, fieldErrors, patchJson, postJson } from "@/lib/client-api"

export type RegionFormInitial = {
  id: string
  code: string
  name: string
  description: string | null
}

export function RegionForm({
  mode,
  initial,
}: {
  mode: "create" | "edit"
  initial?: RegionFormInitial
}) {
  const router = useRouter()
  const [code, setCode] = React.useState(initial?.code ?? "")
  const [name, setName] = React.useState(initial?.name ?? "")
  const [description, setDescription] = React.useState(initial?.description ?? "")
  const [errors, setErrors] = React.useState<Record<string, string[]>>({})
  const [pending, setPending] = React.useState(false)

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setPending(true)
    setErrors({})

    const payload = {
      code,
      name,
      description: description.trim() || null,
    }

    try {
      if (mode === "create") {
        await postJson("/api/regions", payload)
        toast.success("Region created.")
      } else {
        await patchJson(`/api/regions/${initial?.id}`, payload)
        toast.success("Region updated.")
      }
      router.push("/settings?tab=regions")
      router.refresh()
    } catch (error) {
      setErrors(fieldErrors(error))
      toast.error(errorMessage(error))
    } finally {
      setPending(false)
    }
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-5">
      <div className="grid gap-5 sm:grid-cols-2">
        <FormField label="Code" htmlFor="code" required error={errors.code?.[0]}>
          <Input
            id="code"
            value={code}
            onChange={(event) => setCode(event.target.value.toUpperCase())}
            placeholder="NA"
            autoComplete="off"
          />
        </FormField>

        <FormField label="Name" htmlFor="name" required error={errors.name?.[0]}>
          <Input
            id="name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="North America"
          />
        </FormField>
      </div>

      <FormField
        label="Description"
        htmlFor="description"
        error={errors.description?.[0]}
      >
        <Textarea
          id="description"
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          placeholder="Optional context for this region"
          maxLength={500}
        />
      </FormField>

      <div className="flex flex-wrap items-center gap-2 border-t pt-5">
        <Button type="submit" disabled={pending}>
          {pending
            ? "Saving..."
            : mode === "create"
              ? "Create region"
              : "Save changes"}
        </Button>
        <Button variant="outline" render={<Link href="/settings?tab=regions" />}>
          Cancel
        </Button>
      </div>
    </form>
  )
}
