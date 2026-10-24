import type { Metadata } from "next"
import { redirect } from "next/navigation"

import { RegionForm } from "@/components/settings/region-form"
import { PageHeader } from "@/components/shared/page-header"
import { requirePageScope } from "@/lib/session"

export const metadata: Metadata = { title: "New region" }

export default async function NewRegionPage() {
  const scope = await requirePageScope()
  if (!scope.canManageSettings) redirect("/dashboard")

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="New region"
        description="Regions group branches and drive regional manager access."
        breadcrumbs={[
          { label: "Settings", href: "/settings?tab=regions" },
          { label: "New region" },
        ]}
      />
      <div className="max-w-2xl border bg-card p-5 lg:p-8">
        <RegionForm mode="create" />
      </div>
    </div>
  )
}
