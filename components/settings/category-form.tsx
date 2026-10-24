"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { GripVertical, Plus, Trash2 } from "lucide-react"
import { toast } from "sonner"

import { FormField } from "@/components/shared/form-field"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { errorMessage, fieldErrors, patchJson, postJson } from "@/lib/client-api"
import type { FieldType } from "@/lib/generated/prisma/enums"
import { humanizeEnum } from "@/lib/format"

const FIELD_TYPES: FieldType[] = [
  "TEXT",
  "TEXTAREA",
  "NUMBER",
  "DECIMAL",
  "DATE",
  "BOOLEAN",
  "SELECT",
]

type FieldValues = {
  id?: string
  key: string
  label: string
  type: FieldType
  required: boolean
  options: string
  placeholder: string
  helpText: string
  minValue: string
  maxValue: string
  maxLength: string
  sortOrder: number
  isActive: boolean
}

export type CategoryFormField = {
  id: string
  key: string
  label: string
  type: FieldType
  required: boolean
  options: unknown
  placeholder: string | null
  helpText: string | null
  minValue: unknown
  maxValue: unknown
  maxLength: number | null
  sortOrder: number
  isActive: boolean
}

export type CategoryFormInitial = {
  id: string
  code: string
  name: string
  description: string | null
  isActive: boolean
  sortOrder: number
  fields: CategoryFormField[]
}

function optionsToText(options: unknown): string {
  return Array.isArray(options)
    ? options.filter((item): item is string => typeof item === "string").join(", ")
    : ""
}

function toFieldValues(field: CategoryFormField): FieldValues {
  return {
    id: field.id,
    key: field.key,
    label: field.label,
    type: field.type,
    required: field.required,
    options: optionsToText(field.options),
    placeholder: field.placeholder ?? "",
    helpText: field.helpText ?? "",
    minValue: field.minValue !== null ? String(field.minValue) : "",
    maxValue: field.maxValue !== null ? String(field.maxValue) : "",
    maxLength: field.maxLength !== null ? String(field.maxLength) : "",
    sortOrder: field.sortOrder,
    isActive: field.isActive,
  }
}

function emptyField(sortOrder: number): FieldValues {
  return {
    key: "",
    label: "",
    type: "TEXT",
    required: false,
    options: "",
    placeholder: "",
    helpText: "",
    minValue: "",
    maxValue: "",
    maxLength: "",
    sortOrder,
    isActive: true,
  }
}

function numericOrUndefined(value: string): number | undefined {
  const trimmed = value.trim()
  if (!trimmed) return undefined
  const parsed = Number(trimmed)
  return Number.isFinite(parsed) ? parsed : undefined
}

export function CategoryForm({
  mode,
  initial,
}: {
  mode: "create" | "edit"
  initial?: CategoryFormInitial
}) {
  const router = useRouter()
  const [code, setCode] = React.useState(initial?.code ?? "")
  const [name, setName] = React.useState(initial?.name ?? "")
  const [description, setDescription] = React.useState(initial?.description ?? "")
  const [isActive, setIsActive] = React.useState(initial?.isActive ?? true)
  const [sortOrder, setSortOrder] = React.useState(String(initial?.sortOrder ?? 0))
  const [fields, setFields] = React.useState<FieldValues[]>(
    initial?.fields.map(toFieldValues) ?? []
  )
  const [errors, setErrors] = React.useState<Record<string, string[]>>({})
  const [pending, setPending] = React.useState(false)

  function updateField(index: number, patch: Partial<FieldValues>) {
    setFields((current) =>
      current.map((field, position) =>
        position === index ? { ...field, ...patch } : field
      )
    )
  }

  function addField() {
    setFields((current) => [...current, emptyField(current.length)])
  }

  function removeField(index: number) {
    setFields((current) => current.filter((_, position) => position !== index))
  }

  function fieldError(index: number, key: string) {
    return errors[`fields.${index}.${key}`]?.[0]
  }

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setPending(true)
    setErrors({})

    const payload = {
      code,
      name,
      description: description.trim() || undefined,
      isActive,
      sortOrder: Number(sortOrder) || 0,
      fields: fields.map((field, index) => ({
        ...(field.id ? { id: field.id } : {}),
        key: field.key.trim(),
        label: field.label.trim(),
        type: field.type,
        required: field.required,
        options:
          field.type === "SELECT"
            ? field.options
                .split(/[,\n]/)
                .map((option) => option.trim())
                .filter(Boolean)
            : [],
        placeholder: field.placeholder.trim() || undefined,
        helpText: field.helpText.trim() || undefined,
        minValue: numericOrUndefined(field.minValue),
        maxValue: numericOrUndefined(field.maxValue),
        maxLength: numericOrUndefined(field.maxLength),
        sortOrder: field.sortOrder ?? index,
        isActive: field.isActive,
      })),
    }

    try {
      if (mode === "create") {
        await postJson("/api/settings/categories", payload)
        toast.success("Category created.")
      } else {
        await patchJson(`/api/settings/categories/${initial?.id}`, payload)
        toast.success("Category updated.")
      }
      router.push("/settings?tab=categories")
      router.refresh()
    } catch (error) {
      setErrors(fieldErrors(error))
      toast.error(errorMessage(error))
    } finally {
      setPending(false)
    }
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-8">
      <fieldset className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        <legend className="mb-3 text-[11px] font-semibold tracking-widest text-muted-foreground uppercase">
          Category
        </legend>

        <FormField label="Code" htmlFor="code" required error={errors.code?.[0]}>
          <Input
            id="code"
            value={code}
            onChange={(event) => setCode(event.target.value.toUpperCase())}
            placeholder="SALES"
            autoComplete="off"
          />
        </FormField>

        <FormField label="Name" htmlFor="name" required error={errors.name?.[0]}>
          <Input
            id="name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Sales activity"
          />
        </FormField>

        <FormField
          label="Sort order"
          htmlFor="sortOrder"
          description="Lower values appear first."
          error={errors.sortOrder?.[0]}
        >
          <Input
            id="sortOrder"
            type="number"
            min={0}
            value={sortOrder}
            onChange={(event) => setSortOrder(event.target.value)}
          />
        </FormField>

        <div className="flex flex-col justify-end gap-1.5">
          <label className="flex h-10 items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={isActive}
              onChange={(event) => setIsActive(event.target.checked)}
              className="size-4 accent-primary"
            />
            Active category
          </label>
        </div>

        <FormField
          label="Description"
          htmlFor="description"
          error={errors.description?.[0]}
          className="sm:col-span-2 lg:col-span-4"
        >
          <Textarea
            id="description"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            placeholder="What this category records and who uses it"
            maxLength={500}
          />
        </FormField>
      </fieldset>

      <fieldset className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <legend className="text-[11px] font-semibold tracking-widest text-muted-foreground uppercase">
              Custom fields
            </legend>
            <p className="mt-1 text-xs text-muted-foreground">
              Fields define the structured data captured for this category.
              Removing a field with existing values deactivates it instead of
              deleting history.
            </p>
          </div>
          <Button type="button" variant="outline" size="sm" onClick={addField}>
            <Plus className="size-4" /> Add field
          </Button>
        </div>

        {fields.length === 0 ? (
          <p className="border border-dashed px-4 py-8 text-center text-sm text-muted-foreground">
            No fields yet. Add the first field to start collecting data.
          </p>
        ) : null}

        {fields.map((field, index) => (
          <div key={field.id ?? `new-${index}`} className="border bg-muted/10">
            <div className="flex items-center justify-between gap-3 border-b px-4 py-2.5">
              <div className="flex items-center gap-2 text-xs font-semibold tracking-widest text-muted-foreground uppercase">
                <GripVertical className="size-3.5" />
                Field {index + 1}
              </div>
              <div className="flex items-center gap-3">
                <label className="flex items-center gap-1.5 text-xs">
                  <input
                    type="checkbox"
                    checked={field.required}
                    onChange={(event) =>
                      updateField(index, { required: event.target.checked })
                    }
                    className="size-3.5 accent-primary"
                  />
                  Required
                </label>
                <label className="flex items-center gap-1.5 text-xs">
                  <input
                    type="checkbox"
                    checked={field.isActive}
                    onChange={(event) =>
                      updateField(index, { isActive: event.target.checked })
                    }
                    className="size-3.5 accent-primary"
                  />
                  Active
                </label>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`Remove field ${index + 1}`}
                  onClick={() => removeField(index)}
                >
                  <Trash2 className="size-4" />
                </Button>
              </div>
            </div>

            <div className="grid gap-4 p-4 sm:grid-cols-2 lg:grid-cols-3">
              <FormField
                label="Key"
                htmlFor={`field-${index}-key`}
                required
                description="lowerCamelCase, used in exports."
                error={fieldError(index, "key")}
              >
                <Input
                  id={`field-${index}-key`}
                  value={field.key}
                  onChange={(event) =>
                    updateField(index, { key: event.target.value })
                  }
                  placeholder="amount"
                />
              </FormField>

              <FormField
                label="Label"
                htmlFor={`field-${index}-label`}
                required
                error={fieldError(index, "label")}
              >
                <Input
                  id={`field-${index}-label`}
                  value={field.label}
                  onChange={(event) =>
                    updateField(index, { label: event.target.value })
                  }
                  placeholder="Amount"
                />
              </FormField>

              <FormField
                label="Type"
                htmlFor={`field-${index}-type`}
                required
                error={fieldError(index, "type")}
              >
                <select
                  id={`field-${index}-type`}
                  value={field.type}
                  onChange={(event) =>
                    updateField(index, {
                      type: event.target.value as FieldType,
                    })
                  }
                  className="h-10 w-full border-b border-input bg-transparent text-sm outline-none focus-visible:border-b-ring"
                >
                  {FIELD_TYPES.map((type) => (
                    <option key={type} value={type}>
                      {humanizeEnum(type)}
                    </option>
                  ))}
                </select>
              </FormField>

              {field.type === "SELECT" ? (
                <FormField
                  label="Options"
                  htmlFor={`field-${index}-options`}
                  required
                  description="Separate options with commas."
                  error={fieldError(index, "options")}
                  className="sm:col-span-2"
                >
                  <Input
                    id={`field-${index}-options`}
                    value={field.options}
                    onChange={(event) =>
                      updateField(index, { options: event.target.value })
                    }
                    placeholder="North, South, East, West"
                  />
                </FormField>
              ) : null}

              <FormField
                label="Placeholder"
                htmlFor={`field-${index}-placeholder`}
                error={fieldError(index, "placeholder")}
              >
                <Input
                  id={`field-${index}-placeholder`}
                  value={field.placeholder}
                  onChange={(event) =>
                    updateField(index, { placeholder: event.target.value })
                  }
                />
              </FormField>

              <FormField
                label="Help text"
                htmlFor={`field-${index}-help`}
                error={fieldError(index, "helpText")}
                className="sm:col-span-2"
              >
                <Input
                  id={`field-${index}-help`}
                  value={field.helpText}
                  onChange={(event) =>
                    updateField(index, { helpText: event.target.value })
                  }
                />
              </FormField>

              {field.type === "NUMBER" || field.type === "DECIMAL" ? (
                <>
                  <FormField
                    label="Minimum"
                    htmlFor={`field-${index}-min`}
                    error={fieldError(index, "minValue")}
                  >
                    <Input
                      id={`field-${index}-min`}
                      type="number"
                      step="any"
                      value={field.minValue}
                      onChange={(event) =>
                        updateField(index, { minValue: event.target.value })
                      }
                    />
                  </FormField>
                  <FormField
                    label="Maximum"
                    htmlFor={`field-${index}-max`}
                    error={fieldError(index, "maxValue")}
                  >
                    <Input
                      id={`field-${index}-max`}
                      type="number"
                      step="any"
                      value={field.maxValue}
                      onChange={(event) =>
                        updateField(index, { maxValue: event.target.value })
                      }
                    />
                  </FormField>
                </>
              ) : null}

              {field.type === "TEXT" || field.type === "TEXTAREA" ? (
                <FormField
                  label="Max length"
                  htmlFor={`field-${index}-maxlength`}
                  error={fieldError(index, "maxLength")}
                >
                  <Input
                    id={`field-${index}-maxlength`}
                    type="number"
                    min={1}
                    max={10000}
                    value={field.maxLength}
                    onChange={(event) =>
                      updateField(index, { maxLength: event.target.value })
                    }
                  />
                </FormField>
              ) : null}
            </div>
          </div>
        ))}
      </fieldset>

      <div className="flex flex-wrap items-center gap-2 border-t pt-5">
        <Button type="submit" disabled={pending}>
          {pending
            ? "Saving..."
            : mode === "create"
              ? "Create category"
              : "Save changes"}
        </Button>
        <Button variant="outline" render={<Link href="/settings?tab=categories" />}>
          Cancel
        </Button>
      </div>
    </form>
  )
}
