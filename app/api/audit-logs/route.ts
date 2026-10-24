import type { NextRequest } from "next/server"
import { z } from "zod"

import { parseQuery } from "@/lib/api"
import { prisma } from "@/lib/db"
import { errorResponse, forbidden, ok } from "@/lib/http"
import { requireApiScope } from "@/lib/session"

export const dynamic = "force-dynamic"

const auditQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
  q: z.string().trim().max(120).optional(),
  action: z.string().max(40).optional(),
  entityType: z.string().trim().max(60).optional(),
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
})

export async function GET(request: NextRequest) {
  try {
    const { scope } = await requireApiScope()
    if (!scope.canViewAuditLogs) {
      throw forbidden("You do not have access to audit logs.")
    }

    const params = parseQuery(request, auditQuerySchema)
    const where = {
      ...(params.action ? { action: params.action as never } : {}),
      ...(params.entityType ? { entityType: params.entityType } : {}),
      ...(params.q
        ? {
            OR: [
              { summary: { contains: params.q, mode: "insensitive" as const } },
              {
                entityId: { contains: params.q, mode: "insensitive" as const },
              },
              {
                actor: {
                  name: { contains: params.q, mode: "insensitive" as const },
                },
              },
              {
                actor: {
                  email: { contains: params.q, mode: "insensitive" as const },
                },
              },
            ],
          }
        : {}),
      ...(params.from || params.to
        ? {
            createdAt: {
              ...(params.from
                ? { gte: new Date(`${params.from}T00:00:00.000Z`) }
                : {}),
              ...(params.to
                ? { lte: new Date(`${params.to}T23:59:59.999Z`) }
                : {}),
            },
          }
        : {}),
    }

    const [items, total] = await prisma.$transaction([
      prisma.auditLog.findMany({
        where,
        include: {
          actor: { select: { id: true, name: true, email: true, role: true } },
        },
        orderBy: { createdAt: "desc" },
        skip: (params.page - 1) * params.pageSize,
        take: params.pageSize,
      }),
      prisma.auditLog.count({ where }),
    ])

    return ok(items, {
      page: params.page,
      pageSize: params.pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / params.pageSize)),
    })
  } catch (error) {
    return errorResponse(error)
  }
}
