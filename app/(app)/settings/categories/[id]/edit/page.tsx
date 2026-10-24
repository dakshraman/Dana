import type { Metadata } from "next"
import { notFound, redirect } from "next/navigation"

import { CategoryForm } from "@/components/settings/category-form"
import { PageHeader } from "@/components/shared/page-header"
import { ApiError } from "@/lib/http"
import { getCategory } from "@/lib/services/settings"
import { requirePageScope } from "@/lib/session"

export const metadata: Metadata = { title: "Edit category" }

export default async function EditCategoryPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const scope = await requirePageScope()
  if (!scope.canManageSettings) redirect("/dashboard")

  const { id } = await params

  let category: Awaited<ReturnType<typeof getCategory>>
  try {
    category = await getCategory(scope, id)
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) notFound()
    throw error
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={`Edit ${category.name}`}
        description="Update the category metadata and its field definitions."
        breadcrumbs={[
          { label: "Settings", href: "/settings?tab=categories" },
          { label: category.name },
          { label: "Edit" },
        ]}
      />
      <div className="border bg-card p-5 lg:p-8">
        <CategoryForm
          mode="edit"
          initial={{
            id: category.id,
            code: category.code,
            name: category.name,
            description: category.description,
            isActive: category.isActive,
            sortOrder: category.sortOrder,
            fields: category.fields.filter((field) => field.isActive),
          }}
        />
      </div>
    </div>
  )
}
