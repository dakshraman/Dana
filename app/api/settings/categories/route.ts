import type { NextRequest } from "next/server"

import { parseBody } from "@/lib/api"
import { assertSameOrigin, created, errorResponse, ok } from "@/lib/http"
import {
  createCategory,
  listCategories,
} from "@/lib/services/settings"
import { requireApiScope } from "@/lib/session"
import { categoryCreateSchema } from "@/lib/validations/settings"

export const dynamic = "force-dynamic"

export async function GET() {
  try {
    const { scope } = await requireApiScope()
    const categories = await listCategories(scope)
    return ok(categories)
  } catch (error) {
    return errorResponse(error)
  }
}

export async function POST(request: NextRequest) {
  try {
    assertSameOrigin(request)
    const { scope } = await requireApiScope()
    const input = await parseBody(request, categoryCreateSchema)
    const category = await createCategory(scope, input)
    return created(category)
  } catch (error) {
    return errorResponse(error)
  }
}
