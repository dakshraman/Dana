import "server-only"

import { PrismaPg } from "@prisma/adapter-pg"

import { PrismaClient } from "@/lib/generated/prisma/client"

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient
}

/**
 * Build the node-postgres pool configuration.
 *
 * `DATABASE_SSL_CA` lets serverless platforms (where the repository is not on
 * disk) supply the Supabase CA chain as an environment variable instead of a
 * `sslrootcert` file. When present, the URL's own ssl parameters are removed
 * so they cannot conflict with the explicit `ssl` object.
 */
function poolConfig(connectionString: string) {
  const ca = process.env.DATABASE_SSL_CA?.replace(/\\n/g, "\n").trim()
  const max = Number(process.env.DATABASE_POOL_MAX ?? "")
  const url = new URL(connectionString)

  if (ca) {
    url.searchParams.delete("sslmode")
    url.searchParams.delete("sslrootcert")
  }

  return {
    connectionString: url.toString(),
    ...(ca ? { ssl: { ca, rejectUnauthorized: true } } : {}),
    ...(Number.isFinite(max) && max > 0 ? { max } : {}),
  }
}

function createClient(): PrismaClient {
  const connectionString = process.env.DATABASE_URL

  if (!connectionString) {
    throw new Error("DATABASE_URL is not set. Copy .env.example to .env.")
  }

  const adapter = new PrismaPg(poolConfig(connectionString))

  return new PrismaClient({
    adapter,
    log:
      process.env.NODE_ENV === "development"
        ? ["warn", "error"]
        : ["error"],
  })
}

/**
 * Next.js imports route modules while collecting build metadata. Creating the
 * pool at module scope would require a valid database URL during `next build`,
 * which serverless builders do not always expose. Create it on first use
 * instead, and cache it across hot reloads.
 */
function getClient(): PrismaClient {
  globalForPrisma.prisma ??= createClient()
  return globalForPrisma.prisma
}

export const prisma = new Proxy({} as PrismaClient, {
  get(_target, property) {
    const client = getClient()
    const value = Reflect.get(client, property, client)
    return typeof value === "function" ? value.bind(client) : value
  },
  has(_target, property) {
    return property in getClient()
  },
})
