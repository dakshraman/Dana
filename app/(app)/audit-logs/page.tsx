import type { Metadata } from "next"
import Link from "next/link"
import { redirect } from "next/navigation"
import { ScrollText } from "lucide-react"

import { PageHeader } from "@/components/shared/page-header"
import { EmptyState } from "@/components/shared/empty-state"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { prisma } from "@/lib/db"
import type { AuditAction } from "@/lib/generated/prisma/enums"
import { formatDateTime } from "@/lib/format"
import { requirePageScope } from "@/lib/session"

export const metadata: Metadata = { title: "Audit logs" }

const PAGE_SIZE = 25

const ACTIONS = [
  "CREATE",
  "UPDATE",
  "DELETE",
  "DEACTIVATE",
  "ACTIVATE",
  "LOGIN",
  "LOGIN_FAILED",
  "LOGOUT",
  "SUBMIT",
  "APPROVE",
  "REJECT",
  "RETURN",
  "ARCHIVE",
  "RESTORE",
  "EXPORT",
  "SETTINGS_CHANGE",
] as const

function buildHref(params: Record<string, string | undefined>, page: number) {
  const query = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value) query.set(key, value)
  }
  if (page > 1) query.set("page", String(page))
  const string = query.toString()
  return string ? `/audit-logs?${string}` : "/audit-logs"
}

function toneForAction(action: string) {
  if (action.includes("FAILED") || action === "DELETE" || action === "REJECT") {
    return "text-destructive"
  }
  if (action === "APPROVE" || action === "ACTIVATE") return "text-primary"
  if (action === "SUBMIT" || action === "CREATE") return "text-primary"
  return "text-muted-foreground"
}

export default async function AuditLogsPage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string
    action?: string
    entityType?: string
    from?: string
    to?: string
    page?: string
  }>
}) {
  const scope = await requirePageScope()
  if (!scope.canViewAuditLogs) redirect("/dashboard")

  const params = await searchParams
  const page = Math.max(1, Number(params.page ?? "1") || 1)
  const q = params.q?.trim()
  const action = ACTIONS.includes(params.action as AuditAction)
    ? (params.action as AuditAction)
    : undefined
  const entityType = params.entityType?.trim()

  const where = {
    ...(action ? { action } : {}),
    ...(entityType ? { entityType } : {}),
    ...(q
      ? {
          OR: [
            { summary: { contains: q, mode: "insensitive" as const } },
            { entityId: { contains: q, mode: "insensitive" as const } },
            { actor: { name: { contains: q, mode: "insensitive" as const } } },
            { actor: { email: { contains: q, mode: "insensitive" as const } } },
          ],
        }
      : {}),
    ...(params.from || params.to
      ? {
          createdAt: {
            ...(params.from
              ? { gte: new Date(`${params.from}T00:00:00.000Z`) }
              : {}),
            ...(params.to ? { lte: new Date(`${params.to}T23:59:59.999Z`) } : {}),
          },
        }
      : {}),
  }

  const [items, total] = await prisma.$transaction([
    prisma.auditLog.findMany({
      where,
      include: { actor: { select: { name: true, email: true, role: true } } },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    prisma.auditLog.count({ where }),
  ])

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const baseParams = {
    q: params.q,
    action: params.action,
    entityType: params.entityType,
    from: params.from,
    to: params.to,
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Audit logs"
        description="Immutable record of security-sensitive and data-changing operations."
      />

      <form className="flex flex-wrap items-end gap-3 border bg-background p-4">
        <div className="min-w-48 flex-1">
          <label
            htmlFor="q"
            className="mb-1.5 block text-[10px] font-semibold tracking-wider text-muted-foreground uppercase"
          >
            Search
          </label>
          <Input
            id="q"
            name="q"
            defaultValue={params.q}
            placeholder="Actor, summary or entity id"
            className="h-9"
          />
        </div>
        <div>
          <label
            htmlFor="action"
            className="mb-1.5 block text-[10px] font-semibold tracking-wider text-muted-foreground uppercase"
          >
            Action
          </label>
          <select
            id="action"
            name="action"
            defaultValue={params.action ?? ""}
            className="h-9 w-40 border-b border-input bg-transparent px-1 text-sm outline-none focus:border-b-ring"
          >
            <option value="">All actions</option>
            {ACTIONS.map((item) => (
              <option key={item} value={item}>
                {item.replaceAll("_", " ")}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label
            htmlFor="entityType"
            className="mb-1.5 block text-[10px] font-semibold tracking-wider text-muted-foreground uppercase"
          >
            Entity
          </label>
          <Input
            id="entityType"
            name="entityType"
            defaultValue={params.entityType}
            placeholder="DataRecord"
            className="h-9 w-36"
          />
        </div>
        <div>
          <label
            htmlFor="from"
            className="mb-1.5 block text-[10px] font-semibold tracking-wider text-muted-foreground uppercase"
          >
            From
          </label>
          <Input id="from" name="from" type="date" defaultValue={params.from} className="h-9" />
        </div>
        <div>
          <label
            htmlFor="to"
            className="mb-1.5 block text-[10px] font-semibold tracking-wider text-muted-foreground uppercase"
          >
            To
          </label>
          <Input id="to" name="to" type="date" defaultValue={params.to} className="h-9" />
        </div>
        <Button type="submit" size="sm">
          Apply
        </Button>
        <Button variant="ghost" size="sm" render={<Link href="/audit-logs" />}>
          Reset
        </Button>
      </form>

      {items.length === 0 ? (
        <EmptyState
          icon={ScrollText}
          title="No audit events found"
          description="Adjust the filters or perform a recorded action to see entries here."
        />
      ) : (
        <div className="border bg-background">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Timestamp</TableHead>
                <TableHead>Actor</TableHead>
                <TableHead>Action</TableHead>
                <TableHead>Entity</TableHead>
                <TableHead className="min-w-64">Summary</TableHead>
                <TableHead>IP</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((item) => (
                <TableRow key={item.id}>
                  <TableCell className="font-mono text-[11px] whitespace-nowrap text-muted-foreground">
                    {formatDateTime(item.createdAt)} IST
                  </TableCell>
                  <TableCell>
                    <span className="block text-xs font-medium">
                      {item.actor?.name ?? "System / anonymous"}
                    </span>
                    <span className="block text-[11px] text-muted-foreground">
                      {item.actor?.email ?? "—"}
                    </span>
                  </TableCell>
                  <TableCell>
                    <span
                      className={`text-[10px] font-semibold tracking-wider uppercase ${toneForAction(item.action)}`}
                    >
                      {item.action.replaceAll("_", " ")}
                    </span>
                  </TableCell>
                  <TableCell>
                    <span className="block text-xs">{item.entityType}</span>
                    {item.entityId && (
                      <span className="block max-w-32 truncate font-mono text-[10px] text-muted-foreground">
                        {item.entityId}
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {item.summary}
                  </TableCell>
                  <TableCell className="font-mono text-[10px] text-muted-foreground">
                    {item.ipAddress ?? "—"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>
          Page {page} of {totalPages} · {total} events
        </span>
        <div className="flex gap-2">
          {page > 1 ? (
            <Button variant="outline" size="xs" render={<Link href={buildHref(baseParams, page - 1)} />}>
              Previous
            </Button>
          ) : (
            <Button variant="outline" size="xs" disabled>
              Previous
            </Button>
          )}
          {page < totalPages ? (
            <Button variant="outline" size="xs" render={<Link href={buildHref(baseParams, page + 1)} />}>
              Next
            </Button>
          ) : (
            <Button variant="outline" size="xs" disabled>
              Next
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}
