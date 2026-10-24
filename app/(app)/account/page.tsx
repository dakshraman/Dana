import type { Metadata } from "next"
import Link from "next/link"
import {
  Building2,
  CalendarDays,
  KeyRound,
  Mail,
  ShieldCheck,
  UserRound,
} from "lucide-react"

import { PasswordForm } from "@/components/account/password-form"
import { ProfileForm } from "@/components/account/profile-form"
import { PageHeader } from "@/components/shared/page-header"
import { RoleBadge } from "@/components/shared/role-badge"
import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { formatDate, formatDateTime } from "@/lib/format"
import { getUser } from "@/lib/services/users"
import { requirePageScope, requirePageUser } from "@/lib/session"

export const metadata: Metadata = { title: "Account" }

export default async function AccountPage() {
  const sessionUser = await requirePageUser()
  const scope = await requirePageScope()
  const user = await getUser(scope, sessionUser.id)

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Account"
        description="Manage your profile details and password. Changes apply immediately to your session."
        breadcrumbs={[{ label: "Account" }]}
      />

      <section className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Identity</CardTitle>
            <CardDescription>
              Your account information and access level.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4 text-sm">
            <div className="flex items-center gap-3">
              <div className="flex size-11 shrink-0 items-center justify-center border border-border bg-muted/30">
                <UserRound className="size-5 text-muted-foreground" />
              </div>
              <div className="min-w-0">
                <p className="truncate font-medium">{user.name}</p>
                <p className="flex items-center gap-1 truncate text-xs text-muted-foreground">
                  <Mail className="size-3" /> {user.email}
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <RoleBadge role={user.role} />
              <Badge variant={user.isActive ? "default" : "secondary"}>
                {user.isActive ? "Active" : "Inactive"}
              </Badge>
            </div>

            <dl className="flex flex-col gap-3 border-t pt-4 text-xs">
              <div className="flex items-center justify-between gap-3">
                <dt className="flex items-center gap-1.5 text-muted-foreground">
                  <CalendarDays className="size-3.5" /> Member since
                </dt>
                <dd>{formatDate(user.createdAt)}</dd>
              </div>
              <div className="flex items-center justify-between gap-3">
                <dt className="flex items-center gap-1.5 text-muted-foreground">
                  <ShieldCheck className="size-3.5" /> Last sign-in
                </dt>
                <dd>
                  {user.lastLoginAt
                    ? formatDateTime(user.lastLoginAt)
                    : "First session"}
                </dd>
              </div>
            </dl>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Assignments</CardTitle>
            <CardDescription>
              Branches and regions attached to your account determine what you
              can see.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-5">
            <div className="flex flex-col gap-2">
              <p className="text-[0.6875rem] font-semibold tracking-widest text-muted-foreground uppercase">
                Branches
              </p>
              {user.branchAssignments.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No direct branch assignment. Regional access covers branches
                  in your regions.
                </p>
              ) : (
                <ul className="flex flex-wrap gap-2">
                  {user.branchAssignments.map((assignment) => (
                    <li key={assignment.id}>
                      <Link href={`/branches/${assignment.branch.id}`}>
                        <Badge variant="outline" className="gap-1.5">
                          <Building2 className="size-3" />
                          {assignment.branch.name} ({assignment.branch.code})
                        </Badge>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="flex flex-col gap-2 border-t pt-4">
              <p className="text-[0.6875rem] font-semibold tracking-widest text-muted-foreground uppercase">
                Regions
              </p>
              {user.regionAssignments.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No regional assignment.
                </p>
              ) : (
                <ul className="flex flex-wrap gap-2">
                  {user.regionAssignments.map((assignment) => (
                    <li key={assignment.id}>
                      <Badge variant="outline">
                        {assignment.region.name} ({assignment.region.code})
                      </Badge>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {user.managedBranches.length > 0 ? (
              <div className="flex flex-col gap-2 border-t pt-4">
                <p className="text-[0.6875rem] font-semibold tracking-widest text-muted-foreground uppercase">
                  Managed branches
                </p>
                <ul className="flex flex-wrap gap-2">
                  {user.managedBranches.map((branch) => (
                    <li key={branch.id}>
                      <Link href={`/branches/${branch.id}`}>
                        <Badge variant="outline">
                          {branch.name} ({branch.code})
                        </Badge>
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Profile</CardTitle>
            <CardDescription>
              This name appears on records, approvals and audit entries.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ProfileForm name={user.name} />
          </CardContent>
        </Card>

        <Card id="security" className="scroll-mt-24">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <KeyRound className="size-4" /> Password
            </CardTitle>
            <CardDescription>
              Changing your password signs out other devices at their next
              request.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <PasswordForm />
          </CardContent>
        </Card>
      </section>
    </div>
  )
}
