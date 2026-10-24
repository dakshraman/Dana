import type { NextRequest } from "next/server"

import { parseBody } from "@/lib/api"
import { assertSameOrigin, errorResponse, forbidden, ok } from "@/lib/http"
import { getUser, updateUser } from "@/lib/services/users"
import { requireApiScope } from "@/lib/session"
import { userUpdateSchema } from "@/lib/validations/user"

export const dynamic = "force-dynamic"

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { scope } = await requireApiScope()
    if (!scope.canManageUsers) {
      throw forbidden("You do not have permission to manage users.")
    }
    const { id } = await context.params
    const user = await getUser(scope, id)
    return ok(user)
  } catch (error) {
    return errorResponse(error)
  }
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    assertSameOrigin(request)
    const { scope } = await requireApiScope()
    const { id } = await context.params
    const input = await parseBody(request, userUpdateSchema)
    const user = await updateUser(scope, id, input)
    return ok(user)
  } catch (error) {
    return errorResponse(error)
  }
}
