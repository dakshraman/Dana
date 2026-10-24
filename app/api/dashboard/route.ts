import type { NextRequest } from "next/server"

import { parseQuery } from "@/lib/api"
import { errorResponse, ok } from "@/lib/http"
import { getDashboardData } from "@/lib/services/dashboard"
import { requireApiScope } from "@/lib/session"
import { dashboardQuerySchema } from "@/lib/validations/dashboard"

export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  try {
    const { scope } = await requireApiScope()
    const query = parseQuery(request, dashboardQuerySchema)
    const data = await getDashboardData(scope, query)
    return ok(data)
  } catch (error) {
    return errorResponse(error)
  }
}
