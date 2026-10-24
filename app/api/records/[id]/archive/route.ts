import type { NextRequest } from "next/server"

import { parseBody } from "@/lib/api"
import { assertSameOrigin, errorResponse, ok } from "@/lib/http"
import { archiveRecord } from "@/lib/services/records"
import { requireApiScope } from "@/lib/session"
import { archiveSchema } from "@/lib/validations/record"

export const dynamic = "force-dynamic"

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    assertSameOrigin(request)
    const { user, scope } = await requireApiScope()
    const { id } = await context.params
    const input = await parseBody(request, archiveSchema)
    const record = await archiveRecord(scope, { id: user.id }, id, input.reason)
    return ok(record)
  } catch (error) {
    return errorResponse(error)
  }
}
