"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"

import { FormField } from "@/components/shared/form-field"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { errorMessage, fieldErrors, patchJson, postJson } from "@/lib/client-api"
import { ROLE_LABELS, ROLES, type AppRole } from "@/lib/permissions"

type BranchOption = { id: string; code: string; name: string }
type RegionOption = { id: string; code: string; name: string }

export type UserFormValues = {
  id?: string
  name: string
  email: string
  password: string
  role: AppRole
  isActive: boolean
  branchIds: string[]
  regionIds: string[]
}

const EMPTY: UserFormValues = {
  name: "",
  email: "",
  password: "",
  role: "BRANCH_EMPLOYEE",
  isActive: true,
  branchIds: [],
  regionIds: [],
}

const SELECT_CLASS =
  "h-10 w-full border-b border-input bg-transparent px-0 text-sm outline-none focus-visible:border-b-ring"

export function UserForm({
  mode,
  initial,
  branches,
  regions,
}: {
  mode: "create" | "edit"
  initial?: Partial<UserFormValues>
  branches: BranchOption[]
  regions: RegionOption[]
}) {
  const router = useRouter()
  const [values, setValues] = useState<UserFormValues>({
    ...EMPTY,
    ...initial,
    role: initial?.role ?? EMPTY.role,
    branchIds: initial?.branchIds ?? [],
    regionIds: initial?.regionIds ?? [],
  })
  const [errors, setErrors] = useState<Record<string, string[]>>({})
  const [pending, setPending] = useState(false)

  const needsBranches =
    values.role === "BRANCH_MANAGER" || values.role === "BRANCH_EMPLOYEE"
  const needsRegions = values.role === "REGIONAL_MANAGER"

  function update<K extends keyof UserFormValues>(
    key: K,
    value: UserFormValues[K]
  ) {
    setValues((current) => ({ ...current, [key]: value }))
  }

  function toggleAssignment(
    key: "branchIds" | "regionIds",
    id: string,
    checked: boolean
  ) {
    setValues((current) => {
      const selected = current[key]

      if (checked) {
        return selected.includes(id)
          ? current
          : { ...current, [key]: [...selected, id] }
      }

      return { ...current, [key]: selected.filter((item) => item !== id) }
    })
  }

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setPending(true)
    setErrors({})

    const payload =
      mode === "create"
        ? {
            name: values.name,
            email: values.email,
            password: values.password,
            role: values.role,
            isActive: values.isActive,
            branchIds: values.branchIds,
            regionIds: values.regionIds,
          }
        : {
            name: values.name,
            role: values.role,
            isActive: values.isActive,
            branchIds: values.branchIds,
            regionIds: values.regionIds,
            ...(values.password ? { password: values.password } : {}),
          }

    try {
      if (mode === "create") {
        const user = await postJson<{ id: string }>("/api/users", payload)
        toast.success("User created.")
        router.push(`/users/${user.id}`)
      } else {
        await patchJson(`/api/users/${values.id}`, payload)
        toast.success("User updated.")
        router.push(`/users/${values.id}`)
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
          Account
        </legend>

        <FormField label="Full name" htmlFor="name" required error={errors.name?.[0]}>
          <Input
            id="name"
            value={values.name}
            onChange={(event) => update("name", event.target.value)}
            placeholder="Alex Morgan"
            autoComplete="name"
          />
        </FormField>

        <FormField
          label="Email"
          htmlFor="email"
          required={mode === "create"}
          description={
            mode === "edit"
              ? "Email addresses cannot be changed after an account is created."
              : undefined
          }
          error={mode === "create" ? errors.email?.[0] : undefined}
        >
          <Input
            id="email"
            type="email"
            value={values.email}
            onChange={(event) => update("email", event.target.value)}
            placeholder="alex@company.com"
            autoComplete="email"
            readOnly={mode === "edit"}
            className={mode === "edit" ? "text-muted-foreground" : undefined}
          />
        </FormField>

        <FormField
          label="Password"
          htmlFor="password"
          required={mode === "create"}
          description={
            mode === "edit"
              ? "Leave blank to keep current password."
              : "At least 12 characters with an uppercase letter, a lowercase letter and a number."
          }
          error={errors.password?.[0]}
        >
          <Input
            id="password"
            type="password"
            value={values.password}
            onChange={(event) => update("password", event.target.value)}
            placeholder={mode === "edit" ? "Unchanged" : "Set a temporary password"}
            autoComplete="new-password"
          />
        </FormField>

        <FormField
          label="Role"
          htmlFor="role"
          required
          description="The role determines which assignments are required."
          error={errors.role?.[0]}
        >
          <select
            id="role"
            value={values.role}
            onChange={(event) => update("role", event.target.value as AppRole)}
            className={SELECT_CLASS}
          >
            {ROLES.map((role) => (
              <option key={role} value={role}>
                {ROLE_LABELS[role]}
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
            Active account
          </label>
        </FormField>
      </fieldset>

      {needsRegions ? (
        <fieldset className="flex flex-col gap-3 border-t pt-5">
          <legend className="text-[11px] font-semibold tracking-widest text-muted-foreground uppercase">
            Region access
            <span aria-hidden="true" className="text-destructive">
              {" "}
              *
            </span>
          </legend>
          <p className="text-xs leading-relaxed text-muted-foreground">
            Regional managers need at least one region. Selected regions are kept
            if you change the role before saving.
          </p>

          {regions.length === 0 ? (
            <p className="border border-dashed px-4 py-6 text-sm text-muted-foreground">
              No regions are available in your access scope.
            </p>
          ) : (
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {regions.map((region) => (
                <label
                  key={region.id}
                  className="flex cursor-pointer items-start gap-2.5 border bg-card p-3 text-sm transition-colors has-[:checked]:border-primary"
                >
                  <input
                    id={`region-${region.id}`}
                    type="checkbox"
                    checked={values.regionIds.includes(region.id)}
                    onChange={(event) =>
                      toggleAssignment("regionIds", region.id, event.target.checked)
                    }
                    className="mt-0.5 size-4 shrink-0 accent-primary"
                  />
                  <span className="flex min-w-0 flex-col gap-0.5">
                    <span className="font-medium">{region.name}</span>
                    <span className="font-mono text-[10px] tracking-wider text-muted-foreground uppercase">
                      {region.code}
                    </span>
                  </span>
                </label>
              ))}
            </div>
          )}

          {errors.regionIds?.[0] ? (
            <p role="alert" className="text-xs leading-relaxed text-destructive">
              {errors.regionIds[0]}
            </p>
          ) : null}
        </fieldset>
      ) : null}

      {needsBranches ? (
        <fieldset className="flex flex-col gap-3 border-t pt-5">
          <legend className="text-[11px] font-semibold tracking-widest text-muted-foreground uppercase">
            Branch access
            <span aria-hidden="true" className="text-destructive">
              {" "}
              *
            </span>
          </legend>
          <p className="text-xs leading-relaxed text-muted-foreground">
            Branch managers and employees need at least one branch. Selected
            branches are kept if you change the role before saving.
          </p>

          {branches.length === 0 ? (
            <p className="border border-dashed px-4 py-6 text-sm text-muted-foreground">
              No active branches are available in your access scope.
            </p>
          ) : (
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {branches.map((branch) => (
                <label
                  key={branch.id}
                  className="flex cursor-pointer items-start gap-2.5 border bg-card p-3 text-sm transition-colors has-[:checked]:border-primary"
                >
                  <input
                    id={`branch-${branch.id}`}
                    type="checkbox"
                    checked={values.branchIds.includes(branch.id)}
                    onChange={(event) =>
                      toggleAssignment("branchIds", branch.id, event.target.checked)
                    }
                    className="mt-0.5 size-4 shrink-0 accent-primary"
                  />
                  <span className="flex min-w-0 flex-col gap-0.5">
                    <span className="font-medium">{branch.name}</span>
                    <span className="font-mono text-[10px] tracking-wider text-muted-foreground uppercase">
                      {branch.code}
                    </span>
                  </span>
                </label>
              ))}
            </div>
          )}

          {errors.branchIds?.[0] ? (
            <p role="alert" className="text-xs leading-relaxed text-destructive">
              {errors.branchIds[0]}
            </p>
          ) : null}
        </fieldset>
      ) : null}

      {values.role === "SUPER_ADMIN" ? (
        <p className="border bg-muted/30 px-4 py-3 text-sm leading-relaxed text-muted-foreground">
          Super admins have organisation-wide access and do not require branch or
          region assignments.
        </p>
      ) : null}

      <div className="flex flex-wrap items-center gap-2 border-t pt-5">
        <Button type="submit" disabled={pending}>
          {pending ? "Saving..." : mode === "create" ? "Create user" : "Save changes"}
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
