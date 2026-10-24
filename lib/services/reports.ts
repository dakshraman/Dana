import "server-only"

import { branchScopeWhere, recordScopeWhere } from "@/lib/access"
import { prisma } from "@/lib/db"
import type { Prisma } from "@/lib/generated/prisma/client"
import type { FieldType } from "@/lib/generated/prisma/enums"
import type { ExportColumn, ExportRow } from "@/lib/exports/csv"
import { badRequest } from "@/lib/http"
import {
  RECORD_STATUSES,
  STATUS_LABELS,
  type AccessScope,
  type RecordStatusValue,
} from "@/lib/permissions"
import { parseDateOnly } from "@/lib/records/fields"
import type { ReportQueryInput } from "@/lib/validations/report"

export type ReportFilters = ReportQueryInput

export type ReportScopeFilters = {
  branches: Array<{ id: string; code: string; name: string }>
  categories: Array<{ id: string; code: string; name: string }>
  regions: Array<{ id: string; code: string; name: string }>
}

/** Paginated report item used by the report table. */
export type ReportItem = Awaited<
  ReturnType<typeof getReportData>
>["items"][number]

export type ReportAggregates = {
  total: number
  byStatus: {
    status: RecordStatusValue
    label: string
    count: number
  }[]
  byCategory: {
    categoryId: string
    code: string
    name: string
    count: number
  }[]
  byBranch: {
    branchId: string
    code: string
    name: string
    count: number
  }[]
  dateRange: string
}

export type ReportResult = {
  items: ReportItem[]
  page: number
  pageSize: number
  totalPages: number
  aggregates: ReportAggregates
}

export type ReportExportResult = {
  columns: ExportColumn[]
  rows: ExportRow[]
  title: string
  filtersSummary: string
}

const EXPORT_ROW_LIMIT = 10_000

const reportRowSelect = {
  id: true,
  recordNumber: true,
  title: true,
  status: true,
  recordDate: true,
  referenceNumber: true,
  createdAt: true,
  submittedAt: true,
  approvedAt: true,
  branch: {
    select: {
      id: true,
      code: true,
      name: true,
      city: true,
      country: true,
      region: { select: { name: true } },
    },
  },
  category: { select: { id: true, code: true, name: true } },
  createdBy: { select: { name: true } },
  approvedBy: { select: { name: true } },
} as const satisfies Prisma.DataRecordSelect

const reportExportSelect = {
  ...reportRowSelect,
  remarks: true,
  submittedBy: { select: { name: true } },
  values: {
    select: {
      valueText: true,
      valueNumber: true,
      valueDate: true,
      valueBoolean: true,
      valueJson: true,
      fieldDefinition: {
        select: {
          id: true,
          type: true,
        },
      },
    },
  },
} as const satisfies Prisma.DataRecordSelect

export type ReportExportRow = Prisma.DataRecordGetPayload<{
  select: typeof reportRowSelect
}>

type ExportRecord = Prisma.DataRecordGetPayload<{
  select: typeof reportExportSelect
}>

type ExportField = {
  id: string
  label: string
  type: FieldType
  sortOrder: number
  categoryId: string
  categoryName: string
}

const CORE_EXPORT_COLUMNS: ExportColumn[] = [
  { key: "recordNumber", label: "Record #" },
  { key: "recordDate", label: "Record Date" },
  { key: "title", label: "Title" },
  { key: "referenceNumber", label: "Reference #" },
  { key: "status", label: "Status" },
  { key: "branch", label: "Branch" },
  { key: "branchCode", label: "Branch Code" },
  { key: "region", label: "Region" },
  { key: "country", label: "Country" },
  { key: "city", label: "City" },
  { key: "category", label: "Category" },
  { key: "categoryCode", label: "Category Code" },
  { key: "createdBy", label: "Created By" },
  { key: "createdAt", label: "Created At" },
  { key: "submittedBy", label: "Submitted By" },
  { key: "submittedAt", label: "Submitted At" },
  { key: "approvedBy", label: "Approved By" },
  { key: "approvedAt", label: "Approved At" },
  { key: "remarks", label: "Remarks" },
]

export async function getReportFilterOptions(
  scope: AccessScope
): Promise<ReportScopeFilters> {
  const [branches, categories, regions] = await Promise.all([
    prisma.branch.findMany({
      where: branchScopeWhere(scope),
      select: { id: true, code: true, name: true },
      orderBy: { name: "asc" },
    }),
    prisma.recordCategory.findMany({
      where: { isActive: true },
      select: { id: true, code: true, name: true },
      orderBy: { name: "asc" },
    }),
    prisma.region.findMany({
      select: { id: true, code: true, name: true },
      orderBy: { name: "asc" },
    }),
  ])

  return { branches, categories, regions }
}

/**
 * Shared authorization/filter builder for both the report page and exports.
 * Scope is always the first AND term, so a branch/region filter can only
 * narrow the result set and can never widen it.
 */
export function buildReportWhere(
  scope: AccessScope,
  params: ReportQueryInput
): Prisma.DataRecordWhereInput {
  const filters: Prisma.DataRecordWhereInput[] = [recordScopeWhere(scope)]

  filters.push(
    params.status === "all"
      ? { status: { not: "ARCHIVED" } }
      : { status: params.status }
  )

  if (params.branchId) filters.push({ branchId: params.branchId })
  if (params.categoryId) filters.push({ categoryId: params.categoryId })

  if (params.q) {
    filters.push({
      OR: [
        { recordNumber: { contains: params.q, mode: "insensitive" } },
        { title: { contains: params.q, mode: "insensitive" } },
        { referenceNumber: { contains: params.q, mode: "insensitive" } },
      ],
    })
  }

  const branchFilter: Prisma.BranchWhereInput = {}
  if (params.regionId) branchFilter.regionId = params.regionId
  if (params.country) {
    branchFilter.country = { equals: params.country, mode: "insensitive" }
  }
  if (params.city) {
    branchFilter.city = { equals: params.city, mode: "insensitive" }
  }
  if (Object.keys(branchFilter).length > 0) {
    filters.push({ branch: { is: branchFilter } })
  }

  if (params.from || params.to) {
    if (params.from && params.to && params.from > params.to) {
      throw badRequest("The start date must be on or before the end date.")
    }

    const from = params.from ? parseDateOnly(params.from) : null
    const to = params.to ? parseDateOnly(params.to) : null
    if (params.from && !from) throw badRequest("Use a valid start date.")
    if (params.to && !to) throw badRequest("Use a valid end date.")
    if (to) to.setUTCHours(23, 59, 59, 999)

    filters.push({
      recordDate: {
        ...(from ? { gte: from } : {}),
        ...(to ? { lte: to } : {}),
      },
    })
  }

  return { AND: filters }
}

/**
 * Existing report-page data shape. Kept alongside `getReport` so the page and
 * the programmatic aggregates share one query implementation.
 */
export async function getReportData(
  scope: AccessScope,
  params: ReportQueryInput
) {
  const where = buildReportWhere(scope, params)
  const skip = (params.page - 1) * params.pageSize

  const [
    items,
    total,
    statusGroups,
    categoryGroups,
    branchGroups,
    approvedTotal,
    pendingTotal,
    withAttachments,
  ] = await Promise.all([
    prisma.dataRecord.findMany({
      where,
      select: reportRowSelect,
      orderBy: reportOrderBy(params),
      skip,
      take: params.pageSize,
    }),
    prisma.dataRecord.count({ where }),
    prisma.dataRecord.groupBy({
      by: ["status"],
      where,
      _count: { _all: true },
    }),
    prisma.dataRecord.groupBy({
      by: ["categoryId"],
      where,
      _count: { _all: true },
    }),
    prisma.dataRecord.groupBy({
      by: ["branchId"],
      where,
      _count: { _all: true },
    }),
    prisma.dataRecord.count({ where: { ...where, status: "APPROVED" } }),
    prisma.dataRecord.count({ where: { ...where, status: "SUBMITTED" } }),
    prisma.dataRecord.count({
      where: { ...where, attachments: { some: {} } },
    }),
  ])

  const [categories, branches] = await Promise.all([
    prisma.recordCategory.findMany({
      where: { id: { in: categoryGroups.map((group) => group.categoryId) } },
      select: { id: true, name: true, code: true },
    }),
    prisma.branch.findMany({
      where: { id: { in: branchGroups.map((group) => group.branchId) } },
      select: { id: true, name: true, code: true },
    }),
  ])

  const categoryNames = new Map(categories.map((item) => [item.id, item]))
  const branchNames = new Map(branches.map((item) => [item.id, item]))
  const statusCounts = Object.fromEntries(
    statusGroups.map((group) => [group.status, group._count._all])
  ) as Record<string, number>

  return {
    items,
    total,
    page: params.page,
    pageSize: params.pageSize,
    totalPages: Math.max(1, Math.ceil(total / params.pageSize)),
    summary: {
      approved: approvedTotal,
      pending: pendingTotal,
      withAttachments,
      approvalRate:
        total === 0 ? 0 : Math.round((approvedTotal / total) * 1000) / 10,
      statusCounts,
      byCategory: categoryGroups
        .map((group) => ({
          id: group.categoryId,
          name: categoryNames.get(group.categoryId)?.name ?? "Uncategorised",
          code: categoryNames.get(group.categoryId)?.code ?? "—",
          value: group._count._all,
        }))
        .sort((a, b) => b.value - a.value),
      byBranch: branchGroups
        .map((group) => ({
          id: group.branchId,
          name: branchNames.get(group.branchId)?.name ?? "Unknown branch",
          code: branchNames.get(group.branchId)?.code ?? "—",
          value: group._count._all,
        }))
        .sort((a, b) => b.value - a.value),
    },
  }
}

/**
 * Programmatic report with pagination and explicit aggregates. Uses the same
 * filter builder and item select as `getReportData`.
 */
export async function getReport(
  scope: AccessScope,
  params: ReportQueryInput
): Promise<ReportResult> {
  const data = await getReportData(scope, params)

  const byStatus = RECORD_STATUSES.filter(
    (status) => data.summary.statusCounts[status] !== undefined
  ).map((status) => ({
    status,
    label: STATUS_LABELS[status],
    count: data.summary.statusCounts[status] ?? 0,
  }))

  return {
    items: data.items,
    page: data.page,
    pageSize: data.pageSize,
    totalPages: data.totalPages,
    aggregates: {
      total: data.total,
      byStatus,
      byCategory: data.summary.byCategory.map((item) => ({
        categoryId: item.id,
        code: item.code,
        name: item.name,
        count: item.value,
      })),
      byBranch: data.summary.byBranch.map((item) => ({
        branchId: item.id,
        code: item.code,
        name: item.name,
        count: item.value,
      })),
      dateRange: dateRangeLabel(params),
    },
  }
}

/**
 * Rows for CSV/XLSX/PDF export. Uses the exact same where-clause helper as the
 * report page. Custom field columns are the union of field definitions present
 * in the exported rows; fields from other categories are blank.
 */
export async function getReportExportRows(
  scope: AccessScope,
  params: ReportQueryInput
): Promise<ReportExportResult> {
  const where = buildReportWhere(scope, params)

  const [records, filtersSummary] = await Promise.all([
    prisma.dataRecord.findMany({
      where,
      orderBy: reportOrderBy(params),
      take: EXPORT_ROW_LIMIT,
      select: reportExportSelect,
    }),
    describeReportFilters(scope, params),
  ])

  const categoryNameById = new Map<string, string>()
  for (const record of records) {
    categoryNameById.set(record.category.id, record.category.name)
  }

  const categoryIds = [...categoryNameById.keys()]
  const definitions =
    categoryIds.length > 0
      ? await prisma.customFieldDefinition.findMany({
          where: { categoryId: { in: categoryIds } },
          select: {
            id: true,
            label: true,
            type: true,
            sortOrder: true,
            categoryId: true,
          },
        })
      : []

  const fields: ExportField[] = definitions
    .map((field) => ({
      id: field.id,
      label: field.label,
      type: field.type,
      sortOrder: field.sortOrder,
      categoryId: field.categoryId,
      categoryName: categoryNameById.get(field.categoryId) ?? "Unknown category",
    }))
    .sort(
      (a, b) =>
        a.categoryName.localeCompare(b.categoryName) ||
        a.sortOrder - b.sortOrder ||
        a.label.localeCompare(b.label)
    )

  // Field labels are only unique per category. Disambiguate duplicate labels
  // across categories instead of producing two identical column headings.
  const labelCounts = new Map<string, number>()
  for (const field of fields) {
    labelCounts.set(field.label, (labelCounts.get(field.label) ?? 0) + 1)
  }

  const customColumns: ExportColumn[] = fields.map((field) => ({
    key: `field_${field.id}`,
    label:
      (labelCounts.get(field.label) ?? 0) > 1
        ? `${field.categoryName}: ${field.label}`
        : field.label,
  }))

  const columns = [...CORE_EXPORT_COLUMNS, ...customColumns]
  const fieldIds = new Set(fields.map((field) => field.id))

  const rows: ExportRow[] = records.map((record) => {
    const row = coreExportRow(record)

    for (const field of fields) {
      row[`field_${field.id}`] = ""
    }

    for (const value of record.values) {
      if (!fieldIds.has(value.fieldDefinition.id)) continue
      row[`field_${value.fieldDefinition.id}`] = flattenRecordValue(value)
    }

    return row
  })

  return {
    columns,
    rows,
    title: "Records Report",
    filtersSummary,
  }
}

/**
 * Existing export-row helper kept for the report export builders. It shares
 * the same authorization filter as the page and programmatic report.
 */
export async function getReportRowsForExport(
  scope: AccessScope,
  params: ReportQueryInput,
  limit = EXPORT_ROW_LIMIT
): Promise<ReportExportRow[]> {
  return prisma.dataRecord.findMany({
    where: buildReportWhere(scope, params),
    select: reportRowSelect,
    orderBy: reportOrderBy(params),
    take: limit,
  })
}

function reportOrderBy(
  params: ReportQueryInput
): Prisma.DataRecordOrderByWithRelationInput[] {
  const direction: Prisma.SortOrder =
    params.direction === "asc" ? "asc" : "desc"

  switch (params.sort) {
    case "recordNumber":
      return [{ recordNumber: direction }, { id: "desc" }]
    case "title":
      return [{ title: direction }, { id: "desc" }]
    case "status":
      return [{ status: direction }, { recordDate: "desc" }, { id: "desc" }]
    case "createdAt":
      return [{ createdAt: direction }, { id: "desc" }]
    case "recordDate":
    default:
      return [{ recordDate: direction }, { createdAt: "desc" }, { id: "desc" }]
  }
}

async function describeReportFilters(
  scope: AccessScope,
  params: ReportQueryInput
): Promise<string> {
  const branchId = params.branchId
  const regionId = params.regionId
  const categoryId = params.categoryId

  const [branch, region, category] = await Promise.all([
    branchId
      ? prisma.branch.findFirst({
          where: { AND: [branchScopeWhere(scope), { id: branchId }] },
          select: { code: true, name: true },
        })
      : Promise.resolve(null),
    regionId
      ? prisma.region.findFirst({
          where: {
            id: regionId,
            ...(scope.isSuperAdmin
              ? {}
              : { branches: { some: { id: { in: scope.branchIds } } } }),
          },
          select: { name: true },
        })
      : Promise.resolve(null),
    categoryId
      ? prisma.recordCategory.findFirst({
          where: { id: categoryId },
          select: { name: true },
        })
      : Promise.resolve(null),
  ])

  const parts: string[] = []

  if (branch) parts.push(`Branch: ${branch.code} - ${branch.name}`)
  if (region) parts.push(`Region: ${region.name}`)
  if (params.country) parts.push(`Country: ${params.country}`)
  if (params.city) parts.push(`City: ${params.city}`)
  if (category) parts.push(`Category: ${category.name}`)

  if (params.status !== "all") {
    parts.push(`Status: ${STATUS_LABELS[params.status]}`)
  }

  const range = dateRangeLabel(params)
  if (range !== "All time") parts.push(`Dates: ${range}`)
  if (params.q) parts.push(`Search: "${params.q}"`)

  return parts.length > 0 ? parts.join(" | ") : "All records in scope"
}

function coreExportRow(record: ExportRecord): ExportRow {
  return {
    recordNumber: record.recordNumber,
    recordDate: formatDateOnly(record.recordDate),
    title: record.title,
    referenceNumber: record.referenceNumber,
    status: STATUS_LABELS[record.status],
    branch: record.branch.name,
    branchCode: record.branch.code,
    region: record.branch.region.name,
    country: record.branch.country,
    city: record.branch.city,
    category: record.category.name,
    categoryCode: record.category.code,
    createdBy: record.createdBy.name,
    createdAt: formatDateTime(record.createdAt),
    submittedBy: record.submittedBy?.name ?? null,
    submittedAt: record.submittedAt
      ? formatDateTime(record.submittedAt)
      : null,
    approvedBy: record.approvedBy?.name ?? null,
    approvedAt: record.approvedAt ? formatDateTime(record.approvedAt) : null,
    remarks: record.remarks,
  }
}

function flattenRecordValue(value: {
  valueText: string | null
  valueNumber: { toString(): string } | null
  valueDate: Date | null
  valueBoolean: boolean | null
  valueJson: unknown
  fieldDefinition: { type: FieldType }
}): string | number | null {
  switch (value.fieldDefinition.type) {
    case "TEXT":
    case "TEXTAREA":
    case "SELECT":
      return value.valueText ?? numberToCell(value.valueNumber)
    case "NUMBER":
    case "DECIMAL":
      return numberToCell(value.valueNumber) ?? value.valueText
    case "DATE":
      return value.valueDate ? formatDateOnly(value.valueDate) : null
    case "BOOLEAN":
      return value.valueBoolean === null
        ? null
        : value.valueBoolean
          ? "Yes"
          : "No"
    default:
      return (
        jsonToCell(value.valueJson) ??
        value.valueText ??
        numberToCell(value.valueNumber) ??
        (value.valueDate ? formatDateOnly(value.valueDate) : null) ??
        (value.valueBoolean === null
          ? null
          : value.valueBoolean
            ? "Yes"
            : "No")
      )
  }
}

function numberToCell(value: { toString(): string } | null): number | string | null {
  if (value === null) return null
  const text = value.toString()
  const numeric = Number(text)
  return Number.isFinite(numeric) ? numeric : text
}

function jsonToCell(value: unknown): string | null {
  if (value === null || value === undefined) return null
  if (typeof value === "string") return value
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value)
  }

  try {
    return JSON.stringify(value)
  } catch {
    return null
  }
}

function dateRangeLabel(params: ReportQueryInput): string {
  if (params.from && params.to) return `${params.from} to ${params.to}`
  if (params.from) return `From ${params.from}`
  if (params.to) return `Until ${params.to}`
  return "All time"
}

function formatDateOnly(value: Date): string {
  return value.toISOString().slice(0, 10)
}

function formatDateTime(value: Date): string {
  return `${formatDateOnly(value)} ${value.toISOString().slice(11, 16)}`
}
