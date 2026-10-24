import type { Metadata } from "next"
import { notFound, redirect } from "next/navigation"

import { RegionForm } from "@/components/settings/region-form"
import { PageHeader } from "@/components/shared/page-header"
import { ApiError } from "@/lib/http"
import { getRegion } from "@/lib/services/branches"
import { requirePageScope } from "@/lib/session"

export const metadata: Metadata = { title: "Edit region" }

export default async function EditRegionPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const scope = await requirePageScope()
  if (!scope.canManageSettings) redirect("/dashboard")

  const { id } = await params

  let region: Awaited<ReturnType<typeof getRegion>>
  try {
    region = await getRegion(scope, id)
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) notFound()
    throw error
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={`Edit ${region.name}`}
        description="Update the region label and description."
        breadcrumbs={[
          { label: "Settings", href: "/settings?tab=regions" },
          { label: region.name },
          { label: "Edit" },
        ]}
      />
      <div className="max-w-2xl border bg-card p-5 lg:p-8">
        <RegionForm
          mode="edit"
          initial={{
            id: region.id,
            code: region.code,
            name: region.name,
            description: region.description,
          }}
        />
      </div>
    </div>
  )
}
