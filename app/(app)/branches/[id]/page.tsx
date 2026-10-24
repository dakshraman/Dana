import type { Metadata } from "next"
import Link from "next/link"
import { notFound, redirect } from "next/navigation"
import { ArrowLeft, Mail, MapPin, Pencil, Phone } from "lucide-react"

import { BranchStatusButton } from "@/components/branches/branch-status-button"
import { PageHeader } from "@/components/shared/page-header"
import { EmptyState } from "@/components/shared/empty-state"
import { StatCard } from "@/components/shared/stat-card"
import { StatusBadge } from "@/components/shared/status-badge"
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
import { formatDate, formatNumber } from "@/lib/format"
import { ApiError } from "@/lib/http"
import { getBranch } from "@/lib/services/branches"
import { requirePageScope } from "@/lib/session"

export const metadata: Metadata = { title: "Branch details" }

export default async function BranchDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const scope = await requirePageScope()
  const { id } = await params

  let result: Awaited<ReturnType<typeof getBranch>>
  try {
    result = await getBranch(scope, id)
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) notFound()
    throw error
  }

  const { branch, statusCounts, recentRecords, totalRecords } = result
  if (!branch) notFound()
  if (!branch.isActive && !scope.canManageBranches) redirect("/branches")

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={branch.name}
        description={`${branch.city}, ${branch.state}, ${branch.country} · ${branch.code}`}
        breadcrumbs={[
          { label: "Branches", href: "/branches" },
          { label: branch.name },
        ]}
        actions={
          <>
            <Button variant="outline" size="sm" render={<Link href="/branches" />}>
              <ArrowLeft className="size-4" /> Back
            </Button>
            {scope.canManageBranches ? (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  render={<Link href={`/branches/${branch.id}/edit`} />}
                >
                  <Pencil className="size-4" /> Edit
                </Button>
                <BranchStatusButton
                  branchId={branch.id}
                  branchName={branch.name}
                  isActive={branch.isActive}
                />
              </>
            ) : null}
          </>
        }
      />

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Total records"
          value={formatNumber(totalRecords)}
          icon={Pencil}
        />
        <StatCard
          label="Pending review"
          value={formatNumber(statusCounts.SUBMITTED ?? 0)}
          tone="warning"
        />
        <StatCard
          label="Approved"
          value={formatNumber(statusCounts.APPROVED ?? 0)}
          tone="positive"
        />
        <StatCard
          label="Rejected / returned"
          value={formatNumber(
            (statusCounts.REJECTED ?? 0) + (statusCounts.RETURNED ?? 0)
          )}
          tone="danger"
        />
      </section>

      <section className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Branch profile</CardTitle>
            <CardDescription>Contact and organisational details.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4 text-sm">
            <div className="flex items-start gap-2">
              <MapPin className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
              <div>
                <p>{branch.address}</p>
                <p className="text-muted-foreground">
                  {branch.city}, {branch.state}
                  <br />
                  {branch.country}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Mail className="size-4 text-muted-foreground" />
              <a href={`mailto:${branch.email}`} className="underline-offset-4 hover:underline">
                {branch.email}
              </a>
            </div>
            <div className="flex items-center gap-2">
              <Phone className="size-4 text-muted-foreground" />
              <span>{branch.phone}</span>
            </div>
            <div className="flex flex-wrap items-center gap-2 border-t pt-3">
              <Badge variant={branch.isActive ? "default" : "secondary"}>
                {branch.isActive ? "Active" : "Inactive"}
              </Badge>
              <span className="text-xs text-muted-foreground">
                Created {formatDate(branch.createdAt)}
              </span>
            </div>
            <dl className="grid grid-cols-2 gap-3 border-t pt-3 text-xs">
              <div>
                <dt className="tracking-wider text-muted-foreground uppercase">Region</dt>
                <dd className="mt-0.5 font-medium">{branch.region.name}</dd>
              </div>
              <div>
                <dt className="tracking-wider text-muted-foreground uppercase">Manager</dt>
                <dd className="mt-0.5 font-medium">
                  {branch.manager?.name ?? "Unassigned"}
                </dd>
              </div>
            </dl>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Assigned staff</CardTitle>
            <CardDescription>
              People with an operational assignment to this branch.
            </CardDescription>
          </CardHeader>
          <CardContent className="px-0">
            {branch.assignments.length === 0 ? (
              <EmptyState
                title="No staff assigned"
                description="Assign users to this branch from the users administration page."
                className="mx-4 border-0 bg-transparent"
              />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Primary</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {branch.assignments.map((assignment) => (
                    <TableRow key={assignment.id}>
                      <TableCell>
                        <Link
                          href={`/users/${assignment.user.id}`}
                          className="font-medium underline-offset-4 hover:underline"
                        >
                          {assignment.user.name}
                        </Link>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {assignment.user.email}
                      </TableCell>
                      <TableCell className="text-xs">
                        {assignment.user.role.replaceAll("_", " ")}
                      </TableCell>
                      <TableCell className="text-xs">
                        {assignment.isPrimary ? "Yes" : "—"}
                      </TableCell>
                      <TableCell>
                        <Badge variant={assignment.user.isActive ? "default" : "secondary"}>
                          {assignment.user.isActive ? "Active" : "Inactive"}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </section>

      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-4">
          <div>
            <CardTitle>Recent records</CardTitle>
            <CardDescription>The latest ten records for this branch.</CardDescription>
          </div>
          <Button variant="ghost" size="xs" render={<Link href={`/records?branchId=${branch.id}`} />}>
            View all
          </Button>
        </CardHeader>
        <CardContent className="px-0">
          {recentRecords.length === 0 ? (
            <EmptyState
              title="No records yet"
              description="This branch has no operations records."
              className="mx-4 border-0 bg-transparent"
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Record</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Created by</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recentRecords.map((record) => (
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
                    <TableCell className="text-sm">{record.category.name}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {formatDate(record.recordDate)}
                    </TableCell>
                    <TableCell className="text-sm">{record.createdBy.name}</TableCell>
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
    </div>
  )
}
