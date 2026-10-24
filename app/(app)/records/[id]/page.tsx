import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import {
  ArrowLeft,
  CalendarDays,
  CheckCircle2,
  ClipboardList,
  Clock3,
  History,
  MapPin,
  Paperclip,
  Pencil,
  Send,
  User,
  XCircle,
} from "lucide-react"

import {
  ArchiveRecordButton,
  RecordReviewDialog,
  RestoreRecordButton,
  SubmitRecordButton,
} from "@/components/records/record-actions"
import { RecordAttachments } from "@/components/records/record-attachments"
import { EmptyState } from "@/components/shared/empty-state"
import { PageHeader } from "@/components/shared/page-header"
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
import { Separator } from "@/components/ui/separator"
import {
  formatDate,
  formatDateTime,
  formatNumber,
  humanizeEnum,
} from "@/lib/format"
import { ApiError } from "@/lib/http"
import {
  canArchiveRecord,
  canEditRecord,
  canReviewRecord,
  canSubmitRecord,
} from "@/lib/permissions"
import { getRecord } from "@/lib/services/records"
import { requirePageScope } from "@/lib/session"
import { getSystemSettings } from "@/lib/settings"
import { cn } from "@/lib/utils"

export const metadata: Metadata = { title: "Record" }

type RecordValue = Awaited<ReturnType<typeof getRecord>>["values"][number]

function formatValue(value: RecordValue): string {
  const field = value.fieldDefinition

  switch (field.type) {
    case "TEXT":
    case "TEXTAREA":
    case "SELECT":
      return value.valueText?.trim() ? value.valueText : "—"
    case "NUMBER":
      return value.valueNumber !== null
        ? formatNumber(value.valueNumber.toNumber())
        : "—"
    case "DECIMAL":
      return value.valueNumber !== null
        ? formatNumber(value.valueNumber.toNumber(), {
            maximumFractionDigits: 4,
          })
        : "—"
    case "DATE":
      return formatDate(value.valueDate)
    case "BOOLEAN":
      return value.valueBoolean === null
        ? "—"
        : value.valueBoolean
          ? "Yes"
          : "No"
    default:
      return "—"
  }
}

const ACTION_TONE: Record<string, string> = {
  SUBMITTED: "bg-sky-500",
  RESUBMITTED: "bg-sky-500",
  APPROVED: "bg-primary",
  RETURNED: "bg-amber-500",
  REJECTED: "bg-destructive",
  ARCHIVED: "bg-muted-foreground/50",
  RESTORED: "bg-muted-foreground/50",
}

export default async function RecordDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const scope = await requirePageScope()
  const { id } = await params

  let record: Awaited<ReturnType<typeof getRecord>>
  try {
    record = await getRecord(scope, id)
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) notFound()
    throw error
  }

  const settings = await getSystemSettings()
  const review = canReviewRecord(scope, record, {
    allowSelfApproval: settings.allowSelfApproval,
  })

  const editable = canEditRecord(scope, record) && record.category.isActive
  const submittable = canSubmitRecord(scope, record)
  const archivable = canArchiveRecord(scope, record) && record.status !== "SUBMITTED"
  const restorable =
    record.status === "ARCHIVED" &&
    (scope.canManageBranches || scope.role === "BRANCH_MANAGER")

  const canUpload =
    record.status !== "ARCHIVED" && (editable || review.allowed)
  const canDelete = editable || review.allowed

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={record.title}
        description={`${record.recordNumber} · ${record.branch.name} (${record.branch.code}) · ${record.category.name}`}
        breadcrumbs={[
          { label: "Records", href: "/records" },
          { label: record.recordNumber },
        ]}
        actions={
          <>
            <Button variant="ghost" size="sm" render={<Link href="/records" />}>
              <ArrowLeft className="size-4" /> Back
            </Button>
            {editable ? (
              <Button
                variant="outline"
                size="sm"
                render={<Link href={`/records/${record.id}/edit`} />}
              >
                <Pencil className="size-4" /> Edit
              </Button>
            ) : null}
            {submittable ? <SubmitRecordButton recordId={record.id} /> : null}
            {review.allowed ? (
              <RecordReviewDialog
                recordId={record.id}
                recordNumber={record.recordNumber}
              />
            ) : null}
            {archivable ? <ArchiveRecordButton recordId={record.id} /> : null}
            {restorable ? <RestoreRecordButton recordId={record.id} /> : null}
          </>
        }
      />

      {record.status === "SUBMITTED" && !review.allowed && review.reason ? (
        <p className="border border-border bg-muted/30 px-4 py-3 text-sm text-muted-foreground">
          {review.reason}
        </p>
      ) : null}

      <section className="grid gap-4 lg:grid-cols-3">
        <div className="flex flex-col gap-4 lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Recorded values</CardTitle>
              <CardDescription>
                {record.category.name} · recorded on{" "}
                {formatDate(record.recordDate)}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {record.values.length === 0 ? (
                <EmptyState
                  icon={ClipboardList}
                  title="No values recorded"
                  description="This record has not captured any custom field values yet."
                  className="border-0 bg-transparent py-6"
                />
              ) : (
                <dl className="grid gap-x-6 gap-y-4 sm:grid-cols-2">
                  {record.values.map((value) => (
                    <div
                      key={value.id}
                      className="flex flex-col gap-1 border-b border-border/60 pb-3"
                    >
                      <dt className="text-[0.6875rem] font-semibold tracking-widest text-muted-foreground uppercase">
                        {value.fieldDefinition.label}
                      </dt>
                      <dd className="text-sm break-words whitespace-pre-wrap">
                        {formatValue(value)}
                      </dd>
                    </div>
                  ))}
                </dl>
              )}
            </CardContent>
          </Card>

          {record.remarks ? (
            <Card>
              <CardHeader>
                <CardTitle>Remarks</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm leading-relaxed whitespace-pre-wrap">
                  {record.remarks}
                </p>
              </CardContent>
            </Card>
          ) : null}

          <Card>
            <CardHeader>
              <CardTitle>Approval history</CardTitle>
              <CardDescription>
                Every submission and review decision in chronological order.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {record.approvals.length === 0 ? (
                <EmptyState
                  icon={History}
                  title="No workflow history"
                  description="Submitting this record will start the approval trail."
                  className="border-0 bg-transparent py-6"
                />
              ) : (
                <ol className="flex flex-col">
                  {record.approvals.map((entry, index) => (
                    <li key={entry.id} className="flex gap-3">
                      <div className="flex flex-col items-center">
                        <span
                          className={cn(
                            "mt-1.5 size-2 shrink-0 rounded-full",
                            ACTION_TONE[entry.action] ?? "bg-border"
                          )}
                        />
                        {index < record.approvals.length - 1 ? (
                          <span className="w-px flex-1 bg-border" />
                        ) : null}
                      </div>
                      <div className="min-w-0 flex-1 pb-5 last:pb-0">
                        <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                          <p className="text-sm font-medium">
                            {humanizeEnum(entry.action)}
                            {entry.fromStatus && entry.fromStatus !== entry.toStatus ? (
                              <span className="font-normal text-muted-foreground">
                                {" "}
                                · {humanizeEnum(entry.fromStatus)} →{" "}
                                {humanizeEnum(entry.toStatus)}
                              </span>
                            ) : null}
                          </p>
                          <time
                            dateTime={entry.createdAt.toISOString()}
                            className="text-xs text-muted-foreground"
                          >
                            {formatDateTime(entry.createdAt)}
                          </time>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {entry.actor.name} · {humanizeEnum(entry.actor.role)}
                        </p>
                        {entry.comment ? (
                          <p className="mt-2 border-l-2 border-border pl-3 text-sm whitespace-pre-wrap text-muted-foreground">
                            {entry.comment}
                          </p>
                        ) : null}
                      </div>
                    </li>
                  ))}
                </ol>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="flex flex-col gap-4">
          <Card>
            <CardHeader>
              <CardTitle>Status</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <StatusBadge status={record.status} className="w-fit" />

              <Separator />

              <dl className="flex flex-col gap-3 text-sm">
                <div className="flex items-start justify-between gap-3">
                  <dt className="flex items-center gap-1.5 text-muted-foreground">
                    <MapPin className="size-3.5" /> Branch
                  </dt>
                  <dd className="text-right font-medium">
                    <Link
                      href={`/branches/${record.branch.id}`}
                      className="underline-offset-4 hover:underline"
                    >
                      {record.branch.name}
                    </Link>
                    <span className="block font-mono text-[10px] tracking-wider text-muted-foreground uppercase">
                      {record.branch.region.name}
                    </span>
                  </dd>
                </div>
                <div className="flex items-start justify-between gap-3">
                  <dt className="flex items-center gap-1.5 text-muted-foreground">
                    <CalendarDays className="size-3.5" /> Record date
                  </dt>
                  <dd className="text-right font-medium">
                    {formatDate(record.recordDate)}
                  </dd>
                </div>
                <div className="flex items-start justify-between gap-3">
                  <dt className="flex items-center gap-1.5 text-muted-foreground">
                    <ClipboardList className="size-3.5" /> Category
                  </dt>
                  <dd className="text-right font-medium">
                    {record.category.name}
                  </dd>
                </div>
                <div className="flex items-start justify-between gap-3">
                  <dt className="flex items-center gap-1.5 text-muted-foreground">
                    <User className="size-3.5" /> Created by
                  </dt>
                  <dd className="text-right font-medium">
                    {record.createdBy.name}
                    <span className="block text-xs font-normal text-muted-foreground">
                      {formatDateTime(record.createdAt)}
                    </span>
                  </dd>
                </div>
                {record.referenceNumber ? (
                  <div className="flex items-start justify-between gap-3">
                    <dt className="text-muted-foreground">Reference</dt>
                    <dd className="text-right font-mono text-xs">
                      {record.referenceNumber}
                    </dd>
                  </div>
                ) : null}
                {record.submittedBy ? (
                  <div className="flex items-start justify-between gap-3">
                    <dt className="flex items-center gap-1.5 text-muted-foreground">
                      <Send className="size-3.5" /> Submitted
                    </dt>
                    <dd className="text-right font-medium">
                      {record.submittedBy.name}
                      <span className="block text-xs font-normal text-muted-foreground">
                        {formatDateTime(record.submittedAt)}
                      </span>
                    </dd>
                  </div>
                ) : null}
                {record.approvedBy ? (
                  <div className="flex items-start justify-between gap-3">
                    <dt className="flex items-center gap-1.5 text-muted-foreground">
                      <CheckCircle2 className="size-3.5" /> Approved
                    </dt>
                    <dd className="text-right font-medium">
                      {record.approvedBy.name}
                      <span className="block text-xs font-normal text-muted-foreground">
                        {formatDateTime(record.approvedAt)}
                      </span>
                    </dd>
                  </div>
                ) : null}
                {record.status === "REJECTED" ? (
                  <div className="flex items-start justify-between gap-3">
                    <dt className="flex items-center gap-1.5 text-destructive">
                      <XCircle className="size-3.5" /> Rejected
                    </dt>
                    <dd className="text-right font-medium">
                      {formatDateTime(record.updatedAt)}
                    </dd>
                  </div>
                ) : null}
                <div className="flex items-start justify-between gap-3">
                  <dt className="flex items-center gap-1.5 text-muted-foreground">
                    <Clock3 className="size-3.5" /> Last updated
                  </dt>
                  <dd className="text-right font-medium">
                    {formatDateTime(record.updatedAt)}
                    <span className="block text-xs font-normal text-muted-foreground">
                      by {record.updatedBy.name}
                    </span>
                  </dd>
                </div>
              </dl>

              <Separator />

              <div className="flex items-center justify-between gap-3 text-xs text-muted-foreground">
                <span>Attachments</span>
                <Badge variant="secondary">
                  <Paperclip className="size-3" />
                  {formatNumber(record.attachments.length)}
                </Badge>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Attachments</CardTitle>
              <CardDescription>
                Supporting documents stay private to authorised users.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <RecordAttachments
                recordId={record.id}
                attachments={record.attachments}
                canUpload={canUpload}
                canDelete={canDelete}
              />
            </CardContent>
          </Card>
        </div>
      </section>
    </div>
  )
}
