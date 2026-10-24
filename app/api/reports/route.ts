import type { NextRequest } from "next/server"

import { parseQuery } from "@/lib/api"
import { errorResponse, ok } from "@/lib/http"
import { getReport } from "@/lib/services/reports"
import { requireApiScope } from "@/lib/session"
import { reportQuerySchema } from "@/lib/validations/report"

export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  try {
    const { scope } = await requireApiScope()
    const query = parseQuery(request, reportQuerySchema)
    const report = await getReport(scope, query)
    return ok(report)
  } catch (error) {
    return errorResponse(error)
  }
}
