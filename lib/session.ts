import "server-only"

import { cache } from "react"
import { redirect } from "next/navigation"

import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { unauthorized } from "@/lib/http"
import {
  buildAccessScope,
  type AccessScope,
  type AppRole,
} from "@/lib/permissions"

export const sessionUserInclude = {
  branchAssignments: { select: { branchId: true } },
  regionAssignments: { select: { regionId: true } },
} as const

export type SessionUser = {
  id: string
  email: string
  name: string
  role: AppRole
  isActive: boolean
  lastLoginAt: Date | null
  branchAssignments: { branchId: string }[]
  regionAssignments: { regionId: string }[]
}

/**
 * Resolve the authenticated user from the database on every request. The JWT
 * only carries the user id; roles, assignments and activation state are always
 * read fresh so a deactivated or reassigned user cannot keep stale access.
 */
export const getSessionUser = cache(async (): Promise<SessionUser | null> => {
  const session = await auth()
  const userId = session?.user?.id
  if (!userId) return null

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      isActive: true,
      lastLoginAt: true,
      ...sessionUserInclude,
    },
  })

  if (!user || !user.isActive) return null

  return {
    ...user,
    role: user.role as AppRole,
  }
})

export const getAccessScope = cache(async (): Promise<AccessScope | null> => {
  const user = await getSessionUser()
  if (!user) return null

  const regionIds = user.regionAssignments.map((item) => item.regionId)
  const directBranchIds = user.branchAssignments.map((item) => item.branchId)

  let branchIds = directBranchIds
  let scopedRegionIds: string[] = []

  if (user.role === "REGIONAL_MANAGER") {
    scopedRegionIds = regionIds
    const regionalBranches = regionIds.length
      ? await prisma.branch.findMany({
          where: { regionId: { in: regionIds } },
          select: { id: true },
        })
      : []
    branchIds = [...directBranchIds, ...regionalBranches.map((b) => b.id)]
  } else if (user.role === "BRANCH_MANAGER") {
    const managed = await prisma.branch.findMany({
      where: { managerId: user.id },
      select: { id: true },
    })
    branchIds = [...directBranchIds, ...managed.map((b) => b.id)]
  }

  return buildAccessScope({
    userId: user.id,
    role: user.role,
    regionIds: scopedRegionIds,
    branchIds,
  })
})

export async function requirePageUser(): Promise<SessionUser> {
  const user = await getSessionUser()
  if (!user) redirect("/login")
  return user
}

export async function requirePageScope(): Promise<AccessScope> {
  const scope = await getAccessScope()
  if (!scope) redirect("/login")
  return scope
}

export async function requireApiUser(): Promise<SessionUser> {
  const user = await getSessionUser()
  if (!user) throw unauthorized()
  return user
}

export async function requireApiScope(): Promise<{
  user: SessionUser
  scope: AccessScope
}> {
  const user = await getSessionUser()
  const scope = await getAccessScope()
  if (!user || !scope) throw unauthorized()
  return { user, scope }
}
