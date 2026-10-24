export type ApiErrorPayload = {
  error?: {
    code?: string
    message?: string
    details?: unknown
  }
}

export class ApiClientError extends Error {
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
    this.name = "ApiClientError"
    this.status = status
    this.code = code
    this.details = details
  }
}

async function request<T>(
  method: "GET" | "POST" | "PATCH" | "DELETE",
  url: string,
  body?: unknown
): Promise<T> {
  const response = await fetch(url, {
    method,
    headers:
      body === undefined
        ? { Accept: "application/json" }
        : { Accept: "application/json", "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  })

  if (response.status === 204) return undefined as T

  const text = await response.text()
  let payload: unknown = null
  if (text) {
    try {
      payload = JSON.parse(text)
    } catch {
      payload = null
    }
  }

  if (!response.ok) {
    const error = (payload as ApiErrorPayload | null)?.error
    throw new ApiClientError(
      response.status,
      error?.code ?? "REQUEST_FAILED",
      error?.message ?? "The request could not be completed.",
      error?.details
    )
  }

  return (payload as { data?: T } | null)?.data as T
}

export function getJson<T>(url: string) {
  return request<T>("GET", url)
}

export function postJson<T>(url: string, body?: unknown) {
  return request<T>("POST", url, body ?? {})
}

export function patchJson<T>(url: string, body: unknown) {
  return request<T>("PATCH", url, body)
}

export function deleteJson<T = void>(url: string) {
  return request<T>("DELETE", url)
}

export function errorMessage(error: unknown): string {
  if (error instanceof ApiClientError) return error.message
  if (error instanceof Error) return error.message
  return "Something went wrong. Please try again."
}

export type FieldErrors = Record<string, string[]>

/** Extract the flattened field errors from a Zod validation response. */
export function fieldErrors(error: unknown): FieldErrors {
  if (!(error instanceof ApiClientError)) return {}
  const details = error.details as
    | { fieldErrors?: FieldErrors }
    | undefined
  return details?.fieldErrors ?? {}
}
