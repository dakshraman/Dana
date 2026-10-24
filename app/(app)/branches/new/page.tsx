import type { Metadata } from "next"
import { redirect } from "next/navigation"

import { BranchForm } from "@/components/branches/branch-form"
import { PageHeader } from "@/components/shared/page-header"
import { getRegionOptions } from "@/lib/services/branches"
import { getUserOptions } from "@/lib/services/users"
import { requirePageScope } from "@/lib/session"

export const metadata: Metadata = { title: "New branch" }

export default async function NewBranchPage() {
  const scope = await requirePageScope()
  if (!scope.canManageBranches) redirect("/branches")

  const [regions, managers] = await Promise.all([
    getRegionOptions(scope),
    getUserOptions(scope),
  ])

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="New branch"
        description="Create an operating location and assign it to a region."
        breadcrumbs={[
          { label: "Branches", href: "/branches" },
          { label: "New branch" },
        ]}
      />
      <div className="border bg-card p-5 lg:p-8">
        <BranchForm
          mode="create"
          regions={regions}
          managers={managers
            .filter((user) => user.role !== "BRANCH_EMPLOYEE")
            .map((user) => ({
              id: user.id,
              code: user.role,
              name: user.name,
              email: user.email,
            }))}
        />
      </div>
    </div>
  )
}
