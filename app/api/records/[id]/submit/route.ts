import type { NextRequest } from "next/server"

import { parseBody } from "@/lib/api"
import { assertSameOrigin, errorResponse, ok } from "@/lib/http"
import { submitRecord } from "@/lib/services/records"
import { requireApiScope } from "@/lib/session"
import { submitSchema } from "@/lib/validations/record"

export const dynamic = "force-dynamic"

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    assertSameOrigin(request)
    const { user, scope } = await requireApiScope()
    const { id } = await context.params
    const input = await parseBody(request, submitSchema)
    const record = await submitRecord(scope, { id: user.id }, id, input.comment)
    return ok(record)
  } catch (error) {
    return errorResponse(error)
  }
}
