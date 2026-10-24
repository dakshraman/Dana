import type { Metadata } from "next"
import Link from "next/link"
import { redirect } from "next/navigation"
import { Plus } from "lucide-react"

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
import { formatDate, formatDateTime } from "@/lib/format"
import { ROLE_LABELS, ROLES } from "@/lib/permissions"
import { getBranchOptions } from "@/lib/services/branches"
import { listUsers } from "@/lib/services/users"
import { requirePageScope } from "@/lib/session"
import { userQuerySchema } from "@/lib/validations/user"

export const metadata: Metadata = { title: "Users" }

type SearchParams = Promise<Record<string, string | string[] | undefined>>

function toRecord(params: Record<string, string | string[] | undefined>) {
  const output: Record<string, string> = {}
  for (const [key, value] of Object.entries(params)) {
    const first = Array.isArray(value) ? value[0] : value
    if (first) output[key] = first
  }
  return output
}

function AssignmentCodes({
  items,
}: {
  items: { id: string; code: string; name: string }[]
}) {
  if (items.length === 0) {
    return <span className="text-xs text-muted-foreground">—</span>
  }

  const visible = items.slice(0, 2)

  return (
    <div className="flex flex-wrap items-center gap-1">
      {visible.map((item) => (
        <Badge key={item.id} variant="secondary" title={item.name}>
          {item.code}
        </Badge>
      ))}
      {items.length > visible.length ? (
        <span className="text-[10px] text-muted-foreground">
          +{items.length - visible.length}
        </span>
      ) : null}
    </div>
  )
}

export default async function UsersPage({
  searchParams,
}: {
  searchParams: SearchParams
}) {
  const scope = await requirePageScope()
  if (!scope.canManageUsers) redirect("/dashboard")

  const raw = toRecord(await searchParams)
  const parsed = userQuerySchema.safeParse(raw)
  const query = parsed.success ? parsed.data : userQuerySchema.parse({})

  const [result, branches] = await Promise.all([
    listUsers(scope, query),
    getBranchOptions(scope),
  ])

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Users"
        description="Accounts, roles and access assignments. Permissions and data scope are enforced on every request."
        actions={
          <Button size="sm" render={<Link href="/users/new" />}>
            <Plus className="size-4" /> New user
          </Button>
        }
      />

      <form
        method="get"
        className="grid gap-4 border bg-card p-4 sm:grid-cols-2 lg:grid-cols-5"
      >
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
            placeholder="Name or email"
            className="h-9 border-b border-input bg-transparent text-sm outline-none placeholder:text-muted-foreground focus-visible:border-b-ring"
          />
        </div>

        <div className="flex flex-col gap-1">
          <label
            htmlFor="role"
            className="text-[10px] font-semibold tracking-widest text-muted-foreground uppercase"
          >
            Role
          </label>
          <select
            id="role"
            name="role"
            defaultValue={query.role}
            className="h-9 border-b border-input bg-transparent text-sm outline-none focus-visible:border-b-ring"
          >
            <option value="all">All roles</option>
            {ROLES.map((role) => (
              <option key={role} value={role}>
                {ROLE_LABELS[role]}
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
            <option value="all">All</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
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
            {branches.map((branch) => (
              <option key={branch.id} value={branch.id}>
                {branch.code} — {branch.name}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-end gap-2">
          <Button type="submit" size="sm">
            Filter
          </Button>
          <Button variant="ghost" size="sm" render={<Link href="/users" />}>
            Reset
          </Button>
        </div>
      </form>

      <TableShell
        isEmpty={result.items.length === 0}
        emptyTitle="No users found"
        emptyDescription="Try a different search, role or branch, or create a new user."
        footer={
          <Pagination
            page={result.page}
            totalPages={result.totalPages}
            total={result.total}
            basePath="/users"
            searchParams={raw}
          />
        }
      >
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>User</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Branches</TableHead>
              <TableHead>Regions</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Last login</TableHead>
              <TableHead>Created</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {result.items.map((user) => (
              <TableRow key={user.id}>
                <TableCell>
                  <Link
                    href={`/users/${user.id}`}
                    className="font-medium underline-offset-4 hover:underline"
                  >
                    {user.name}
                  </Link>
                  <p className="text-xs text-muted-foreground">{user.email}</p>
                </TableCell>
                <TableCell className="text-sm">
                  {ROLE_LABELS[user.role]}
                </TableCell>
                <TableCell>
                  <AssignmentCodes
                    items={user.branchAssignments.map(
                      (assignment) => assignment.branch
                    )}
                  />
                </TableCell>
                <TableCell>
                  <AssignmentCodes
                    items={user.regionAssignments.map(
                      (assignment) => assignment.region
                    )}
                  />
                </TableCell>
                <TableCell>
                  <Badge variant={user.isActive ? "default" : "secondary"}>
                    {user.isActive ? "Active" : "Inactive"}
                  </Badge>
                </TableCell>
                <TableCell className="text-xs text-muted-foreground">
                  {formatDateTime(user.lastLoginAt, { fallback: "Never" })}
                </TableCell>
                <TableCell className="text-xs text-muted-foreground">
                  {formatDate(user.createdAt)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableShell>
    </div>
  )
}
