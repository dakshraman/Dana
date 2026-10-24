import type { Metadata } from "next"
import Link from "next/link"
import { Building2, Plus } from "lucide-react"

import { PageHeader } from "@/components/shared/page-header"
import { Pagination } from "@/components/shared/pagination"
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
import { formatDate, formatNumber } from "@/lib/format"
import { getRegionOptions, listBranches } from "@/lib/services/branches"
import { requirePageScope } from "@/lib/session"
import { branchQuerySchema } from "@/lib/validations/branch"

export const metadata: Metadata = { title: "Branches" }

type SearchParams = Promise<Record<string, string | string[] | undefined>>

function toRecord(params: Record<string, string | string[] | undefined>) {
  const output: Record<string, string> = {}
  for (const [key, value] of Object.entries(params)) {
    const first = Array.isArray(value) ? value[0] : value
    if (first) output[key] = first
  }
  return output
}

export default async function BranchesPage({
  searchParams,
}: {
  searchParams: SearchParams
}) {
  const scope = await requirePageScope()
  const raw = toRecord(await searchParams)
  const parsed = branchQuerySchema.safeParse(raw)
  const query = parsed.success
    ? parsed.data
    : branchQuerySchema.parse({})

  const [result, regions] = await Promise.all([
    listBranches(scope, query),
    getRegionOptions(scope),
  ])

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Branches"
        description="Operating locations available to your account. Branch access is enforced on every query."
        actions={
          scope.canManageBranches ? (
            <Button size="sm" render={<Link href="/branches/new" />}>
              <Plus className="size-4" /> New branch
            </Button>
          ) : null
        }
      />

      <form
        method="get"
        className="grid gap-4 border bg-card p-4 sm:grid-cols-2 lg:grid-cols-5"
      >
        <div className="flex flex-col gap-1">
          <label htmlFor="q" className="text-[10px] font-semibold tracking-widest text-muted-foreground uppercase">
            Search
          </label>
          <input
            id="q"
            name="q"
            defaultValue={query.q}
            placeholder="Name, code or city"
            className="h-9 border-b border-input bg-transparent text-sm outline-none placeholder:text-muted-foreground focus-visible:border-b-ring"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="regionId" className="text-[10px] font-semibold tracking-widest text-muted-foreground uppercase">
            Region
          </label>
          <select
            id="regionId"
            name="regionId"
            defaultValue={query.regionId ?? ""}
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
          <label htmlFor="status" className="text-[10px] font-semibold tracking-widest text-muted-foreground uppercase">
            Status
          </label>
          <select
            id="status"
            name="status"
            defaultValue={query.status}
            className="h-9 border-b border-input bg-transparent text-sm outline-none focus-visible:border-b-ring"
          >
            <option value="all">All</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="sort" className="text-[10px] font-semibold tracking-widest text-muted-foreground uppercase">
            Sort by
          </label>
          <select
            id="sort"
            name="sort"
            defaultValue={query.sort}
            className="h-9 border-b border-input bg-transparent text-sm outline-none focus-visible:border-b-ring"
          >
            <option value="name">Name</option>
            <option value="code">Code</option>
            <option value="country">Country</option>
            <option value="createdAt">Created</option>
          </select>
        </div>
        <div className="flex items-end gap-2">
          <Button type="submit" size="sm">
            Filter
          </Button>
          <Button variant="ghost" size="sm" render={<Link href="/branches" />}>
            Reset
          </Button>
        </div>
      </form>

      <TableShell
        isEmpty={result.items.length === 0}
        emptyTitle="No branches found"
        emptyDescription="Try a different search or region, or create a new branch."
        footer={
          <Pagination
            page={result.page}
            totalPages={result.totalPages}
            total={result.total}
            basePath="/branches"
            searchParams={raw}
          />
        }
      >
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Branch</TableHead>
              <TableHead>Region</TableHead>
              <TableHead>Location</TableHead>
              <TableHead>Manager</TableHead>
              <TableHead className="text-right">Records</TableHead>
              <TableHead className="text-right">Pending</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Created</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {result.items.map((branch) => (
              <TableRow key={branch.id}>
                <TableCell>
                  <Link
                    href={`/branches/${branch.id}`}
                    className="font-medium underline-offset-4 hover:underline"
                  >
                    {branch.name}
                  </Link>
                  <p className="font-mono text-[10px] tracking-wider text-muted-foreground uppercase">
                    {branch.code}
                  </p>
                </TableCell>
                <TableCell className="text-sm">{branch.region.name}</TableCell>
                <TableCell className="text-sm">
                  {branch.city}
                  <p className="text-xs text-muted-foreground">{branch.country}</p>
                </TableCell>
                <TableCell className="text-sm">
                  {branch.manager?.name ?? (
                    <span className="text-muted-foreground">Unassigned</span>
                  )}
                </TableCell>
                <TableCell className="text-right font-mono text-xs">
                  {formatNumber(branch.recordCount)}
                </TableCell>
                <TableCell className="text-right font-mono text-xs">
                  {formatNumber(branch.pendingCount)}
                </TableCell>
                <TableCell>
                  <Badge variant={branch.isActive ? "default" : "secondary"}>
                    {branch.isActive ? "Active" : "Inactive"}
                  </Badge>
                </TableCell>
                <TableCell className="text-xs text-muted-foreground">
                  {formatDate(branch.createdAt)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableShell>

      {result.items.length === 0 && !result.total ? (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Building2 className="size-4" />
          Branches outside your access scope are never returned.
        </div>
      ) : null}
    </div>
  )
}
