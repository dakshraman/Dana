import "server-only"

import { revalidatePath } from "next/cache"
import type { NextRequest } from "next/server"

import { parseBody } from "@/lib/api"
import { assertSameOrigin, errorResponse, ok } from "@/lib/http"
import { updateProfile } from "@/lib/services/users"
import { requireApiUser } from "@/lib/session"
import { profileUpdateSchema } from "@/lib/validations/user"

export const dynamic = "force-dynamic"

export async function PATCH(request: NextRequest) {
  try {
    assertSameOrigin(request)
    const user = await requireApiUser()
    const input = await parseBody(request, profileUpdateSchema)
    const updated = await updateProfile(user.id, input)
    revalidatePath("/account")
    revalidatePath("/", "layout")
    return ok(updated)
  } catch (error) {
    return errorResponse(error)
  }
}
