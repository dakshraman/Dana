import type { Metadata } from "next"
import Link from "next/link"
import {
  ArrowRight,
  Building2,
  CheckCircle2,
  ClipboardList,
  Clock3,
  FileEdit,
  Inbox,
} from "lucide-react"

import { BreakdownBars, TrendChart } from "@/components/charts/overview-charts"
import { PageHeader } from "@/components/shared/page-header"
import { StatCard } from "@/components/shared/stat-card"
import { StatusBadge } from "@/components/shared/status-badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { EmptyState } from "@/components/shared/empty-state"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { formatDate, formatDateTime, formatNumber } from "@/lib/format"
import { getDashboardData } from "@/lib/services/dashboard"
import { getRegionOptions } from "@/lib/services/branches"
import { getRecordFormData } from "@/lib/services/records"
import { requirePageScope } from "@/lib/session"
import type { DashboardGranularity } from "@/lib/services/dashboard"

export const metadata: Metadata = { title: "Dashboard" }

type SearchParams = Promise<Record<string, string | string[] | undefined>>

function single(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value
}

function isDate(value: string | undefined): string | undefined {
  return value && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : undefined
}

const GRANULARITIES: { value: DashboardGranularity; label: string }[] = [
  { value: "day", label: "Daily" },
  { value: "week", label: "Weekly" },
  { value: "month", label: "Monthly" },
  { value: "year", label: "Yearly" },
]

const STATUSES = [
  "DRAFT",
  "SUBMITTED",
  "APPROVED",
  "REJECTED",
  "RETURNED",
  "ARCHIVED",
] as const

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: SearchParams
}) {
  const scope = await requirePageScope()
  const params = await searchParams

  const granularityParam = single(params.granularity)
  const granularity = GRANULARITIES.some(
    (item) => item.value === granularityParam
  )
    ? (granularityParam as DashboardGranularity)
    : "month"
  const statusParam = single(params.status)
  const status = STATUSES.includes(statusParam as (typeof STATUSES)[number])
    ? statusParam
    : undefined

  const filters = {
    from: isDate(single(params.from)),
    to: isDate(single(params.to)),
    branchId: single(params.branchId) || undefined,
    regionId: single(params.regionId) || undefined,
    categoryId: single(params.categoryId) || undefined,
    status,
    granularity,
  }

  const [data, formData, regions] = await Promise.all([
    getDashboardData(scope, filters),
    getRecordFormData(scope),
    getRegionOptions(scope),
  ])

  const kpis = data.kpis
  const cards = data.cards

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Dashboard"
        description={`Operational overview for ${formatDate(data.range.from)} to ${formatDate(
          data.range.to
        )}. Every figure is calculated from the live database.`}
        actions={
          <>
            <Button variant="outline" size="sm" render={<Link href="/reports" />}>
              Open reports
            </Button>
            <Button size="sm" render={<Link href="/records/new" />}>
              New record
            </Button>
          </>
        }
      />

      <form
        method="get"
        className="grid gap-4 border bg-card p-4 sm:grid-cols-2 lg:grid-cols-7"
      >
        <div className="flex flex-col gap-1">
          <label htmlFor="from" className="text-[10px] font-semibold tracking-widest text-muted-foreground uppercase">
            From
          </label>
          <input
            id="from"
            name="from"
            type="date"
            defaultValue={filters.from}
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
            defaultValue={filters.to}
            className="h-9 border-b border-input bg-transparent text-sm outline-none focus-visible:border-b-ring"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="branchId" className="text-[10px] font-semibold tracking-widest text-muted-foreground uppercase">
            Branch
          </label>
          <select
            id="branchId"
            name="branchId"
            defaultValue={filters.branchId ?? ""}
            className="h-9 border-b border-input bg-transparent text-sm outline-none focus-visible:border-b-ring"
          >
            <option value="">All branches</option>
            {formData.branches.map((branch) => (
              <option key={branch.id} value={branch.id}>
                {branch.name} ({branch.code})
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="regionId" className="text-[10px] font-semibold tracking-widest text-muted-foreground uppercase">
            Region
          </label>
          <select
            id="regionId"
            name="regionId"
            defaultValue={filters.regionId ?? ""}
            className="h-9 border-b border-input bg-transparent text-sm outline-none focus-visible:border-b-ring"
          >
            <option value="">All regions</option>
            {regions.map((region) => (
              <option key={region.id} value={region.id}>
                {region.name}
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
            defaultValue={filters.categoryId ?? ""}
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
            defaultValue={filters.status ?? ""}
            className="h-9 border-b border-input bg-transparent text-sm outline-none focus-visible:border-b-ring"
          >
            <option value="">All statuses</option>
            {STATUSES.map((item) => (
              <option key={item} value={item}>
                {item.charAt(0) + item.slice(1).toLowerCase()}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="granularity" className="text-[10px] font-semibold tracking-widest text-muted-foreground uppercase">
            Group by
          </label>
          <select
            id="granularity"
            name="granularity"
            defaultValue={granularity}
            className="h-9 border-b border-input bg-transparent text-sm outline-none focus-visible:border-b-ring"
          >
            {GRANULARITIES.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
        </div>
        <div className="flex items-end gap-2 sm:col-span-2 lg:col-span-7">
          <Button type="submit" size="sm">
            Apply filters
          </Button>
          <Button variant="ghost" size="sm" render={<Link href="/dashboard" />}>
            Reset
          </Button>
          <span className="ml-auto hidden text-[10px] tracking-wider text-muted-foreground uppercase sm:block">
            Generated {formatDateTime(data.generatedAt)} UTC
          </span>
        </div>
      </form>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Total records"
          value={cards.totalRecords}
          hint={`${formatNumber(kpis.drafts)} drafts · ${formatNumber(kpis.returned)} returned`}
          trend={{ value: cards.trend, label: "vs last month" }}
          icon={ClipboardList}
          tone="default"
        />
        <StatCard
          label="Pending approvals"
          value={cards.pendingApprovals}
          hint={`${formatNumber(kpis.submittedToday)} submitted today`}
          icon={Clock3}
          tone="warning"
        />
        <StatCard
          label="Approved this month"
          value={cards.approvedThisMonth}
          hint={`${formatNumber(cards.thisMonth)} records logged this month`}
          icon={CheckCircle2}
          tone="positive"
        />
        <StatCard
          label="Active branches"
          value={`${formatNumber(cards.activeBranches)} / ${formatNumber(cards.totalBranches)}`}
          hint={`${formatNumber(cards.activeUsers)} active users in scope`}
          icon={Building2}
          tone="default"
        />
      </section>

      <section className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Record activity</CardTitle>
            <CardDescription>
              Total and approved records grouped by {granularity}.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <TrendChart
              data={data.trend.map((point) => ({
                label: point.label,
                total: point.total,
                approved: point.approved ?? 0,
              }))}
            />
            <div className="mt-4 flex flex-wrap items-center gap-4 text-[10px] font-semibold tracking-widest text-muted-foreground uppercase">
              <span className="inline-flex items-center gap-1.5">
                <span className="size-2 bg-[var(--chart-2)]" /> All records
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="size-2 bg-[var(--chart-4)]" /> Approved
              </span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Status mix</CardTitle>
            <CardDescription>Records in the selected period.</CardDescription>
          </CardHeader>
          <CardContent>
            <BreakdownBars
              data={data.statusBreakdown.map((item) => ({
                name: item.status.charAt(0) + item.status.slice(1).toLowerCase(),
                value: item.count,
              }))}
            />
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Records by category</CardTitle>
            <CardDescription>Where activity is concentrated.</CardDescription>
          </CardHeader>
          <CardContent>
            <BreakdownBars
              data={data.categoryBreakdown.map((item) => ({
                name: item.name,
                value: item.count,
              }))}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Recent activity</CardTitle>
            <CardDescription>Latest workflow decisions and submissions.</CardDescription>
          </CardHeader>
          <CardContent>
            {data.recentActivity.length === 0 ? (
              <EmptyState
                icon={Inbox}
                title="No activity yet"
                description="Workflow events will appear here as records move through review."
                className="border-0 bg-transparent py-6"
              />
            ) : (
              <ul className="flex flex-col divide-y">
                {data.recentActivity.slice(0, 7).map((item) => (
                  <li key={item.id} className="flex gap-3 py-3 first:pt-0 last:pb-0">
                    <span className="mt-1.5 size-1.5 shrink-0 bg-primary" />
                    <div className="min-w-0">
                      <p className="truncate text-sm">
                        <span className="font-medium">{item.actorName}</span>{" "}
                        {item.action.charAt(0) + item.action.slice(1).toLowerCase()}{" "}
                        <span className="font-mono text-xs">{item.recordNumber}</span>
                      </p>
                      <p className="truncate text-xs text-muted-foreground">
                        {item.branchName} · {formatDateTime(item.createdAt)} UTC
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader className="flex flex-row items-start justify-between gap-4">
            <div>
              <CardTitle>Recent records</CardTitle>
              <CardDescription>The six most recently created records.</CardDescription>
            </div>
            <Button variant="ghost" size="xs" render={<Link href="/records" />}>
              View all <ArrowRight className="size-3" />
            </Button>
          </CardHeader>
          <CardContent className="px-0">
            {data.recentRecords.length === 0 ? (
              <EmptyState
                icon={FileEdit}
                title="No records yet"
                description="Create the first operations record to start tracking activity."
                className="mx-4 border-0 bg-transparent"
              />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Record</TableHead>
                    <TableHead>Branch</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.recentRecords.map((record) => (
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
                        {record.branch.code}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {formatDate(record.recordDate)}
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={record.status} />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Branch performance</CardTitle>
            <CardDescription>Records in the selected period.</CardDescription>
          </CardHeader>
          <CardContent>
            {data.branchSummaries.length === 0 ? (
              <p className="py-6 text-sm text-muted-foreground">
                No branch activity in this period.
              </p>
            ) : (
              <ul className="flex flex-col divide-y">
                {data.branchSummaries.slice(0, 6).map((branch) => (
                  <li key={branch.branchId} className="flex items-center justify-between gap-3 py-2.5 first:pt-0 last:pb-0">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{branch.name}</p>
                      <p className="text-[10px] tracking-widest text-muted-foreground uppercase">
                        {branch.code}
                      </p>
                    </div>
                    <div className="text-right text-xs">
                      <p className="font-mono">{formatNumber(branch.total)}</p>
                      <p className="text-muted-foreground">
                        {formatNumber(branch.pending)} pending
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </section>

      {cards.overdueDrafts > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Needs attention</CardTitle>
            <CardDescription>
              Drafts and returned records untouched for more than{" "}
              {data.settings.overdueDays} days.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm">
              <span className="font-semibold">{formatNumber(cards.overdueDrafts)}</span>{" "}
              record{cards.overdueDrafts === 1 ? "" : "s"} may be overdue.
            </p>
            <Button variant="outline" size="sm" render={<Link href="/records?status=DRAFT" />}>
              Review drafts
            </Button>
          </CardContent>
        </Card>
      ) : null}
    </div>
  )
}
