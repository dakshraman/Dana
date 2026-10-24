import type { NextRequest } from "next/server"

import { assertSameOrigin, errorResponse, ok } from "@/lib/http"
import { restoreRecord } from "@/lib/services/records"
import { requireApiScope } from "@/lib/session"

export const dynamic = "force-dynamic"

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    assertSameOrigin(request)
    const { user, scope } = await requireApiScope()
    const { id } = await context.params
    const record = await restoreRecord(scope, { id: user.id }, id)
    return ok(record)
  } catch (error) {
    return errorResponse(error)
  }
}
