import "server-only"

import type { NextRequest } from "next/server"
import type { ZodType } from "zod"

import { badRequest, tooManyRequests } from "@/lib/http"
import { clientIpFromHeaders, rateLimit } from "@/lib/rate-limit"

export function searchParamsObject(request: NextRequest): Record<string, string> {
  const result: Record<string, string> = {}
  for (const [key, value] of request.nextUrl.searchParams.entries()) {
    if (value !== "") result[key] = value
  }
  return result
}

export function parseQuery<T>(request: NextRequest, schema: ZodType<T>): T {
  const parsed = schema.safeParse(searchParamsObject(request))
  if (!parsed.success) {
    throw badRequest("Invalid query parameters.", parsed.error.flatten())
  }
  return parsed.data
}

export async function parseBody<T>(
  request: Request,
  schema: ZodType<T>
): Promise<T> {
  let json: unknown
  try {
    json = await request.json()
  } catch {
    throw badRequest("The request body must be valid JSON.")
  }

  const parsed = schema.safeParse(json)
  if (!parsed.success) {
    throw badRequest("The submitted data is invalid.", parsed.error.flatten())
  }
  return parsed.data
}

/**
 * Fixed-window limiter keyed by client IP and logical action. Returns the
 * remaining budget so callers can surface rate-limit headers if required.
 */
export function enforceRateLimit(
  request: NextRequest,
  action: string,
  options: { limit: number; windowMs: number }
) {
  const ip = clientIpFromHeaders(request.headers)
  const result = rateLimit(`${action}:${ip}`, options)
  if (!result.ok) {
    throw tooManyRequests(
      "You have made too many requests. Wait a moment and try again."
    )
  }
  return result
}
