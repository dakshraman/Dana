import type { Metadata } from "next"
import { notFound, redirect } from "next/navigation"

import { BranchForm } from "@/components/branches/branch-form"
import { PageHeader } from "@/components/shared/page-header"
import { ApiError } from "@/lib/http"
import { getBranch, getRegionOptions } from "@/lib/services/branches"
import { getUserOptions } from "@/lib/services/users"
import { requirePageScope } from "@/lib/session"

export const metadata: Metadata = { title: "Edit branch" }

export default async function EditBranchPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const scope = await requirePageScope()
  if (!scope.canManageBranches) redirect("/branches")

  const { id } = await params

  let result: Awaited<ReturnType<typeof getBranch>>
  try {
    result = await getBranch(scope, id)
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) notFound()
    throw error
  }

  const [regions, managers] = await Promise.all([
    getRegionOptions(scope),
    getUserOptions(scope),
  ])

  const { branch } = result

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={`Edit ${branch.name}`}
        description="Update branch details, manager assignment and activation state."
        breadcrumbs={[
          { label: "Branches", href: "/branches" },
          { label: branch.name, href: `/branches/${branch.id}` },
          { label: "Edit" },
        ]}
      />
      <div className="border bg-card p-5 lg:p-8">
        <BranchForm
          mode="edit"
          initial={{
            id: branch.id,
            code: branch.code,
            name: branch.name,
            country: branch.country,
            state: branch.state,
            city: branch.city,
            address: branch.address,
            contactPerson: branch.contactPerson,
            email: branch.email,
            phone: branch.phone,
            regionId: branch.regionId,
            managerId: branch.managerId,
            isActive: branch.isActive,
          }}
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
