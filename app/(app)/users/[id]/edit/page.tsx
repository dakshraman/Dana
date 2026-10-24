import type { Metadata } from "next"
import { notFound, redirect } from "next/navigation"

import { PageHeader } from "@/components/shared/page-header"
import { UserForm } from "@/components/users/user-form"
import { ApiError } from "@/lib/http"
import { getBranchOptions, getRegionOptions } from "@/lib/services/branches"
import { getUser } from "@/lib/services/users"
import { requirePageScope } from "@/lib/session"

export const metadata: Metadata = { title: "Edit user" }

export default async function EditUserPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const scope = await requirePageScope()
  if (!scope.canManageUsers) redirect("/dashboard")

  const { id } = await params

  let user: Awaited<ReturnType<typeof getUser>>
  try {
    user = await getUser(scope, id)
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) notFound()
    throw error
  }

  const [branches, regions] = await Promise.all([
    getBranchOptions(scope),
    getRegionOptions(scope),
  ])

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={`Edit ${user.name}`}
        description="Update the account profile, role, activation state and access assignments."
        breadcrumbs={[
          { label: "Users", href: "/users" },
          { label: user.name, href: `/users/${user.id}` },
          { label: "Edit" },
        ]}
      />
      <div className="border bg-card p-5 lg:p-8">
        <UserForm
          mode="edit"
          initial={{
            id: user.id,
            name: user.name,
            email: user.email,
            role: user.role,
            isActive: user.isActive,
            branchIds: user.branchAssignments.map(
              (assignment) => assignment.branch.id
            ),
            regionIds: user.regionAssignments.map(
              (assignment) => assignment.region.id
            ),
          }}
          branches={branches}
          regions={regions}
        />
      </div>
    </div>
  )
}
