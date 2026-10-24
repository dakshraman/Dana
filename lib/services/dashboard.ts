import "server-only"

import { branchScopeWhere, userScopeWhere } from "@/lib/access"
import {
  addDays,
  companyDateOnly,
  companyDayStart,
  companyMonthStart,
} from "@/lib/company-time"
import { prisma } from "@/lib/db"
import { Prisma } from "@/lib/generated/prisma/client"
import type { ApprovalAction } from "@/lib/generated/prisma/enums"
import { percentChange } from "@/lib/format"
import {
  RECORD_STATUSES,
  type AccessScope,
  type RecordStatusValue,
} from "@/lib/permissions"
import {
  getSystemSettings,
  type SystemSettings,
} from "@/lib/settings"

export type DashboardGranularity = "day" | "week" | "month" | "year"

export type DashboardFilters = {
  from?: string
  to?: string
  branchId?: string
  regionId?: string
  country?: string
  city?: string
  categoryId?: string
  status?: string
  granularity?: DashboardGranularity
}

export type DashboardKpis = {
  totalBranches: number
  activeBranches: number
  totalRecords: number
  submittedToday: number
  pendingApprovals: number
  approved: number
  rejected: number
  returned: number
  drafts: number
}

export type DashboardStatusBreakdown = {
  status: RecordStatusValue
  count: number
}

export type DashboardCategoryBreakdown = {
  categoryId: string
  name: string
  count: number
  /** Convenience alias used by charts that expect `{ name, value }`. */
  value: number
}

export type DashboardBranchSummary = {
  branchId: string
  code: string
  name: string
  country: string
  regionName: string
  total: number
  approved: number
  pending: number
  rejected: number
}

export type DashboardRegionSummary = {
  regionId: string
  name: string
  total: number
  approved: number
  pending: number
}

export type DashboardTrendPoint = {
  bucket: string
  count: number
  /** Aliases retained for the monthly chart variant. */
  key: string
  label: string
  total: number
  approved: number
}

export type DashboardActivity = {
  id: string
  action: ApprovalAction
  comment: string | null
  createdAt: Date
  actorName: string
  recordNumber: string
  recordTitle: string
  branchName: string
}

export type DashboardOverdueBranch = {
  branchId: string
  code: string
  name: string
  lastRecordDate: Date | null
}

export type DashboardCardMetrics = {
  totalBranches: number
  activeBranches: number
  activeUsers: number
  thisMonth: number
  lastMonth: number
  trend: number
  pendingApprovals: number
  myDrafts: number
  overdueDrafts: number
  approvedThisMonth: number
  totalRecords: number
}

export type DashboardRecentRecord = {
  id: string
  recordNumber: string
  title: string
  status: RecordStatusValue
  recordDate: Date
  createdAt: Date
  branch: { name: string; code: string }
  category: { name: string }
  createdBy: { name: string }
}

export type DashboardData = {
  range: {
    from: string
    to: string
    granularity: DashboardGranularity
  }
  kpis: DashboardKpis
  statusBreakdown: DashboardStatusBreakdown[]
  categoryBreakdown: DashboardCategoryBreakdown[]
  branchSummaries: DashboardBranchSummary[]
  regionalSummaries: DashboardRegionSummary[]
  trend: DashboardTrendPoint[]
  recentActivity: DashboardActivity[]
  overdueBranches: DashboardOverdueBranch[]
  /** Compatibility fields used by the dashboard overview UI. */
  settings: SystemSettings
  cards: DashboardCardMetrics
  statusCounts: Record<string, number>
  branchBreakdown: { name: string; code: string; value: number }[]
  recentRecords: DashboardRecentRecord[]
  generatedAt: Date
}

const DEFAULT_RANGE_DAYS = 30
const MAX_BRANCH_SUMMARIES = 12
const MAX_TREND_BUCKETS = 2_000
const DAY_MS = 86_400_000
const MONTH_LABELS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
]

const branchSelect = {
  id: true,
  code: true,
  name: true,
  country: true,
  isActive: true,
  regionId: true,
  region: { select: { id: true, name: true } },
} as const

type BranchTotals = {
  total: number
  approved: number
  pending: number
  rejected: number
}

type RegionTotals = {
  regionId: string
  name: string
  total: number
  approved: number
  pending: number
}

/**
 * Dashboard data for the caller's access scope. Every query is restricted to
 * the branches the caller can access. Filters are only applied on top of that
 * scope and can never widen it.
 */
export async function getDashboardData(
  scope: AccessScope,
  filters: DashboardFilters = {}
): Promise<DashboardData> {
  const generatedAt = new Date()
  const settings = await getSystemSettings()
  const granularity = resolveGranularity(filters.granularity)
  const { from, to } = resolveRange(filters.from, filters.to)
  const toExclusive = addDaysUtc(to, 1)
  const today = companyDayStart(generatedAt)
  const tomorrow = addDays(today, 1)
  const categoryId = cleanText(filters.categoryId, 64)
  const status = resolveStatus(filters.status)
  const branchId = cleanText(filters.branchId, 64)
  const regionId = cleanText(filters.regionId, 64)
  const country = cleanText(filters.country, 80)
  const city = cleanText(filters.city, 80)

  // Scope is always its own AND term. A branch/region/country/city filter can
  // only narrow the accessible branches; it must never replace the scope.
  const branchFilters: Prisma.BranchWhereInput[] = [branchScopeWhere(scope)]
  if (branchId) branchFilters.push({ id: branchId })
  if (regionId) branchFilters.push({ regionId })
  if (country) {
    branchFilters.push({ country: { equals: country, mode: "insensitive" } })
  }
  if (city) {
    branchFilters.push({ city: { equals: city, mode: "insensitive" } })
  }

  const branches = await prisma.branch.findMany({
    where: { AND: branchFilters },
    select: branchSelect,
    orderBy: { name: "asc" },
  })

  if (branches.length === 0) {
    return emptyDashboard(from, to, granularity, settings, generatedAt)
  }

  const branchIds = branches.map((branch) => branch.id)
  const branchById = new Map(branches.map((branch) => [branch.id, branch]))

  const baseRecordWhere: Prisma.DataRecordWhereInput = {
    branchId: { in: branchIds },
    ...(categoryId ? { categoryId } : {}),
    ...(status ? { status } : {}),
  }

  const recordWhere: Prisma.DataRecordWhereInput = {
    ...baseRecordWhere,
    recordDate: { gte: from, lt: toExclusive },
  }

  // "Submitted today" is about submission activity, not the record's business
  // date. It deliberately ignores the dashboard date range and status filter so
  // the KPI remains meaningful while drilling into another status.
  const submittedTodayWhere: Prisma.DataRecordWhereInput = {
    branchId: { in: branchIds },
    submittedAt: { gte: today, lt: tomorrow },
    ...(categoryId ? { categoryId } : {}),
  }

  const overdueDays = Math.max(0, Math.floor(settings.overdueDays))
  // Drafts are overdue by elapsed time, while a branch's last activity is a
  // date-only business date, so keep the two cutoffs distinct.
  const overdueCutoff = addDays(today, -overdueDays)
  const overdueDateCutoff = addDays(companyDateOnly(generatedAt), -overdueDays)

  const monthStart = companyMonthStart(generatedAt)
  const nextMonthStart = new Date(
    Date.UTC(monthStart.getUTCFullYear(), monthStart.getUTCMonth() + 1, 1)
  )
  const lastMonthStart = new Date(
    Date.UTC(monthStart.getUTCFullYear(), monthStart.getUTCMonth() - 1, 1)
  )

  const [
    statusGroups,
    categoryGroups,
    branchStatusGroups,
    submittedToday,
    activity,
    lastRecordGroups,
    trendRows,
    thisMonthGroups,
    lastMonthCount,
    activeUsers,
    myDrafts,
    overdueDrafts,
    recentRecords,
  ] = await Promise.all([
    prisma.dataRecord.groupBy({
      by: ["status"],
      where: recordWhere,
      _count: { _all: true },
    }),
    prisma.dataRecord.groupBy({
      by: ["categoryId"],
      where: recordWhere,
      _count: { _all: true },
    }),
    prisma.dataRecord.groupBy({
      by: ["branchId", "status"],
      where: recordWhere,
      _count: { _all: true },
    }),
    prisma.dataRecord.count({ where: submittedTodayWhere }),
    prisma.approvalHistory.findMany({
      where: {
        record: {
          branchId: { in: branchIds },
          ...(categoryId ? { categoryId } : {}),
        },
      },
      orderBy: { createdAt: "desc" },
      take: 10,
      select: {
        id: true,
        action: true,
        comment: true,
        createdAt: true,
        actor: { select: { name: true } },
        record: {
          select: {
            recordNumber: true,
            title: true,
            branch: { select: { name: true } },
          },
        },
      },
    }),
    prisma.dataRecord.groupBy({
      by: ["branchId"],
      where: {
        branchId: { in: branchIds },
        status: { not: "DRAFT" },
        ...(categoryId ? { categoryId } : {}),
      },
      _max: { recordDate: true },
    }),
    queryTrendCounts({
      branchIds,
      from,
      toExclusive,
      granularity,
      categoryId,
      status,
    }),
    prisma.dataRecord.groupBy({
      by: ["status"],
      where: {
        ...baseRecordWhere,
        recordDate: { gte: monthStart, lt: nextMonthStart },
      },
      _count: { _all: true },
    }),
    prisma.dataRecord.count({
      where: {
        ...baseRecordWhere,
        recordDate: { gte: lastMonthStart, lt: monthStart },
      },
    }),
    prisma.user.count({ where: { ...userScopeWhere(scope), isActive: true } }),
    prisma.dataRecord.count({
      where: {
        branchId: { in: branchIds },
        createdById: scope.userId,
        status: { in: ["DRAFT", "RETURNED"] },
        ...(categoryId ? { categoryId } : {}),
      },
    }),
    prisma.dataRecord.count({
      where: {
        branchId: { in: branchIds },
        status: { in: ["DRAFT", "RETURNED"] },
        updatedAt: { lt: overdueCutoff },
        ...(categoryId ? { categoryId } : {}),
      },
    }),
    prisma.dataRecord.findMany({
      where: recordWhere,
      select: {
        id: true,
        recordNumber: true,
        title: true,
        status: true,
        recordDate: true,
        createdAt: true,
        branch: { select: { name: true, code: true } },
        category: { select: { name: true } },
        createdBy: { select: { name: true } },
      },
      orderBy: [{ createdAt: "desc" }],
      take: 6,
    }),
  ])

  const statusCounts = new Map<RecordStatusValue, number>()
  for (const group of statusGroups) {
    statusCounts.set(group.status, group._count._all)
  }

  const statusCountMap: Record<string, number> = {}
  for (const group of statusGroups) {
    statusCountMap[group.status] = group._count._all
  }

  const countStatus = (value: RecordStatusValue) => statusCounts.get(value) ?? 0
  const totalRecords = statusGroups.reduce(
    (sum, group) => sum + group._count._all,
    0
  )

  const statusBreakdown: DashboardStatusBreakdown[] = RECORD_STATUSES.filter(
    (value) => countStatus(value) > 0
  ).map((value) => ({ status: value, count: countStatus(value) }))

  const categoryNames =
    categoryGroups.length > 0
      ? await prisma.recordCategory.findMany({
          where: { id: { in: categoryGroups.map((group) => group.categoryId) } },
          select: { id: true, name: true },
        })
      : []
  const categoryNameById = new Map(
    categoryNames.map((category) => [category.id, category.name])
  )

  const categoryBreakdown: DashboardCategoryBreakdown[] = categoryGroups
    .map((group) => ({
      categoryId: group.categoryId,
      name: categoryNameById.get(group.categoryId) ?? "Unknown category",
      count: group._count._all,
      value: group._count._all,
    }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))

  const branchTotals = new Map<string, BranchTotals>()
  const regionTotals = new Map<string, RegionTotals>()

  for (const branch of branches) {
    branchTotals.set(branch.id, emptyBranchTotals())
    if (!regionTotals.has(branch.regionId)) {
      regionTotals.set(branch.regionId, {
        regionId: branch.regionId,
        name: branch.region.name,
        total: 0,
        approved: 0,
        pending: 0,
      })
    }
  }

  for (const group of branchStatusGroups) {
    const branch = branchById.get(group.branchId)
    if (!branch) continue

    const branchEntry = branchTotals.get(group.branchId)
    if (branchEntry) applyStatusCount(branchEntry, group.status, group._count._all)

    const regionEntry = regionTotals.get(branch.regionId)
    if (regionEntry) {
      regionEntry.total += group._count._all
      if (group.status === "APPROVED") regionEntry.approved += group._count._all
      if (group.status === "SUBMITTED") regionEntry.pending += group._count._all
    }
  }

  const branchSummaries: DashboardBranchSummary[] = branches
    .map((branch) => {
      const totals = branchTotals.get(branch.id) ?? emptyBranchTotals()
      return {
        branchId: branch.id,
        code: branch.code,
        name: branch.name,
        country: branch.country,
        regionName: branch.region.name,
        ...totals,
      }
    })
    .sort((a, b) => b.total - a.total || a.name.localeCompare(b.name))
    .slice(0, MAX_BRANCH_SUMMARIES)

  const regionalSummaries: DashboardRegionSummary[] = [...regionTotals.values()]
    .map(({ regionId: id, name, total, approved, pending }) => ({
      regionId: id,
      name,
      total,
      approved,
      pending,
    }))
    .sort((a, b) => b.total - a.total || a.name.localeCompare(b.name))

  const lastRecordByBranch = new Map<string, Date | null>()
  for (const group of lastRecordGroups) {
    lastRecordByBranch.set(group.branchId, group._max.recordDate ?? null)
  }

  const overdueBranches: DashboardOverdueBranch[] = branches
    .filter((branch) => branch.isActive)
    .map((branch) => ({
      branchId: branch.id,
      code: branch.code,
      name: branch.name,
      lastRecordDate: lastRecordByBranch.get(branch.id) ?? null,
    }))
    .filter(
      (branch) =>
        branch.lastRecordDate === null ||
        branch.lastRecordDate.getTime() < overdueDateCutoff.getTime()
    )
    .sort((a, b) => {
      if (a.lastRecordDate === null && b.lastRecordDate === null) {
        return a.name.localeCompare(b.name)
      }
      if (a.lastRecordDate === null) return -1
      if (b.lastRecordDate === null) return 1
      return (
        a.lastRecordDate.getTime() - b.lastRecordDate.getTime() ||
        a.name.localeCompare(b.name)
      )
    })

  const trend: DashboardTrendPoint[] = enumerateBuckets(
    from,
    to,
    granularity
  ).map((bucket) => {
    const count = trendRows.totalByBucket.get(bucket) ?? 0
    return {
      bucket,
      count,
      key: bucket,
      label: bucketLabel(bucket, granularity),
      total: count,
      approved: trendRows.approvedByBucket.get(bucket) ?? 0,
    }
  })

  const recentActivity: DashboardActivity[] = activity.map((entry) => ({
    id: entry.id,
    action: entry.action,
    comment: entry.comment,
    createdAt: entry.createdAt,
    actorName: entry.actor.name,
    recordNumber: entry.record.recordNumber,
    recordTitle: entry.record.title,
    branchName: entry.record.branch.name,
  }))

  const thisMonthTotal = thisMonthGroups.reduce(
    (sum, group) => sum + group._count._all,
    0
  )
  const thisMonthApproved =
    thisMonthGroups.find((group) => group.status === "APPROVED")?._count._all ??
    0

  const recentRecordItems: DashboardRecentRecord[] = recentRecords.map(
    (record) => ({
      id: record.id,
      recordNumber: record.recordNumber,
      title: record.title,
      status: record.status,
      recordDate: record.recordDate,
      createdAt: record.createdAt,
      branch: record.branch,
      category: record.category,
      createdBy: record.createdBy,
    })
  )

  return {
    range: {
      from: formatDateOnly(from),
      to: formatDateOnly(to),
      granularity,
    },
    kpis: {
      totalBranches: branches.length,
      activeBranches: branches.filter((branch) => branch.isActive).length,
      totalRecords,
      submittedToday,
      pendingApprovals: countStatus("SUBMITTED"),
      approved: countStatus("APPROVED"),
      rejected: countStatus("REJECTED"),
      returned: countStatus("RETURNED"),
      drafts: countStatus("DRAFT"),
    },
    statusBreakdown,
    categoryBreakdown,
    branchSummaries,
    regionalSummaries,
    trend,
    recentActivity,
    overdueBranches,
    settings,
    cards: {
      totalBranches: branches.length,
      activeBranches: branches.filter((branch) => branch.isActive).length,
      activeUsers,
      thisMonth: thisMonthTotal,
      lastMonth: lastMonthCount,
      trend: percentChange(thisMonthTotal, lastMonthCount),
      pendingApprovals: countStatus("SUBMITTED"),
      myDrafts,
      overdueDrafts,
      approvedThisMonth: thisMonthApproved,
      totalRecords,
    },
    statusCounts: statusCountMap,
    branchBreakdown: branchSummaries.slice(0, 6).map((branch) => ({
      name: branch.name,
      code: branch.code,
      value: branch.total,
    })),
    recentRecords: recentRecordItems,
    generatedAt,
  }
}

type TrendQuery = {
  branchIds: string[]
  from: Date
  toExclusive: Date
  granularity: DashboardGranularity
  categoryId?: string
  status: RecordStatusValue | null
}

type TrendCounts = {
  totalByBucket: Map<string, number>
  approvedByBucket: Map<string, number>
}

/**
 * date_trunc buckets are computed by PostgreSQL. All user-controlled values
 * are bound parameters; the bucket expression is selected from a fixed set of
 * literals, never built from input.
 */
async function queryTrendCounts({
  branchIds,
  from,
  toExclusive,
  granularity,
  categoryId,
  status,
}: TrendQuery): Promise<TrendCounts> {
  const bucketExpression = trendBucketExpression(granularity)
  const categoryFilter = categoryId
    ? Prisma.sql`AND "categoryId" = ${categoryId}`
    : Prisma.empty
  const statusFilter = status
    ? Prisma.sql`AND "status" = ${status}::"RecordStatus"`
    : Prisma.empty

  const rows = await prisma.$queryRaw<
    { bucket: string; status: RecordStatusValue; count: number }[]
  >(Prisma.sql`
      SELECT ${bucketExpression} AS bucket,
             "status" AS status,
             COUNT(*)::int AS count
      FROM "DataRecord"
      WHERE "branchId" IN (${Prisma.join(branchIds)})
        AND "recordDate" >= ${from}::date
        AND "recordDate" < ${toExclusive}::date
        ${categoryFilter}
        ${statusFilter}
      GROUP BY 1, 2
      ORDER BY 1
    `)

  const totalByBucket = new Map<string, number>()
  const approvedByBucket = new Map<string, number>()

  for (const row of rows) {
    const count = Number(row.count)
    totalByBucket.set(row.bucket, (totalByBucket.get(row.bucket) ?? 0) + count)
    if (row.status === "APPROVED") {
      approvedByBucket.set(
        row.bucket,
        (approvedByBucket.get(row.bucket) ?? 0) + count
      )
    }
  }

  return { totalByBucket, approvedByBucket }
}

function trendBucketExpression(granularity: DashboardGranularity) {
  switch (granularity) {
    case "week":
      return Prisma.sql`to_char(date_trunc('week', "recordDate"::timestamp), 'YYYY-MM-DD')`
    case "month":
      return Prisma.sql`to_char(date_trunc('month', "recordDate"::timestamp), 'YYYY-MM')`
    case "year":
      return Prisma.sql`to_char(date_trunc('year', "recordDate"::timestamp), 'YYYY')`
    default:
      return Prisma.sql`to_char(date_trunc('day', "recordDate"::timestamp), 'YYYY-MM-DD')`
  }
}

function emptyDashboard(
  from: Date,
  to: Date,
  granularity: DashboardGranularity,
  settings: SystemSettings,
  generatedAt: Date
): DashboardData {
  return {
    range: {
      from: formatDateOnly(from),
      to: formatDateOnly(to),
      granularity,
    },
    kpis: {
      totalBranches: 0,
      activeBranches: 0,
      totalRecords: 0,
      submittedToday: 0,
      pendingApprovals: 0,
      approved: 0,
      rejected: 0,
      returned: 0,
      drafts: 0,
    },
    statusBreakdown: [],
    categoryBreakdown: [],
    branchSummaries: [],
    regionalSummaries: [],
    trend: enumerateBuckets(from, to, granularity).map((bucket) => ({
      bucket,
      count: 0,
      key: bucket,
      label: bucketLabel(bucket, granularity),
      total: 0,
      approved: 0,
    })),
    recentActivity: [],
    overdueBranches: [],
    settings,
    cards: {
      totalBranches: 0,
      activeBranches: 0,
      activeUsers: 0,
      thisMonth: 0,
      lastMonth: 0,
      trend: 0,
      pendingApprovals: 0,
      myDrafts: 0,
      overdueDrafts: 0,
      approvedThisMonth: 0,
      totalRecords: 0,
    },
    statusCounts: {},
    branchBreakdown: [],
    recentRecords: [],
    generatedAt,
  }
}

function emptyBranchTotals(): BranchTotals {
  return { total: 0, approved: 0, pending: 0, rejected: 0 }
}

function applyStatusCount(
  totals: BranchTotals,
  status: RecordStatusValue,
  count: number
) {
  totals.total += count
  if (status === "APPROVED") totals.approved += count
  if (status === "SUBMITTED") totals.pending += count
  if (status === "REJECTED") totals.rejected += count
}

function resolveGranularity(
  value: DashboardGranularity | undefined
): DashboardGranularity {
  if (value === "week" || value === "month" || value === "year") return value
  return "day"
}

function resolveStatus(value: string | undefined): RecordStatusValue | null {
  if (!value || value === "all") return null
  return (RECORD_STATUSES as readonly string[]).includes(value)
    ? (value as RecordStatusValue)
    : null
}

function resolveRange(fromValue?: string, toValue?: string) {
  const today = companyDateOnly(new Date())
  let to = parseIsoDate(toValue) ?? today
  let from = parseIsoDate(fromValue) ?? addDaysUtc(to, -(DEFAULT_RANGE_DAYS - 1))

  if (from.getTime() > to.getTime()) {
    const swap = from
    from = to
    to = swap
  }

  return { from, to }
}

function parseIsoDate(value: string | undefined): Date | null {
  if (!value) return null

  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim())
  if (!match) return null

  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  const date = new Date(Date.UTC(year, month - 1, day))

  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null
  }

  return date
}

function startOfDayUtc(value: Date): Date {
  return new Date(
    Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate())
  )
}

function addDaysUtc(value: Date, days: number): Date {
  return new Date(value.getTime() + days * DAY_MS)
}

function startOfWeekUtc(value: Date): Date {
  const date = startOfDayUtc(value)
  const offset = (date.getUTCDay() + 6) % 7
  return addDaysUtc(date, -offset)
}

function enumerateBuckets(
  from: Date,
  to: Date,
  granularity: DashboardGranularity
): string[] {
  // Buckets are business dates stored as UTC midnight, so UTC getters are the
  // correct calendar arithmetic here; only "now" is resolved in company time.
  const buckets: string[] = []
  let cursor: Date

  switch (granularity) {
    case "week":
      cursor = startOfWeekUtc(from)
      break
    case "month":
      cursor = new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), 1))
      break
    case "year":
      cursor = new Date(Date.UTC(from.getUTCFullYear(), 0, 1))
      break
    default:
      cursor = startOfDayUtc(from)
  }

  while (
    cursor.getTime() <= to.getTime() &&
    buckets.length < MAX_TREND_BUCKETS
  ) {
    switch (granularity) {
      case "week":
        buckets.push(formatDateOnly(cursor))
        cursor = addDaysUtc(cursor, 7)
        break
      case "month":
        buckets.push(
          `${cursor.getUTCFullYear()}-${String(cursor.getUTCMonth() + 1).padStart(
            2,
            "0"
          )}`
        )
        cursor = new Date(
          Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth() + 1, 1)
        )
        break
      case "year":
        buckets.push(String(cursor.getUTCFullYear()))
        cursor = new Date(Date.UTC(cursor.getUTCFullYear() + 1, 0, 1))
        break
      default:
        buckets.push(formatDateOnly(cursor))
        cursor = addDaysUtc(cursor, 1)
    }
  }

  return buckets
}

function bucketLabel(bucket: string, granularity: DashboardGranularity): string {
  if (granularity === "year") return bucket

  if (granularity === "month") {
    const [year, month] = bucket.split("-")
    const index = Number(month) - 1
    return `${MONTH_LABELS[index] ?? month} ${year.slice(2)}`
  }

  const date = new Date(`${bucket}T00:00:00.000Z`)
  if (Number.isNaN(date.getTime())) return bucket
  return `${MONTH_LABELS[date.getUTCMonth()]} ${date.getUTCDate()}`
}

function formatDateOnly(value: Date): string {
  return value.toISOString().slice(0, 10)
}

function cleanText(value: string | undefined, maxLength: number) {
  if (typeof value !== "string") return undefined
  const trimmed = value.trim()
  return trimmed ? trimmed.slice(0, maxLength) : undefined
}
