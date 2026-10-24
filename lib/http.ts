import { NextResponse } from "next/server"
import { ZodError } from "zod"

export class ApiError extends Error {
  readonly status: number
  readonly code: string
  readonly details?: unknown

  constructor(
    status: number,
    code: string,
    message: string,
    details?: unknown
  ) {
    super(message)
    this.name = "ApiError"
    this.status = status
    this.code = code
    this.details = details
  }
}

export const unauthorized = () =>
  new ApiError(401, "UNAUTHORIZED", "Authentication is required.")

export const forbidden = (message = "You do not have access to this resource.") =>
  new ApiError(403, "FORBIDDEN", message)

export const notFound = (message = "The requested resource was not found.") =>
  new ApiError(404, "NOT_FOUND", message)

export const badRequest = (message: string, details?: unknown) =>
  new ApiError(400, "BAD_REQUEST", message, details)

export const conflict = (message: string) =>
  new ApiError(409, "CONFLICT", message)

export const tooManyRequests = (message = "Too many requests. Try again later.") =>
  new ApiError(429, "RATE_LIMITED", message)

export function ok<T>(data: T, meta?: Record<string, unknown>) {
  return NextResponse.json(meta ? { data, meta } : { data })
}

export function created<T>(data: T) {
  return NextResponse.json({ data }, { status: 201 })
}

export function noContent() {
  return new NextResponse(null, { status: 204 })
}

function toPublicMessage(error: unknown) {
  if (error instanceof ApiError) return error.message
  if (error instanceof ZodError) return "The submitted data is invalid."
  if (error instanceof SyntaxError) return "The request body is not valid JSON."
  return "An unexpected error occurred."
}

export function errorResponse(error: unknown) {
  if (error instanceof ApiError) {
    return NextResponse.json(
      {
        error: {
          code: error.code,
          message: error.message,
          ...(error.details ? { details: error.details } : {}),
        },
      },
      { status: error.status }
    )
  }

  if (error instanceof ZodError) {
    return NextResponse.json(
      {
        error: {
          code: "VALIDATION_ERROR",
          message: "The submitted data is invalid.",
          details: error.flatten(),
        },
      },
      { status: 400 }
    )
  }

  if (error instanceof SyntaxError) {
    return NextResponse.json(
      {
        error: {
          code: "INVALID_JSON",
          message: "The request body is not valid JSON.",
        },
      },
      { status: 400 }
    )
  }

  // Log server-side only. Never leak stack traces or database details.
  console.error("[api] unhandled error", error)
  return NextResponse.json(
    {
      error: {
        code: "INTERNAL_ERROR",
        message: toPublicMessage(error),
      },
    },
    { status: 500 }
  )
}

/**
 * Defense in depth against cross-site form posts. Auth.js cookies are
 * SameSite=Lax, and Server Actions get their own origin check from Next.js.
 * Route handlers additionally verify the Origin header when present.
 */
export function assertSameOrigin(request: Request) {
  if (!["POST", "PUT", "PATCH", "DELETE"].includes(request.method)) return

  const origin = request.headers.get("origin")
  if (!origin) return

  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host")
  if (!host) return

  let originHost: string
  try {
    originHost = new URL(origin).host
  } catch {
    throw forbidden("Invalid request origin.")
  }

  if (originHost !== host) {
    throw forbidden("Cross-site requests are not allowed.")
  }
}
