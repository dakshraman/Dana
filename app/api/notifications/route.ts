import type { NextRequest } from "next/server"
import { z } from "zod"

import { parseBody } from "@/lib/api"
import { prisma } from "@/lib/db"
import { assertSameOrigin, errorResponse, ok } from "@/lib/http"
import { requireApiScope } from "@/lib/session"

export const dynamic = "force-dynamic"

const markReadSchema = z.object({
  ids: z.array(z.string().min(1)).max(200).optional(),
  all: z.boolean().optional(),
  read: z.boolean().default(true),
})

export async function GET(request: NextRequest) {
  try {
    const { user } = await requireApiScope()
    const page = Math.max(1, Number(request.nextUrl.searchParams.get("page") ?? "1") || 1)
    const unreadOnly = request.nextUrl.searchParams.get("unread") === "1"
    const pageSize = 20

    const where = {
      userId: user.id,
      ...(unreadOnly ? { readAt: null } : {}),
    }

    const [items, total, unreadCount] = await prisma.$transaction([
      prisma.notification.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.notification.count({ where }),
      prisma.notification.count({ where: { userId: user.id, readAt: null } }),
    ])

    return ok(items, {
      page,
      pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
      unreadCount,
    })
  } catch (error) {
    return errorResponse(error)
  }
}

export async function PATCH(request: NextRequest) {
  try {
    assertSameOrigin(request)
    const { user } = await requireApiScope()
    const input = await parseBody(request, markReadSchema)

    if (!input.all && (!input.ids || input.ids.length === 0)) {
      return ok({ updated: 0 })
    }

    const result = await prisma.notification.updateMany({
      where: {
        userId: user.id,
        ...(input.all ? {} : { id: { in: input.ids } }),
      },
      data: { readAt: input.read ? new Date() : null },
    })

    return ok({ updated: result.count })
  } catch (error) {
    return errorResponse(error)
  }
}
