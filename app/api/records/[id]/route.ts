import type { NextRequest } from "next/server"

import { parseBody } from "@/lib/api"
import { assertSameOrigin, errorResponse, ok } from "@/lib/http"
import { getRecord, updateRecord } from "@/lib/services/records"
import { requireApiScope } from "@/lib/session"
import { recordUpdateSchema } from "@/lib/validations/record"

export const dynamic = "force-dynamic"

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { scope } = await requireApiScope()
    const { id } = await context.params
    const record = await getRecord(scope, id)
    return ok(record)
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
    const { user, scope } = await requireApiScope()
    const { id } = await context.params
    const input = await parseBody(request, recordUpdateSchema)
    const record = await updateRecord(scope, { id: user.id }, id, input)
    return ok(record)
  } catch (error) {
    return errorResponse(error)
  }
}
