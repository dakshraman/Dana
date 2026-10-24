import type { NextRequest } from "next/server"

import { enforceRateLimit, parseBody } from "@/lib/api"
import { assertSameOrigin, errorResponse, ok } from "@/lib/http"
import { changePassword } from "@/lib/services/users"
import { requireApiUser } from "@/lib/session"
import { changePasswordSchema } from "@/lib/validations/auth"

export const dynamic = "force-dynamic"

export async function POST(request: NextRequest) {
  try {
    assertSameOrigin(request)
    const user = await requireApiUser()
    enforceRateLimit(request, `account:password:${user.id}`, {
      limit: 5,
      windowMs: 15 * 60_000,
    })

    const input = await parseBody(request, changePasswordSchema)
    await changePassword(user.id, {
      currentPassword: input.currentPassword,
      newPassword: input.newPassword,
    })

    return ok({ changed: true })
  } catch (error) {
    return errorResponse(error)
  }
}
