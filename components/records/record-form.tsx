"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"

import { FormField } from "@/components/shared/form-field"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { errorMessage, fieldErrors, patchJson, postJson } from "@/lib/client-api"
import { companyDateOnly } from "@/lib/company-time"
import { humanizeEnum, toDateInputValue } from "@/lib/format"

export type RecordFieldDefinition = {
  id: string
  key: string
  label: string
  type: "TEXT" | "TEXTAREA" | "NUMBER" | "DECIMAL" | "DATE" | "BOOLEAN" | "SELECT"
  required: boolean
  options: unknown
  placeholder: string | null
  helpText: string | null
  minValue: unknown
  maxValue: unknown
  maxLength: number | null
  sortOrder: number
}

export type RecordFormCategory = {
  id: string
  code: string
  name: string
  description: string | null
  fields: RecordFieldDefinition[]
}

export type RecordFormBranch = {
  id: string
  code: string
  name: string
}

type Value = string | number | boolean | null

export type RecordFormInitial = {
  id: string
  branchId: string
  categoryId: string
  recordDate: Date | string
  title: string
  referenceNumber: string | null
  remarks: string | null
  values: Record<string, Value>
}

function optionsFor(field: RecordFieldDefinition): string[] {
  return Array.isArray(field.options)
    ? field.options.filter((item): item is string => typeof item === "string")
    : []
}

function today(): string {
  return companyDateOnly(new Date()).toISOString().slice(0, 10)
}

export function RecordForm({
  mode,
  branches,
  categories,
  initial,
}: {
  mode: "create" | "edit"
  branches: RecordFormBranch[]
  categories: RecordFormCategory[]
  initial?: RecordFormInitial
}) {
  const router = useRouter()
  const [branchId, setBranchId] = React.useState(
    initial?.branchId ?? branches[0]?.id ?? ""
  )
  const [categoryId, setCategoryId] = React.useState(
    initial?.categoryId ?? categories[0]?.id ?? ""
  )
  const [recordDate, setRecordDate] = React.useState(
    initial?.recordDate ? toDateInputValue(initial.recordDate) : today()
  )
  const [title, setTitle] = React.useState(initial?.title ?? "")
  const [referenceNumber, setReferenceNumber] = React.useState(
    initial?.referenceNumber ?? ""
  )
  const [remarks, setRemarks] = React.useState(initial?.remarks ?? "")
  const [values, setValues] = React.useState<Record<string, Value>>(
    initial?.values ?? {}
  )
  const [errors, setErrors] = React.useState<Record<string, string[]>>({})
  const [pendingAction, setPendingAction] = React.useState<
    "draft" | "submit" | null
  >(null)

  const selectedCategory =
    categories.find((category) => category.id === categoryId) ?? categories[0]
  const fields = selectedCategory?.fields ?? []

  function setValue(key: string, value: Value) {
    setValues((current) => ({ ...current, [key]: value }))
  }

  function onCategoryChange(nextId: string) {
    setCategoryId(nextId)
    setValues({})
    setErrors({})
  }

  function buildValues(): Record<string, Value> {
    const output: Record<string, Value> = {}

    for (const field of fields) {
      const value = values[field.key]

      if (field.type === "NUMBER" || field.type === "DECIMAL") {
        output[field.key] =
          value === "" || value === null || value === undefined
            ? null
            : Number(value)
        continue
      }

      if (field.type === "BOOLEAN") {
        output[field.key] = Boolean(value)
        continue
      }

      output[field.key] = value ?? ""
    }

    return output
  }

  async function submit(submitForReview: boolean) {
    setPendingAction(submitForReview ? "submit" : "draft")
    setErrors({})

    try {
      if (!branchId) throw new Error("Select a branch.")
      if (!categoryId) throw new Error("Select a record category.")
      if (!recordDate) throw new Error("Choose a record date.")
      if (title.trim().length < 3) throw new Error("Enter a title of at least 3 characters.")

      if (mode === "create") {
        const record = await postJson<{ id: string }>("/api/records", {
          branchId,
          categoryId,
          recordDate,
          title,
          referenceNumber: referenceNumber || undefined,
          remarks: remarks || undefined,
          values: buildValues(),
          submit: submitForReview,
        })
        toast.success(
          submitForReview
            ? "Record created and submitted for review."
            : "Draft saved."
        )
        router.push(`/records/${record.id}`)
        router.refresh()
        return
      }

      await patchJson(`/api/records/${initial?.id}`, {
        categoryId,
        recordDate,
        title,
        referenceNumber: referenceNumber || null,
        remarks: remarks || null,
        values: buildValues(),
      })

      if (submitForReview) {
        await postJson(`/api/records/${initial?.id}/submit`, {})
        toast.success("Record submitted for review.")
      } else {
        toast.success("Draft saved.")
      }

      router.push(`/records/${initial?.id}`)
      router.refresh()
    } catch (error) {
      setErrors(fieldErrors(error))
      toast.error(errorMessage(error))
    } finally {
      setPendingAction(null)
    }
  }

  return (
    <form
      className="flex flex-col gap-8"
      onSubmit={(event) => {
        event.preventDefault()
        void submit(false)
      }}
    >
      <fieldset className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        <legend className="mb-3 text-[11px] font-semibold tracking-widest text-muted-foreground uppercase">
          Record details
        </legend>

        <FormField label="Branch" htmlFor="branchId" required error={errors.branchId?.[0]}>
          <select
            id="branchId"
            value={branchId}
            onChange={(event) => setBranchId(event.target.value)}
            disabled={mode === "edit"}
            className="h-10 w-full border-b border-input bg-transparent text-sm outline-none focus-visible:border-b-ring disabled:opacity-60"
          >
            <option value="">Select a branch</option>
            {branches.map((branch) => (
              <option key={branch.id} value={branch.id}>
                {branch.name} ({branch.code})
              </option>
            ))}
          </select>
        </FormField>

        <FormField
          label="Category"
          htmlFor="categoryId"
          required
          description={selectedCategory?.description ?? undefined}
          error={errors.categoryId?.[0]}
        >
          <select
            id="categoryId"
            value={categoryId}
            onChange={(event) => onCategoryChange(event.target.value)}
            className="h-10 w-full border-b border-input bg-transparent text-sm outline-none focus-visible:border-b-ring"
          >
            <option value="">Select a category</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
        </FormField>

        <FormField label="Record date" htmlFor="recordDate" required error={errors.recordDate?.[0]}>
          <Input
            id="recordDate"
            type="date"
            value={recordDate}
            onChange={(event) => setRecordDate(event.target.value)}
          />
        </FormField>

        <FormField label="Reference number" htmlFor="referenceNumber" error={errors.referenceNumber?.[0]}>
          <Input
            id="referenceNumber"
            value={referenceNumber}
            onChange={(event) => setReferenceNumber(event.target.value)}
            placeholder="Optional"
          />
        </FormField>

        <FormField
          label="Title"
          htmlFor="title"
          required
          error={errors.title?.[0]}
          className="sm:col-span-2 lg:col-span-4"
        >
          <Input
            id="title"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="Short description of this entry"
          />
        </FormField>
      </fieldset>

      <fieldset className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        <legend className="mb-3 text-[11px] font-semibold tracking-widest text-muted-foreground uppercase">
          {selectedCategory?.name ?? "Category"} fields
        </legend>

        {fields.length === 0 ? (
          <p className="text-sm text-muted-foreground sm:col-span-2 lg:col-span-3">
            Select a category to load its fields.
          </p>
        ) : null}

        {fields.map((field) => {
          const id = `field-${field.key}`
          const error = errors[field.key]?.[0] ?? errors.values?.[0]
          const help = field.helpText ?? undefined

          if (field.type === "BOOLEAN") {
            return (
              <FormField key={field.id} label={field.label} htmlFor={id} required={field.required} description={help} error={error}>
                <label className="flex h-10 items-center gap-2 text-sm">
                  <input
                    id={id}
                    type="checkbox"
                    checked={Boolean(values[field.key])}
                    onChange={(event) => setValue(field.key, event.target.checked)}
                    className="size-4 accent-primary"
                  />
                  Yes
                </label>
              </FormField>
            )
          }

          if (field.type === "SELECT") {
            return (
              <FormField key={field.id} label={field.label} htmlFor={id} required={field.required} description={help} error={error}>
                <select
                  id={id}
                  value={String(values[field.key] ?? "")}
                  onChange={(event) => setValue(field.key, event.target.value)}
                  className="h-10 w-full border-b border-input bg-transparent text-sm outline-none focus-visible:border-b-ring"
                >
                  <option value="">Select an option</option>
                  {optionsFor(field).map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </FormField>
            )
          }

          if (field.type === "TEXTAREA") {
            return (
              <FormField key={field.id} label={field.label} htmlFor={id} required={field.required} description={help} error={error} className="sm:col-span-2 lg:col-span-3">
                <Textarea
                  id={id}
                  value={String(values[field.key] ?? "")}
                  onChange={(event) => setValue(field.key, event.target.value)}
                  placeholder={field.placeholder ?? undefined}
                  maxLength={field.maxLength ?? undefined}
                />
              </FormField>
            )
          }

          return (
            <FormField
              key={field.id}
              label={field.label}
              htmlFor={id}
              required={field.required}
              description={help}
              error={error}
            >
              <Input
                id={id}
                type={
                  field.type === "DATE"
                    ? "date"
                    : field.type === "NUMBER" || field.type === "DECIMAL"
                      ? "number"
                      : "text"
                }
                step={field.type === "DECIMAL" ? "0.0001" : field.type === "NUMBER" ? "1" : undefined}
                min={field.minValue !== null && field.minValue !== undefined ? Number(field.minValue) : undefined}
                max={field.maxValue !== null && field.maxValue !== undefined ? Number(field.maxValue) : undefined}
                maxLength={field.maxLength ?? undefined}
                value={String(values[field.key] ?? "")}
                onChange={(event) => setValue(field.key, event.target.value)}
                placeholder={field.placeholder ?? undefined}
              />
            </FormField>
          )
        })}
      </fieldset>

      <fieldset className="flex flex-col gap-5">
        <legend className="mb-3 text-[11px] font-semibold tracking-widest text-muted-foreground uppercase">
          Notes
        </legend>
        <FormField label="Remarks" htmlFor="remarks" error={errors.remarks?.[0]}>
          <Textarea
            id="remarks"
            value={remarks}
            onChange={(event) => setRemarks(event.target.value)}
            placeholder="Context, exceptions or supporting notes"
            maxLength={4000}
          />
        </FormField>
      </fieldset>

      <div className="flex flex-wrap items-center gap-2 border-t pt-5">
        <Button type="submit" variant="outline" disabled={pendingAction !== null}>
          {pendingAction === "draft" ? "Saving..." : "Save draft"}
        </Button>
        <Button
          type="button"
          disabled={pendingAction !== null}
          onClick={() => void submit(true)}
        >
          {pendingAction === "submit" ? "Submitting..." : "Save and submit"}
        </Button>
        <Button
          type="button"
          variant="ghost"
          onClick={() => router.back()}
          disabled={pendingAction !== null}
        >
          Cancel
        </Button>
        <span className="ml-auto text-[10px] tracking-wider text-muted-foreground uppercase">
          {selectedCategory ? humanizeEnum(selectedCategory.code) : "No category"}
        </span>
      </div>
    </form>
  )
}
