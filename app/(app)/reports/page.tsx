import type { Metadata } from "next"
import Link from "next/link"
import {
  CheckCircle2,
  ClipboardList,
  Clock3,
  Download,
  Percent,
} from "lucide-react"

import { BreakdownBars } from "@/components/charts/overview-charts"
import { EmptyState } from "@/components/shared/empty-state"
import { PageHeader } from "@/components/shared/page-header"
import { Pagination } from "@/components/shared/pagination"
import { StatCard } from "@/components/shared/stat-card"
import { StatusBadge } from "@/components/shared/status-badge"
import { TableShell } from "@/components/shared/table-shell"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  buildQueryString,
  formatDate,
  formatDateTime,
  formatNumber,
  formatPercent,
} from "@/lib/format"
import { RECORD_STATUSES, STATUS_LABELS } from "@/lib/permissions"
import { getReport, getReportFilterOptions } from "@/lib/services/reports"
import { requirePageScope } from "@/lib/session"
import {
  reportQuerySchema,
  type ReportQueryInput,
} from "@/lib/validations/report"

export const metadata: Metadata = { title: "Reports" }

type SearchParams = Promise<Record<string, string | string[] | undefined>>

const STATUS_OPTIONS = RECORD_STATUSES.map((status) => ({
  value: status,
  label: STATUS_LABELS[status],
}))

const EXPORT_FORMATS = [
  { value: "csv", label: "CSV" },
  { value: "xlsx", label: "XLSX" },
  { value: "pdf", label: "PDF" },
] as const

type ExportFormat = (typeof EXPORT_FORMATS)[number]["value"]

function toRecord(params: Record<string, string | string[] | undefined>) {
  const output: Record<string, string> = {}
  for (const [key, value] of Object.entries(params)) {
    const first = Array.isArray(value) ? value[0] : value
    if (first) output[key] = first
  }
  return output
}

function exportHref(format: ExportFormat, query: ReportQueryInput) {
  const search = buildQueryString({
    format,
    q: query.q,
    branchId: query.branchId,
    regionId: query.regionId,
    country: query.country,
    city: query.city,
    categoryId: query.categoryId,
    status: query.status === "all" ? undefined : query.status,
    from: query.from,
    to: query.to,
    sort: query.sort,
    direction: query.direction,
  })

  return `/api/reports/export${search}`
}

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: SearchParams
}) {
  const scope = await requirePageScope()
  const raw = toRecord(await searchParams)
  const parsed = reportQuerySchema.safeParse(raw)
  const query = parsed.success ? parsed.data : reportQuerySchema.parse({})

  const [report, filterOptions] = await Promise.all([
    getReport(scope, query),
    getReportFilterOptions(scope),
  ])

  const total = report.aggregates.total
  const approved =
    report.aggregates.byStatus.find((item) => item.status === "APPROVED")
      ?.count ?? 0
  const pending =
    report.aggregates.byStatus.find((item) => item.status === "SUBMITTED")
      ?.count ?? 0
  const approvalRate = total === 0 ? "—" : formatPercent(approved / total)

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Reports"
        description="Operational records across your scope, summarised by status, category and branch. Every figure is calculated from the current filters."
        actions={
          scope.canExport ? (
            <>
              {EXPORT_FORMATS.map((format) => (
                <Button
                  key={format.value}
                  variant="outline"
                  size="sm"
                  render={<a href={exportHref(format.value, query)} />}
                >
                  <Download className="size-4" /> {format.label}
                </Button>
              ))}
            </>
          ) : null
        }
      />

      <form
        method="get"
        className="grid gap-4 border bg-card p-4 sm:grid-cols-2 lg:grid-cols-4"
      >
        <input type="hidden" name="sort" value={query.sort} />
        <input type="hidden" name="direction" value={query.direction} />

        <div className="flex flex-col gap-1 sm:col-span-2">
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
            {filterOptions.branches.map((branch) => (
              <option key={branch.id} value={branch.id}>
                {branch.code} — {branch.name}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label
            htmlFor="regionId"
            className="text-[10px] font-semibold tracking-widest text-muted-foreground uppercase"
          >
            Region
          </label>
          <select
            id="regionId"
            name="regionId"
            defaultValue={query.regionId ?? ""}
            className="h-9 border-b border-input bg-transparent text-sm outline-none focus-visible:border-b-ring"
          >
            <option value="">All regions</option>
            {filterOptions.regions.map((region) => (
              <option key={region.id} value={region.id}>
                {region.name}
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
            {filterOptions.categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label
            htmlFor="status"
            className="text-[10px] font-semibold tracking-widest text-muted-foreground uppercase"
          >
            Status
          </label>
          <select
            id="status"
            name="status"
            defaultValue={query.status}
            className="h-9 border-b border-input bg-transparent text-sm outline-none focus-visible:border-b-ring"
          >
            <option value="all">All statuses</option>
            {STATUS_OPTIONS.map((status) => (
              <option key={status.value} value={status.value}>
                {status.label}
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
        <div className="flex items-end gap-2 sm:col-span-2 lg:col-span-4">
          <Button type="submit" size="sm">
            Apply filters
          </Button>
          <Button variant="ghost" size="sm" render={<Link href="/reports" />}>
            Reset
          </Button>
          <span className="ml-auto text-[10px] tracking-wider text-muted-foreground uppercase">
            {formatNumber(total)} records · {report.aggregates.dateRange}
          </span>
        </div>
      </form>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Total records"
          value={total}
          hint={report.aggregates.dateRange}
          icon={ClipboardList}
        />
        <StatCard
          label="Approved"
          value={approved}
          hint="Records with an approved status in this range."
          icon={CheckCircle2}
          tone="positive"
        />
        <StatCard
          label="Pending review"
          value={pending}
          hint="Submitted records still awaiting a decision."
          icon={Clock3}
          tone="warning"
        />
        <StatCard
          label="Approval rate"
          value={approvalRate}
          hint={`${formatNumber(approved)} approved of ${formatNumber(total)} records.`}
          icon={Percent}
        />
      </section>

      <section className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Status distribution</CardTitle>
            <CardDescription>
              Current workflow status of matching records.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <BreakdownBars
              data={report.aggregates.byStatus.map((item) => ({
                name: item.label,
                value: item.count,
              }))}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Records by category</CardTitle>
            <CardDescription>
              Where record volume is concentrated.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <BreakdownBars
              data={report.aggregates.byCategory.map((item) => ({
                name: item.name,
                value: item.count,
              }))}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Records by branch</CardTitle>
            <CardDescription>
              Record volume across branches in scope.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <BreakdownBars
              data={report.aggregates.byBranch.map((item) => ({
                name: item.name,
                value: item.count,
              }))}
            />
          </CardContent>
        </Card>
      </section>

      <TableShell
        isEmpty={report.items.length === 0}
        empty={
          <EmptyState
            icon={Download}
            title="No records match these filters"
            description={
              scope.canExport
                ? "Try a wider date range or fewer filters. You can still download the current selection as a file."
                : "Try a wider date range or fewer filters."
            }
            action={
              scope.canExport ? (
                <Button
                  variant="outline"
                  size="sm"
                  render={<a href={exportHref("csv", query)} />}
                >
                  <Download className="size-4" /> Download CSV
                </Button>
              ) : undefined
            }
            className="border-0 bg-transparent"
          />
        }
        toolbar={
          <div className="flex w-full flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1 text-xs text-muted-foreground">
              <span className="font-semibold tracking-widest text-foreground uppercase">
                Report results
              </span>
              <span>
                <span className="font-medium tabular-nums text-foreground">
                  {formatNumber(total)}
                </span>{" "}
                records
              </span>
              <span>{report.aggregates.dateRange}</span>
            </div>
            <span className="text-[10px] tracking-wider text-muted-foreground uppercase">
              {scope.canExport
                ? "Exports use the current filters"
                : "View-only access"}
            </span>
          </div>
        }
        footer={
          <Pagination
            page={report.page}
            totalPages={report.totalPages}
            total={total}
            pageSize={report.pageSize}
            basePath="/reports"
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
              <TableHead>Record date</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Created by</TableHead>
              <TableHead>Approved by</TableHead>
              <TableHead>Approved at</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {report.items.map((record) => (
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
                <TableCell className="text-xs text-muted-foreground">
                  {formatDate(record.recordDate)}
                </TableCell>
                <TableCell>
                  <StatusBadge status={record.status} />
                </TableCell>
                <TableCell className="text-sm">
                  {record.createdBy.name}
                </TableCell>
                <TableCell className="text-sm">
                  {record.approvedBy?.name ?? (
                    <span className="text-muted-foreground">—</span>
                  )}
                </TableCell>
                <TableCell className="text-xs text-muted-foreground">
                  {record.approvedAt ? formatDateTime(record.approvedAt) : "—"}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableShell>
    </div>
  )
}
