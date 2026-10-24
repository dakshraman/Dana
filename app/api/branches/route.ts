import type { NextRequest } from "next/server"

import { parseBody, parseQuery, enforceRateLimit } from "@/lib/api"
import { assertSameOrigin, created, errorResponse, ok } from "@/lib/http"
import { listBranches, createBranch } from "@/lib/services/branches"
import { requireApiScope } from "@/lib/session"
import { branchCreateSchema, branchQuerySchema } from "@/lib/validations/branch"

export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  try {
    const { scope } = await requireApiScope()
    const query = parseQuery(request, branchQuerySchema)
    const result = await listBranches(scope, query)

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
    enforceRateLimit(request, "branches:create", {
      limit: 20,
      windowMs: 60_000,
    })

    const input = await parseBody(request, branchCreateSchema)
    const branch = await createBranch(scope, input)
    return created(branch)
  } catch (error) {
    return errorResponse(error)
  }
}
