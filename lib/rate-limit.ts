/**
 * Small in-process fixed-window rate limiter.
 *
 * This is adequate for a single Node process and for development. For
 * multi-instance production deployments put Redis (or an edge rate limiter)
 * behind the same interface. The login flow additionally persists attempts in
 * PostgreSQL and is not dependent on this module alone.
 */

type Entry = { count: number; resetAt: number }

const buckets = new Map<string, Entry>()
const MAX_KEYS = 10_000

function prune(now: number) {
  if (buckets.size < MAX_KEYS) return
  for (const [key, entry] of buckets) {
    if (entry.resetAt <= now) buckets.delete(key)
  }
}

export type RateLimitResult = {
  ok: boolean
  limit: number
  remaining: number
  resetAt: number
}

export function rateLimit(
  key: string,
  options: { limit: number; windowMs: number }
): RateLimitResult {
  const now = Date.now()
  prune(now)

  const existing = buckets.get(key)
  if (!existing || existing.resetAt <= now) {
    const entry = { count: 1, resetAt: now + options.windowMs }
    buckets.set(key, entry)
    return {
      ok: true,
      limit: options.limit,
      remaining: options.limit - 1,
      resetAt: entry.resetAt,
    }
  }

  existing.count += 1
  return {
    ok: existing.count <= options.limit,
    limit: options.limit,
    remaining: Math.max(0, options.limit - existing.count),
    resetAt: existing.resetAt,
  }
}

export function clientIpFromHeaders(headers: Headers): string {
  const forwarded = headers.get("x-forwarded-for")
  if (forwarded) return forwarded.split(",")[0]!.trim()
  return headers.get("x-real-ip") ?? "unknown"
}
