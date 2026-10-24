import type { Metadata } from "next"
import { redirect } from "next/navigation"

import { RecordForm } from "@/components/records/record-form"
import { PageHeader } from "@/components/shared/page-header"
import { getRecordFormData } from "@/lib/services/records"
import { requirePageScope } from "@/lib/session"

export const metadata: Metadata = { title: "New record" }

export default async function NewRecordPage() {
  const scope = await requirePageScope()
  if (!scope.canCreateRecords) redirect("/records")

  const formData = await getRecordFormData(scope)

  if (formData.branches.length === 0 || formData.categories.length === 0) {
    return (
      <div className="flex flex-col gap-6">
        <PageHeader
          title="New record"
          description="Before creating a record, an active branch and category must exist in your scope."
          breadcrumbs={[
            { label: "Records", href: "/records" },
            { label: "New record" },
          ]}
        />
        <div className="border bg-card p-6 text-sm text-muted-foreground">
          No active branches or record categories are available to your account.
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="New record"
        description="Enter the operational data, then save it as a draft or submit it for review."
        breadcrumbs={[
          { label: "Records", href: "/records" },
          { label: "New record" },
        ]}
      />
      <div className="border bg-card p-5 lg:p-8">
        <RecordForm
          mode="create"
          branches={formData.branches}
          categories={formData.categories}
        />
      </div>
    </div>
  )
}
