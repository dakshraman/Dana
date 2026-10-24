import "server-only"

import { headers } from "next/headers"

import { prisma } from "@/lib/db"
import { clientIpFromHeaders } from "@/lib/rate-limit"
import type { AuditAction } from "@/lib/generated/prisma/enums"

type AuditInput = {
  actorId?: string | null
  action: AuditAction
  entityType: string
  entityId?: string | null
  summary: string
  metadata?: Record<string, unknown>
}

/**
 * Audit logging must never break the business operation it describes. Failures
 * are logged to the server console and swallowed.
 */
export async function writeAudit(input: AuditInput): Promise<void> {
  try {
    let ipAddress: string | null = null
    let userAgent: string | null = null

    try {
      const requestHeaders = await headers()
      ipAddress = clientIpFromHeaders(requestHeaders)
      userAgent = requestHeaders.get("user-agent")
    } catch {
      // Outside a request scope (for example during seeding).
    }

    await prisma.auditLog.create({
      data: {
        actorId: input.actorId ?? null,
        action: input.action,
        entityType: input.entityType,
        entityId: input.entityId ?? null,
        summary: input.summary,
        metadata: (input.metadata ?? undefined) as never,
        ipAddress,
        userAgent,
      },
    })
  } catch (error) {
    console.error("[audit] failed to write audit log", error)
  }
}
