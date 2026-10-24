import type { Metadata } from "next"
import { redirect } from "next/navigation"

import { CategoryForm } from "@/components/settings/category-form"
import { PageHeader } from "@/components/shared/page-header"
import { requirePageScope } from "@/lib/session"

export const metadata: Metadata = { title: "New category" }

export default async function NewCategoryPage() {
  const scope = await requirePageScope()
  if (!scope.canManageSettings) redirect("/dashboard")

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="New record category"
        description="Define a reusable record type and the fields it captures."
        breadcrumbs={[
          { label: "Settings", href: "/settings?tab=categories" },
          { label: "New category" },
        ]}
      />
      <div className="border bg-card p-5 lg:p-8">
        <CategoryForm mode="create" />
      </div>
    </div>
  )
}
