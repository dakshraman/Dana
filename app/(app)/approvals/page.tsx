import type { Metadata } from "next"
import Link from "next/link"
import { redirect } from "next/navigation"
import { Inbox } from "lucide-react"

import { RecordReviewDialog } from "@/components/records/record-actions"
import { EmptyState } from "@/components/shared/empty-state"
import { PageHeader } from "@/components/shared/page-header"
import { Pagination } from "@/components/shared/pagination"
import { StatusBadge } from "@/components/shared/status-badge"
import { TableShell } from "@/components/shared/table-shell"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { formatDate, formatDateTime, formatNumber } from "@/lib/format"
import { getApprovalQueue, getRecordFormData } from "@/lib/services/records"
import { getSystemSettings } from "@/lib/settings"
import { requirePageScope } from "@/lib/session"
import { recordQuerySchema } from "@/lib/validations/record"

export const metadata: Metadata = { title: "Approvals" }

type SearchParams = Promise<Record<string, string | string[] | undefined>>

function toRecord(params: Record<string, string | string[] | undefined>) {
  const output: Record<string, string> = {}
  for (const [key, value] of Object.entries(params)) {
    const first = Array.isArray(value) ? value[0] : value
    if (first) output[key] = first
  }
  return output
}

export default async function ApprovalsPage({
  searchParams,
}: {
  searchParams: SearchParams
}) {
  const scope = await requirePageScope()
  if (!scope.canApproveRecords) redirect("/dashboard")

  const raw = toRecord(await searchParams)
  const parsed = recordQuerySchema.safeParse(raw)
  const query = parsed.success ? parsed.data : recordQuerySchema.parse({})

  const [result, formData, settings] = await Promise.all([
    getApprovalQueue(scope, query),
    getRecordFormData(scope),
    getSystemSettings(),
  ])

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Approvals"
        description="Submitted records from your branches that you are allowed to review. Approve, return or reject each submission."
        actions={
          <>
            <Badge
              variant="outline"
              className="h-9 border border-border px-3 tabular-nums"
            >
              {formatNumber(result.total)} pending
            </Badge>
            <Button
              variant="outline"
              size="sm"
              render={<Link href="/reports" />}
            >
              Open reports
            </Button>
          </>
        }
      />

      <form
        method="get"
        className="grid gap-4 border bg-card p-4 sm:grid-cols-2 lg:grid-cols-5"
      >
        <input type="hidden" name="sort" value={query.sort} />
        <input type="hidden" name="direction" value={query.direction} />

        <div className="flex flex-col gap-1">
          <label
            htmlFor="q"
            className="text-[10px] font-semibold tracking-widest text-muted-foreground uppercase"
          >
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
          <label
            htmlFor="branchId"
            className="text-[10px] font-semibold tracking-widest text-muted-foreground uppercase"
          >
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
          <label
            htmlFor="categoryId"
            className="text-[10px] font-semibold tracking-widest text-muted-foreground uppercase"
          >
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
          <label
            htmlFor="from"
            className="text-[10px] font-semibold tracking-widest text-muted-foreground uppercase"
          >
            Record date from
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
          <label
            htmlFor="to"
            className="text-[10px] font-semibold tracking-widest text-muted-foreground uppercase"
          >
            Record date to
          </label>
          <input
            id="to"
            name="to"
            type="date"
            defaultValue={query.to}
            className="h-9 border-b border-input bg-transparent text-sm outline-none focus-visible:border-b-ring"
          />
        </div>
        <div className="flex items-end gap-2 sm:col-span-2 lg:col-span-5">
          <Button type="submit" size="sm">
            Filter
          </Button>
          <Button variant="ghost" size="sm" render={<Link href="/approvals" />}>
            Reset
          </Button>
          <span className="ml-auto text-[10px] tracking-wider text-muted-foreground uppercase">
            {formatNumber(result.total)} awaiting review
          </span>
        </div>
      </form>

      <TableShell
        isEmpty={result.items.length === 0}
        empty={
          <EmptyState
            icon={Inbox}
            title="No records awaiting review"
            description={
              settings.allowSelfApproval
                ? "No submitted records match the current filters."
                : "No submitted records match the current filters. Records you submitted yourself are excluded."
            }
            className="border-0 bg-transparent"
          />
        }
        toolbar={
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
            <span>
              Showing{" "}
              <span className="font-medium tabular-nums text-foreground">
                {formatNumber(result.items.length)}
              </span>{" "}
              of{" "}
              <span className="font-medium tabular-nums text-foreground">
                {formatNumber(result.total)}
              </span>{" "}
              submissions
            </span>
            {!settings.allowSelfApproval ? (
              <span>Records you submitted are excluded from this queue.</span>
            ) : null}
          </div>
        }
        footer={
          <Pagination
            page={result.page}
            totalPages={result.totalPages}
            total={result.total}
            pageSize={result.pageSize}
            basePath="/approvals"
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
              <TableHead>Submitted by</TableHead>
              <TableHead>Submitted at</TableHead>
              <TableHead>Record date</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {result.items.map((record) => (
              <TableRow key={record.id}>
                <TableCell>
                  <Link
                    href={`/records/${record.id}`}
                    className="group block max-w-64"
                  >
                    <span className="block font-medium underline-offset-4 group-hover:underline">
                      {record.recordNumber}
                    </span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {record.title}
                    </span>
                  </Link>
                </TableCell>
                <TableCell className="text-sm">
                  {record.branch.name}
                  <p className="font-mono text-[10px] text-muted-foreground">
                    {record.branch.code}
                  </p>
                </TableCell>
                <TableCell className="text-sm">
                  {record.category.name}
                </TableCell>
                <TableCell className="text-sm">
                  {record.submittedBy?.name ?? record.createdBy.name}
                </TableCell>
                <TableCell className="text-xs text-muted-foreground">
                  {record.submittedAt
                    ? formatDateTime(record.submittedAt)
                    : "—"}
                </TableCell>
                <TableCell className="text-xs text-muted-foreground">
                  {formatDate(record.recordDate)}
                </TableCell>
                <TableCell>
                  <StatusBadge status={record.status} />
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex items-center justify-end gap-2">
                    <RecordReviewDialog
                      recordId={record.id}
                      recordNumber={record.recordNumber}
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      render={<Link href={`/records/${record.id}`} />}
                    >
                      Open
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableShell>
    </div>
  )
}
