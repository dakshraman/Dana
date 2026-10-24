import type { NextRequest } from "next/server"

import { parseBody } from "@/lib/api"
import { assertSameOrigin, created, errorResponse, ok } from "@/lib/http"
import {
  createRegion,
  listRegions,
} from "@/lib/services/branches"
import { requireApiScope } from "@/lib/session"
import { regionCreateSchema } from "@/lib/validations/branch"

export const dynamic = "force-dynamic"

export async function GET() {
  try {
    const { scope } = await requireApiScope()
    const regions = await listRegions(scope)
    return ok(regions)
  } catch (error) {
    return errorResponse(error)
  }
}

export async function POST(request: NextRequest) {
  try {
    assertSameOrigin(request)
    const { scope } = await requireApiScope()
    const input = await parseBody(request, regionCreateSchema)
    const region = await createRegion(scope, input)
    return created(region)
  } catch (error) {
    return errorResponse(error)
  }
}
