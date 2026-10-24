import type { Metadata } from "next"
import { redirect } from "next/navigation"

import { PageHeader } from "@/components/shared/page-header"
import { UserForm } from "@/components/users/user-form"
import { getBranchOptions, getRegionOptions } from "@/lib/services/branches"
import { requirePageScope } from "@/lib/session"

export const metadata: Metadata = { title: "New user" }

export default async function NewUserPage() {
  const scope = await requirePageScope()
  if (!scope.canManageUsers) redirect("/dashboard")

  const [branches, regions] = await Promise.all([
    getBranchOptions(scope),
    getRegionOptions(scope),
  ])

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="New user"
        description="Create an account, choose its role and assign the regions or branches it can access."
        breadcrumbs={[
          { label: "Users", href: "/users" },
          { label: "New user" },
        ]}
      />
      <div className="border bg-card p-5 lg:p-8">
        <UserForm mode="create" branches={branches} regions={regions} />
      </div>
    </div>
  )
}
