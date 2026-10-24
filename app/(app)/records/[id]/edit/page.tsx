import type { Metadata } from "next"
import { notFound, redirect } from "next/navigation"

import { RecordForm } from "@/components/records/record-form"
import { PageHeader } from "@/components/shared/page-header"
import { ApiError } from "@/lib/http"
import { canEditRecord } from "@/lib/permissions"
import { serializeRecordValues } from "@/lib/records/fields"
import {
  getRecord,
  getRecordCategoryWithFields,
  getRecordFormData,
} from "@/lib/services/records"
import { requirePageScope } from "@/lib/session"

export const metadata: Metadata = { title: "Edit record" }

export default async function EditRecordPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const scope = await requirePageScope()
  const { id } = await params

  let record: Awaited<ReturnType<typeof getRecord>>
  try {
    record = await getRecord(scope, id)
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) notFound()
    throw error
  }

  if (!canEditRecord(scope, record)) redirect(`/records/${record.id}`)

  const [formData, recordCategory] = await Promise.all([
    getRecordFormData(scope),
    getRecordCategoryWithFields(record.categoryId),
  ])

  // The record's own category and all of its fields are included even when
  // they have been deactivated, so historical values remain visible.
  const categories = recordCategory
    ? formData.categories.some((category) => category.id === recordCategory.id)
      ? formData.categories.map((category) =>
          category.id === recordCategory.id
            ? { ...category, fields: recordCategory.fields }
            : category
        )
      : [recordCategory, ...formData.categories]
    : formData.categories

  const fields = recordCategory?.fields ?? []
  const values = serializeRecordValues(record.values, fields)

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={`Edit ${record.recordNumber}`}
        description={
          record.category.isActive
            ? "Update the recorded values, then save as a draft or resubmit for review."
            : "This record's category is inactive. Existing values can still be corrected, but the category cannot be selected for new records."
        }
        breadcrumbs={[
          { label: "Records", href: "/records" },
          { label: record.recordNumber, href: `/records/${record.id}` },
          { label: "Edit" },
        ]}
      />
      <div className="border bg-card p-5 lg:p-8">
        <RecordForm
          mode="edit"
          branches={formData.branches}
          categories={categories}
          initial={{
            id: record.id,
            branchId: record.branchId,
            categoryId: record.categoryId,
            recordDate: record.recordDate,
            title: record.title,
            referenceNumber: record.referenceNumber,
            remarks: record.remarks,
            values,
          }}
        />
      </div>
    </div>
  )
}
