import type { NextRequest } from "next/server"

import { parseBody } from "@/lib/api"
import {
  assertSameOrigin,
  errorResponse,
  noContent,
  notFound,
  ok,
} from "@/lib/http"
import {
  getBranch,
  setBranchActive,
  updateBranch,
} from "@/lib/services/branches"
import { requireApiScope } from "@/lib/session"
import { branchUpdateSchema } from "@/lib/validations/branch"

export const dynamic = "force-dynamic"

const idSchema = (value: string) => {
  if (!value || value.length > 64) throw notFound("Branch not found.")
  return value
}

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { scope } = await requireApiScope()
    const { id } = await context.params
    const branch = await getBranch(scope, idSchema(id))
    return ok(branch)
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
    const input = await parseBody(request, branchUpdateSchema)
    const branch = await updateBranch(scope, idSchema(id), input)
    return ok(branch)
  } catch (error) {
    return errorResponse(error)
  }
}

/** Branches are never hard-deleted: deactivation preserves their records. */
export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    assertSameOrigin(request)
    const { scope } = await requireApiScope()
    const { id } = await context.params
    await setBranchActive(scope, idSchema(id), false)
    return noContent()
  } catch (error) {
    return errorResponse(error)
  }
}
