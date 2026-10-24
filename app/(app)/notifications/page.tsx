import type { Metadata } from "next"
import Link from "next/link"
import { Check, CheckCheck, Inbox } from "lucide-react"

import { PageHeader } from "@/components/shared/page-header"
import { EmptyState } from "@/components/shared/empty-state"
import { Button } from "@/components/ui/button"
import { prisma } from "@/lib/db"
import { formatDateTime } from "@/lib/format"
import { requirePageUser } from "@/lib/session"
import { cn } from "@/lib/utils"
import {
  markAllNotificationsRead,
  markNotificationRead,
  markNotificationUnread,
} from "./actions"

export const metadata: Metadata = { title: "Notifications" }

const PAGE_SIZE = 20

function buildHref(filter: string, page: number) {
  const params = new URLSearchParams()
  if (filter !== "all") params.set("filter", filter)
  if (page > 1) params.set("page", String(page))
  const query = params.toString()
  return query ? `/notifications?${query}` : "/notifications"
}

const TYPE_LABEL: Record<string, string> = {
  RECORD_SUBMITTED: "Submission",
  RECORD_APPROVED: "Approved",
  RECORD_REJECTED: "Rejected",
  RECORD_RETURNED: "Returned",
  USER_ASSIGNED: "Assignment",
  SYSTEM: "System",
}

export default async function NotificationsPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string; page?: string }>
}) {
  const user = await requirePageUser()
  const params = await searchParams
  const filter = params.filter === "unread" ? "unread" : "all"
  const page = Math.max(1, Number(params.page ?? "1") || 1)

  const where = {
    userId: user.id,
    ...(filter === "unread" ? { readAt: null } : {}),
  }

  const [items, total, unreadCount] = await prisma.$transaction([
    prisma.notification.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    prisma.notification.count({ where }),
    prisma.notification.count({ where: { userId: user.id, readAt: null } }),
  ])

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Notifications"
        description="Approval activity, returned submissions and assignments relevant to your account."
        actions={
          <form action={markAllNotificationsRead}>
            <Button
              type="submit"
              variant="outline"
              size="sm"
              disabled={unreadCount === 0}
            >
              <CheckCheck className="size-4" />
              Mark all read
            </Button>
          </form>
        }
      />

      <div className="flex items-center gap-1 border-b">
        {[
          { key: "all", label: "All" },
          { key: "unread", label: `Unread${unreadCount ? ` (${unreadCount})` : ""}` },
        ].map((tab) => (
          <Link
            key={tab.key}
            href={buildHref(tab.key, 1)}
            className={cn(
              "-mb-px border-b-2 px-4 py-2.5 text-[11px] font-semibold tracking-wider uppercase transition-colors",
              filter === tab.key
                ? "border-primary text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            {tab.label}
          </Link>
        ))}
      </div>

      {items.length === 0 ? (
        <EmptyState
          icon={Inbox}
          title={filter === "unread" ? "You're all caught up" : "No notifications yet"}
          description={
            filter === "unread"
              ? "There are no unread notifications on your account."
              : "Notifications about submissions, approvals and assignments will appear here."
          }
        />
      ) : (
        <ul className="divide-y border bg-background">
          {items.map((item) => (
            <li
              key={item.id}
              className={cn(
                "flex flex-col gap-3 p-4 sm:flex-row sm:items-start sm:justify-between",
                !item.readAt && "bg-primary/[0.035]"
              )}
            >
              <div className="flex min-w-0 gap-3">
                <span
                  className={cn(
                    "mt-1.5 size-1.5 shrink-0 rounded-full",
                    item.readAt ? "bg-border" : "bg-primary"
                  )}
                  aria-hidden
                />
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[10px] font-semibold tracking-widest text-muted-foreground uppercase">
                      {TYPE_LABEL[item.type] ?? item.type}
                    </span>
                    {!item.readAt && (
                      <span className="text-[10px] font-semibold tracking-wider text-primary uppercase">
                        New
                      </span>
                    )}
                  </div>
                  <p className="mt-1 text-sm font-semibold">{item.title}</p>
                  <p className="mt-0.5 text-sm text-muted-foreground">
                    {item.message}
                  </p>
                  <p className="mt-1.5 font-mono text-[10px] text-muted-foreground">
                    {formatDateTime(item.createdAt)} IST
                  </p>
                </div>
              </div>

              <div className="flex shrink-0 items-center gap-1.5 pl-4 sm:pl-0">
                {item.link && (
                  <Button
                    variant="outline"
                    size="xs"
                    render={<Link href={item.link} />}
                  >
                    Open
                  </Button>
                )}
                <form
                  action={
                    item.readAt
                      ? markNotificationUnread
                      : markNotificationRead
                  }
                >
                  <input type="hidden" name="id" value={item.id} />
                  <Button
                    type="submit"
                    variant="ghost"
                    size="icon-xs"
                    aria-label={item.readAt ? "Mark as unread" : "Mark as read"}
                    title={item.readAt ? "Mark as unread" : "Mark as read"}
                  >
                    {item.readAt ? (
                      <Inbox className="size-3.5" />
                    ) : (
                      <Check className="size-3.5" />
                    )}
                  </Button>
                </form>
              </div>
            </li>
          ))}
        </ul>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>
            Page {page} of {totalPages} · {total} notifications
          </span>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="xs"
              disabled={page <= 1}
              render={page > 1 ? <Link href={buildHref(filter, page - 1)} /> : undefined}
            >
              Previous
            </Button>
            <Button
              variant="outline"
              size="xs"
              disabled={page >= totalPages}
              render={
                page < totalPages ? <Link href={buildHref(filter, page + 1)} /> : undefined
              }
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
