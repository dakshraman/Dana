import type { Metadata } from "next"
import Link from "next/link"
import { Paperclip, Plus } from "lucide-react"

import { PageHeader } from "@/components/shared/page-header"
import { Pagination } from "@/components/shared/pagination"
import { StatusBadge } from "@/components/shared/status-badge"
import { TableShell } from "@/components/shared/table-shell"
import { Button } from "@/components/ui/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { formatDate, formatDateTime } from "@/lib/format"
import { getRecordFormData, listRecords } from "@/lib/services/records"
import { requirePageScope } from "@/lib/session"
import { recordQuerySchema } from "@/lib/validations/record"

export const metadata: Metadata = { title: "Records" }

type SearchParams = Promise<Record<string, string | string[] | undefined>>

function toRecord(params: Record<string, string | string[] | undefined>) {
  const output: Record<string, string> = {}
  for (const [key, value] of Object.entries(params)) {
    const first = Array.isArray(value) ? value[0] : value
    if (first) output[key] = first
  }
  return output
}

const STATUSES = [
  ["all", "All statuses"],
  ["DRAFT", "Draft"],
  ["SUBMITTED", "Submitted"],
  ["APPROVED", "Approved"],
  ["REJECTED", "Rejected"],
  ["RETURNED", "Returned"],
  ["ARCHIVED", "Archived"],
] as const

export default async function RecordsPage({
  searchParams,
}: {
  searchParams: SearchParams
}) {
  const scope = await requirePageScope()
  const raw = toRecord(await searchParams)
  const parsed = recordQuerySchema.safeParse(raw)
  const query = parsed.success ? parsed.data : recordQuerySchema.parse({})

  const [result, formData] = await Promise.all([
    listRecords(scope, query),
    getRecordFormData(scope),
  ])

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Records"
        description="Operational entries from every branch in your scope. Draft and returned records can be edited before submission."
        actions={
          scope.canCreateRecords ? (
            <Button size="sm" render={<Link href="/records/new" />}>
              <Plus className="size-4" /> New record
            </Button>
          ) : null
        }
      />

      <form
        method="get"
        className="grid gap-4 border bg-card p-4 sm:grid-cols-2 lg:grid-cols-6"
      >
        <div className="flex flex-col gap-1">
          <label htmlFor="q" className="text-[10px] font-semibold tracking-widest text-muted-foreground uppercase">
            Search
          </label>
          <input
            id="q"
            name="q"
            defaultValue={query.q}
            placeholder="Record number, title, reference"
            className="h-9 border-b border-input bg-transparent text-sm outline-none placeholder:text-muted-foreground focus-visible:border-b-ring"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="branchId" className="text-[10px] font-semibold tracking-widest text-muted-foreground uppercase">
            Branch
          </label>
          <select
            id="branchId"
            name="branchId"
            defaultValue={query.branchId ?? ""}
            className="h-9 border-b border-input bg-transparent text-sm outline-none focus-visible:border-b-ring"
          >
            <option value="">All branches</option>
            {formData.branches.map((branch) => (
              <option key={branch.id} value={branch.id}>
                {branch.code} — {branch.name}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="categoryId" className="text-[10px] font-semibold tracking-widest text-muted-foreground uppercase">
            Category
          </label>
          <select
            id="categoryId"
            name="categoryId"
            defaultValue={query.categoryId ?? ""}
            className="h-9 border-b border-input bg-transparent text-sm outline-none focus-visible:border-b-ring"
          >
            <option value="">All categories</option>
            {formData.categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="status" className="text-[10px] font-semibold tracking-widest text-muted-foreground uppercase">
            Status
          </label>
          <select
            id="status"
            name="status"
            defaultValue={query.status}
            className="h-9 border-b border-input bg-transparent text-sm outline-none focus-visible:border-b-ring"
          >
            {STATUSES.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="from" className="text-[10px] font-semibold tracking-widest text-muted-foreground uppercase">
            From
          </label>
          <input
            id="from"
            name="from"
            type="date"
            defaultValue={query.from}
            className="h-9 border-b border-input bg-transparent text-sm outline-none focus-visible:border-b-ring"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="to" className="text-[10px] font-semibold tracking-widest text-muted-foreground uppercase">
            To
          </label>
          <input
            id="to"
            name="to"
            type="date"
            defaultValue={query.to}
            className="h-9 border-b border-input bg-transparent text-sm outline-none focus-visible:border-b-ring"
          />
        </div>
        <div className="flex items-end gap-2 sm:col-span-2 lg:col-span-6">
          <Button type="submit" size="sm">
            Filter
          </Button>
          <Button variant="ghost" size="sm" render={<Link href="/records" />}>
            Reset
          </Button>
          <span className="ml-auto text-[10px] tracking-wider text-muted-foreground uppercase">
            {result.total} record{result.total === 1 ? "" : "s"} in scope
          </span>
        </div>
      </form>

      <TableShell
        isEmpty={result.items.length === 0}
        emptyTitle="No records found"
        emptyDescription="Adjust the filters or create a new operations record."
        footer={
          <Pagination
            page={result.page}
            totalPages={result.totalPages}
            total={result.total}
            pageSize={result.pageSize}
            basePath="/records"
            searchParams={raw}
          />
        }
      >
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Record</TableHead>
              <TableHead>Branch</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Created by</TableHead>
              <TableHead>Submitted</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Files</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {result.items.map((record) => (
              <TableRow key={record.id}>
                <TableCell>
                  <Link
                    href={`/records/${record.id}`}
                    className="font-medium underline-offset-4 hover:underline"
                  >
                    {record.recordNumber}
                  </Link>
                  <p className="max-w-64 truncate text-xs text-muted-foreground">
                    {record.title}
                  </p>
                </TableCell>
                <TableCell className="text-sm">
                  {record.branch.name}
                  <p className="font-mono text-[10px] text-muted-foreground">
                    {record.branch.code}
                  </p>
                </TableCell>
                <TableCell className="text-sm">{record.category.name}</TableCell>
                <TableCell className="text-xs text-muted-foreground">
                  {formatDate(record.recordDate)}
                </TableCell>
                <TableCell className="text-sm">{record.createdBy.name}</TableCell>
                <TableCell className="text-xs text-muted-foreground">
                  {record.submittedAt
                    ? formatDateTime(record.submittedAt)
                    : "—"}
                </TableCell>
                <TableCell>
                  <StatusBadge status={record.status} />
                </TableCell>
                <TableCell className="text-right text-xs text-muted-foreground">
                  {record._count.attachments > 0 ? (
                    <span className="inline-flex items-center gap-1">
                      <Paperclip className="size-3" />
                      {record._count.attachments}
                    </span>
                  ) : (
                    "—"
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableShell>
    </div>
  )
}
