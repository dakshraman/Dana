import type { NextRequest } from "next/server"
import { z } from "zod"

import { parseBody } from "@/lib/api"
import { assertSameOrigin, errorResponse, ok } from "@/lib/http"
import { getRegion, updateRegion } from "@/lib/services/branches"
import { requireApiScope } from "@/lib/session"

export const dynamic = "force-dynamic"

const regionUpdateSchema = z.object({
  code: z
    .string()
    .trim()
    .toUpperCase()
    .min(2)
    .max(20)
    .regex(/^[A-Z0-9][A-Z0-9-]*$/)
    .optional(),
  name: z.string().trim().min(2).max(120).optional(),
  description: z.string().trim().max(500).nullable().optional(),
})

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { scope } = await requireApiScope()
    const { id } = await context.params
    return ok(await getRegion(scope, id))
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
    const { scope } = await requireApiScope()
    const { id } = await context.params
    const input = await parseBody(request, regionUpdateSchema)
    return ok(await updateRegion(scope, id, input))
  } catch (error) {
    return errorResponse(error)
  }
}
