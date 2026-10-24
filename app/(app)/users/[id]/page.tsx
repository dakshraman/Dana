import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { ArrowLeft, Mail, Pencil } from "lucide-react"

import { PageHeader } from "@/components/shared/page-header"
import { EmptyState } from "@/components/shared/empty-state"
import { UserStatusButton } from "@/components/users/user-status-button"
import { Badge } from "@/components/ui/badge"
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
import { formatDate, formatDateTime, initials } from "@/lib/format"
import { ApiError } from "@/lib/http"
import { ROLE_LABELS } from "@/lib/permissions"
import { getUser } from "@/lib/services/users"
import { requirePageScope } from "@/lib/session"

export const metadata: Metadata = { title: "User details" }

export default async function UserDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const scope = await requirePageScope()
  const { id } = await params

  let user: Awaited<ReturnType<typeof getUser>>
  try {
    user = await getUser(scope, id)
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) notFound()
    throw error
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={user.name}
        description={`${ROLE_LABELS[user.role]} · ${user.email}`}
        breadcrumbs={[
          { label: "Users", href: "/users" },
          { label: user.name },
        ]}
        actions={
          <>
            <Button variant="outline" size="sm" render={<Link href="/users" />}>
              <ArrowLeft className="size-4" /> Back
            </Button>
            {scope.canManageUsers ? (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  render={<Link href={`/users/${user.id}/edit`} />}
                >
                  <Pencil className="size-4" /> Edit
                </Button>
                {scope.userId !== user.id ? (
                  <UserStatusButton
                    userId={user.id}
                    userName={user.name}
                    isActive={user.isActive}
                  />
                ) : null}
              </>
            ) : null}
          </>
        }
      />

      <section className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Profile</CardTitle>
            <CardDescription>
              Account details and current access state.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-5 text-sm">
            <div className="flex items-center gap-3">
              <div className="grid size-12 shrink-0 place-items-center border bg-muted font-heading text-sm font-semibold tracking-wider">
                {initials(user.name)}
              </div>
              <div className="min-w-0">
                <p className="font-heading text-lg font-semibold tracking-wider uppercase">
                  {user.name}
                </p>
                <a
                  href={`mailto:${user.email}`}
                  className="flex items-center gap-1.5 text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
                >
                  <Mail className="size-3.5 shrink-0" aria-hidden="true" />
                  <span className="truncate">{user.email}</span>
                </a>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 border-t pt-3">
              <Badge variant="outline">{ROLE_LABELS[user.role]}</Badge>
              <Badge variant={user.isActive ? "default" : "secondary"}>
                {user.isActive ? "Active" : "Inactive"}
              </Badge>
              {scope.userId === user.id ? (
                <span className="text-xs text-muted-foreground">This is you</span>
              ) : null}
            </div>

            <dl className="grid grid-cols-2 gap-3 border-t pt-3 text-xs">
              <div>
                <dt className="tracking-wider text-muted-foreground uppercase">
                  Last login
                </dt>
                <dd className="mt-0.5 font-medium">
                  {formatDateTime(user.lastLoginAt, { fallback: "Never" })}
                </dd>
              </div>
              <div>
                <dt className="tracking-wider text-muted-foreground uppercase">
                  Created
                </dt>
                <dd className="mt-0.5 font-medium">
                  {formatDate(user.createdAt)}
                </dd>
              </div>
              <div>
                <dt className="tracking-wider text-muted-foreground uppercase">
                  Last updated
                </dt>
                <dd className="mt-0.5 font-medium">
                  {formatDate(user.updatedAt)}
                </dd>
              </div>
            </dl>
          </CardContent>
        </Card>

        <div className="flex flex-col gap-4 lg:col-span-2">
          <Card>
            <CardHeader className="flex flex-row items-start justify-between gap-4">
              <div>
                <CardTitle>Branch assignments</CardTitle>
                <CardDescription>
                  Operational branches this account can access.
                </CardDescription>
              </div>
              <span className="font-mono text-xs tabular-nums text-muted-foreground">
                {user.branchAssignments.length}
              </span>
            </CardHeader>
            <CardContent className="px-0">
              {user.branchAssignments.length === 0 ? (
                <EmptyState
                  title="No branch assignments"
                  description="This account is not assigned to an operational branch."
                  className="mx-4 border-0 bg-transparent"
                />
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Branch</TableHead>
                      <TableHead>Location</TableHead>
                      <TableHead>Primary</TableHead>
                      <TableHead>Job title</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {user.branchAssignments.map((assignment) => (
                      <TableRow key={assignment.id}>
                        <TableCell>
                          <Link
                            href={`/branches/${assignment.branch.id}`}
                            className="font-medium underline-offset-4 hover:underline"
                          >
                            {assignment.branch.name}
                          </Link>
                          <p className="font-mono text-[10px] tracking-wider text-muted-foreground uppercase">
                            {assignment.branch.code}
                            {!assignment.branch.isActive ? " · Inactive" : ""}
                          </p>
                        </TableCell>
                        <TableCell className="text-sm">
                          {assignment.branch.city}
                          <p className="text-xs text-muted-foreground">
                            {assignment.branch.state}, {assignment.branch.country}
                          </p>
                        </TableCell>
                        <TableCell>
                          {assignment.isPrimary ? (
                            <Badge variant="default">Primary</Badge>
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell className="text-sm">
                          {assignment.jobTitle ?? (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-start justify-between gap-4">
              <div>
                <CardTitle>Region assignments</CardTitle>
                <CardDescription>
                  Regions this account can review and operate within.
                </CardDescription>
              </div>
              <span className="font-mono text-xs tabular-nums text-muted-foreground">
                {user.regionAssignments.length}
              </span>
            </CardHeader>
            <CardContent className="px-0">
              {user.regionAssignments.length === 0 ? (
                <EmptyState
                  title="No region assignments"
                  description="This account is not assigned to a region."
                  className="mx-4 border-0 bg-transparent"
                />
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Region</TableHead>
                      <TableHead>Code</TableHead>
                      <TableHead>Assigned</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {user.regionAssignments.map((assignment) => (
                      <TableRow key={assignment.id}>
                        <TableCell className="font-medium">
                          {assignment.region.name}
                        </TableCell>
                        <TableCell className="font-mono text-[10px] tracking-wider text-muted-foreground uppercase">
                          {assignment.region.code}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {formatDate(assignment.createdAt)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </div>
      </section>
    </div>
  )
}
