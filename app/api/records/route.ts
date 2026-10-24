import type { NextRequest } from "next/server"

import { enforceRateLimit, parseBody, parseQuery } from "@/lib/api"
import { assertSameOrigin, created, errorResponse, ok } from "@/lib/http"
import { createRecord, listRecords } from "@/lib/services/records"
import { requireApiScope } from "@/lib/session"
import { recordCreateSchema, recordQuerySchema } from "@/lib/validations/record"

export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  try {
    const { scope } = await requireApiScope()
    const query = parseQuery(request, recordQuerySchema)
    const result = await listRecords(scope, query)

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
    const { user, scope } = await requireApiScope()
    enforceRateLimit(request, "records:create", {
      limit: 60,
      windowMs: 60_000,
    })

    const input = await parseBody(request, recordCreateSchema)
    const record = await createRecord(scope, { id: user.id }, input)
    return created(record)
  } catch (error) {
    return errorResponse(error)
  }
}
