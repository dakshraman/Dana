import type { NextRequest } from "next/server"

import { enforceRateLimit, parseBody, parseQuery } from "@/lib/api"
import {
  assertSameOrigin,
  created,
  errorResponse,
  forbidden,
  ok,
} from "@/lib/http"
import { createUser, listUsers } from "@/lib/services/users"
import { requireApiScope } from "@/lib/session"
import { userCreateSchema, userQuerySchema } from "@/lib/validations/user"

export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  try {
    const { scope } = await requireApiScope()
    if (!scope.canManageUsers) {
      throw forbidden("You do not have permission to manage users.")
    }
    const query = parseQuery(request, userQuerySchema)
    const result = await listUsers(scope, query)

    return ok(result.items, {
      page: result.page,
      pageSize: result.pageSize,
      total: result.total,
      totalPages: result.totalPages,
    })
  } catch (error) {
    return errorResponse(error)
  }
}

export async function POST(request: NextRequest) {
  try {
    assertSameOrigin(request)
    const { scope } = await requireApiScope()
    enforceRateLimit(request, "users:create", {
      limit: 20,
      windowMs: 60_000,
    })

    const input = await parseBody(request, userCreateSchema)
    const user = await createUser(scope, input)
    return created(user)
  } catch (error) {
    return errorResponse(error)
  }
}
