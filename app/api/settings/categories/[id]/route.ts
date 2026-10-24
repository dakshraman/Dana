import type { NextRequest } from "next/server"

import { parseBody } from "@/lib/api"
import { assertSameOrigin, errorResponse, ok } from "@/lib/http"
import { getCategory, updateCategory } from "@/lib/services/settings"
import { requireApiScope } from "@/lib/session"
import { categoryUpdateSchema } from "@/lib/validations/settings"

export const dynamic = "force-dynamic"

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { scope } = await requireApiScope()
    const { id } = await context.params
    const category = await getCategory(scope, id)
    return ok(category)
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
    const input = await parseBody(request, categoryUpdateSchema)
    const category = await updateCategory(scope, id, input)
    return ok(category)
  } catch (error) {
    return errorResponse(error)
  }
}
