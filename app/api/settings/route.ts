import type { NextRequest } from "next/server"

import { parseBody } from "@/lib/api"
import {
  assertSameOrigin,
  errorResponse,
  forbidden,
  ok,
} from "@/lib/http"
import {
  listCategories,
  updateSystemSettings,
} from "@/lib/services/settings"
import { getSystemSettings } from "@/lib/settings"
import { requireApiScope } from "@/lib/session"
import { systemSettingsSchema } from "@/lib/validations/settings"

export const dynamic = "force-dynamic"

export async function GET() {
  try {
    const { scope } = await requireApiScope()
    if (!scope.canManageSettings) {
      throw forbidden("You do not have permission to manage settings.")
    }
    const [settings, categories] = await Promise.all([
      getSystemSettings(),
      listCategories(scope),
    ])
    return ok({ settings, categories })
  } catch (error) {
    return errorResponse(error)
  }
}

export async function PATCH(request: NextRequest) {
  try {
    assertSameOrigin(request)
    const { scope } = await requireApiScope()
    const input = await parseBody(request, systemSettingsSchema)
    const settings = await updateSystemSettings(scope, input)
    return ok(settings)
  } catch (error) {
    return errorResponse(error)
  }
}
