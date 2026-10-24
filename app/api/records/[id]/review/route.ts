import type { NextRequest } from "next/server"

import { parseBody } from "@/lib/api"
import { assertSameOrigin, errorResponse, ok } from "@/lib/http"
import { reviewRecord } from "@/lib/services/records"
import { requireApiScope } from "@/lib/session"
import { reviewSchema } from "@/lib/validations/record"

export const dynamic = "force-dynamic"

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    assertSameOrigin(request)
    const { user, scope } = await requireApiScope()
    const { id } = await context.params
    const input = await parseBody(request, reviewSchema)
    const record = await reviewRecord(scope, { id: user.id }, id, input)
    return ok(record)
  } catch (error) {
    return errorResponse(error)
  }
}
