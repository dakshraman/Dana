import type { NextRequest } from "next/server"
import { z } from "zod"

import { parseBody } from "@/lib/api"
import { prisma } from "@/lib/db"
import { assertSameOrigin, errorResponse, notFound, ok } from "@/lib/http"
import { requireApiScope } from "@/lib/session"

export const dynamic = "force-dynamic"

const updateSchema = z.object({
  read: z.boolean(),
})

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    assertSameOrigin(request)
    const { user } = await requireApiScope()
    const { id } = await context.params
    const input = await parseBody(request, updateSchema)

    const notification = await prisma.notification.findFirst({
      where: { id, userId: user.id },
      select: { id: true },
    })
    if (!notification) throw notFound("Notification not found.")

    const updated = await prisma.notification.update({
      where: { id },
      data: { readAt: input.read ? new Date() : null },
    })

    return ok(updated)
  } catch (error) {
    return errorResponse(error)
  }
}
