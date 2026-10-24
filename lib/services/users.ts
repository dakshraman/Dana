import "server-only"

import { compare, hash } from "bcryptjs"

import type { Prisma } from "@/lib/generated/prisma/client"
import { userScopeWhere } from "@/lib/access"
import { writeAudit } from "@/lib/audit"
import { prisma } from "@/lib/db"
import { badRequest, conflict, forbidden, notFound } from "@/lib/http"
import {
  unique,
  type AccessScope,
  type AppRole,
} from "@/lib/permissions"
import type {
  UserCreateInput,
  UserQueryInput,
  UserUpdateInput,
} from "@/lib/validations/user"

const BCRYPT_COST = 12

export type UserListItem = {
  id: string
  name: string
  email: string
  role: AppRole
  isActive: boolean
  lastLoginAt: Date | null
  createdAt: Date
  branchAssignments: { branch: { id: string; code: string; name: string } }[]
  regionAssignments: { region: { id: string; code: string; name: string } }[]
}

const listUserSelect = {
  id: true,
  name: true,
  email: true,
  role: true,
  isActive: true,
  lastLoginAt: true,
  createdAt: true,
  branchAssignments: {
    select: {
      branch: { select: { id: true, code: true, name: true } },
    },
    orderBy: { createdAt: "asc" },
  },
  regionAssignments: {
    select: {
      region: { select: { id: true, code: true, name: true } },
    },
    orderBy: { createdAt: "asc" },
  },
} satisfies Prisma.UserSelect

const detailUserSelect = {
  id: true,
  name: true,
  email: true,
  role: true,
  isActive: true,
  lastLoginAt: true,
  createdAt: true,
  updatedAt: true,
  branchAssignments: {
    select: {
      id: true,
      isPrimary: true,
      jobTitle: true,
      createdAt: true,
      branch: {
        select: {
          id: true,
          code: true,
          name: true,
          country: true,
          state: true,
          city: true,
          isActive: true,
        },
      },
    },
    orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }],
  },
  regionAssignments: {
    select: {
      id: true,
      createdAt: true,
      region: { select: { id: true, code: true, name: true } },
    },
    orderBy: { createdAt: "asc" },
  },
  managedBranches: {
    select: {
      id: true,
      code: true,
      name: true,
      country: true,
      city: true,
      isActive: true,
    },
    orderBy: { name: "asc" },
  },
} satisfies Prisma.UserSelect

function assertCanManageUsers(scope: AccessScope) {
  if (!scope.canManageUsers) {
    throw forbidden("You do not have permission to manage users.")
  }
}

/**
 * Super admins see every user. Everyone else sees users assigned to one of
 * their branches, users who manage one of those branches, or users assigned to
 * one of their regions. `userScopeWhere` supplies the branch-based portion.
 */
function scopedUserWhere(scope: AccessScope): Prisma.UserWhereInput {
  const base = userScopeWhere(scope)
  if (scope.isSuperAdmin || scope.regionIds.length === 0) return base

  return {
    OR: [
      base,
      {
        regionAssignments: {
          some: { regionId: { in: scope.regionIds } },
        },
      },
    ],
  }
}

function assertRoleAssignments(
  role: AppRole,
  branchIds: string[],
  regionIds: string[]
) {
  if (role === "REGIONAL_MANAGER" && regionIds.length === 0) {
    throw badRequest("Assign at least one region to a regional manager.")
  }
  if (
    (role === "BRANCH_MANAGER" || role === "BRANCH_EMPLOYEE") &&
    branchIds.length === 0
  ) {
    throw badRequest("Assign at least one branch to this user.")
  }
}

async function assertAssignmentsExist(
  scope: AccessScope,
  branchIds: string[],
  regionIds: string[]
) {
  if (branchIds.length > 0) {
    const branches = await prisma.branch.findMany({
      where: { id: { in: branchIds } },
      select: { id: true },
    })

    if (branches.length !== branchIds.length) {
      throw badRequest("One or more selected branches do not exist.")
    }

    if (
      !scope.isSuperAdmin &&
      branchIds.some((branchId) => !scope.branchIds.includes(branchId))
    ) {
      throw forbidden("You cannot assign a branch outside your access scope.")
    }
  }

  if (regionIds.length > 0) {
    const regions = await prisma.region.findMany({
      where: { id: { in: regionIds } },
      select: { id: true },
    })

    if (regions.length !== regionIds.length) {
      throw badRequest("One or more selected regions do not exist.")
    }

    if (
      !scope.isSuperAdmin &&
      regionIds.some((regionId) => !scope.regionIds.includes(regionId))
    ) {
      throw forbidden("You cannot assign a region outside your access scope.")
    }
  }
}

export async function listUsers(
  scope: AccessScope,
  params: UserQueryInput
): Promise<{
  items: UserListItem[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}> {
  const filters: Prisma.UserWhereInput[] = [scopedUserWhere(scope)]

  if (params.q) {
    filters.push({
      OR: [
        { name: { contains: params.q, mode: "insensitive" } },
        { email: { contains: params.q, mode: "insensitive" } },
      ],
    })
  }
  if (params.role !== "all") {
    filters.push({ role: params.role })
  }
  if (params.status === "active") {
    filters.push({ isActive: true })
  }
  if (params.status === "inactive") {
    filters.push({ isActive: false })
  }
  if (params.branchId) {
    const branchId = params.branchId

    if (!scope.isSuperAdmin && !scope.branchIds.includes(branchId)) {
      throw forbidden("You do not have access to this branch.")
    }

    filters.push({
      OR: [
        { branchAssignments: { some: { branchId } } },
        { managedBranches: { some: { id: branchId } } },
      ],
    })
  }

  const where: Prisma.UserWhereInput = { AND: filters }
  const skip = (params.page - 1) * params.pageSize

  const [total, users] = await Promise.all([
    prisma.user.count({ where }),
    prisma.user.findMany({
      where,
      skip,
      take: params.pageSize,
      orderBy: [{ name: "asc" }, { email: "asc" }],
      select: listUserSelect,
    }),
  ])

  const items: UserListItem[] = users.map((user) => ({
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    isActive: user.isActive,
    lastLoginAt: user.lastLoginAt,
    createdAt: user.createdAt,
    branchAssignments: user.branchAssignments,
    regionAssignments: user.regionAssignments,
  }))

  return {
    items,
    total,
    page: params.page,
    pageSize: params.pageSize,
    totalPages: total === 0 ? 1 : Math.ceil(total / params.pageSize),
  }
}

export async function getUser(scope: AccessScope, id: string) {
  const user = await prisma.user.findFirst({
    where: {
      AND: [{ id }, scopedUserWhere(scope)],
    },
    select: detailUserSelect,
  })

  if (!user) {
    throw notFound("User not found.")
  }

  return user
}

export async function getUserOptions(
  scope: AccessScope
): Promise<{ id: string; name: string; email: string; role: AppRole }[]> {
  return prisma.user.findMany({
    where: {
      AND: [
        scopedUserWhere(scope),
        {
          isActive: true,
          role: {
            in: ["SUPER_ADMIN", "REGIONAL_MANAGER", "BRANCH_MANAGER"],
          },
        },
      ],
    },
    select: { id: true, name: true, email: true, role: true },
    orderBy: { name: "asc" },
  })
}

export async function createUser(scope: AccessScope, input: UserCreateInput) {
  assertCanManageUsers(scope)

  const email = input.email.trim().toLowerCase()
  const branchIds = unique(input.branchIds)
  const regionIds = unique(input.regionIds)

  const existing = await prisma.user.findUnique({
    where: { email },
    select: { id: true },
  })
  if (existing) {
    throw conflict("A user with this email already exists.")
  }

  assertRoleAssignments(input.role, branchIds, regionIds)
  await assertAssignmentsExist(scope, branchIds, regionIds)

  const passwordHash = await hash(input.password, BCRYPT_COST)

  try {
    const user = await prisma.$transaction(async (tx) => {
      const created = await tx.user.create({
        data: {
          name: input.name,
          email,
          passwordHash,
          role: input.role,
          isActive: input.isActive,
        },
        select: { id: true },
      })

      if (branchIds.length > 0) {
        await tx.userBranchAssignment.createMany({
          data: branchIds.map((branchId, index) => ({
            userId: created.id,
            branchId,
            isPrimary: index === 0,
          })),
        })
      }

      if (regionIds.length > 0) {
        await tx.userRegionAssignment.createMany({
          data: regionIds.map((regionId) => ({
            userId: created.id,
            regionId,
          })),
        })
      }

      return tx.user.findUniqueOrThrow({
        where: { id: created.id },
        select: detailUserSelect,
      })
    })

    await writeAudit({
      actorId: scope.userId,
      action: "CREATE",
      entityType: "User",
      entityId: user.id,
      summary: `Created user ${user.email}`,
      metadata: {
        email: user.email,
        role: user.role,
        branchIds,
        regionIds,
      },
    })

    return user
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      throw conflict("A user with this email already exists.")
    }
    throw error
  }
}

export async function updateUser(
  scope: AccessScope,
  id: string,
  input: UserUpdateInput
) {
  assertCanManageUsers(scope)

  const target = await prisma.user.findFirst({
    where: {
      AND: [{ id }, scopedUserWhere(scope)],
    },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      isActive: true,
      branchAssignments: { select: { branchId: true } },
      regionAssignments: { select: { regionId: true } },
    },
  })

  if (!target) {
    throw notFound("User not found.")
  }

  const nextRole: AppRole = input.role ?? target.role
  const nextActive = input.isActive ?? target.isActive

  if (target.id === scope.userId) {
    if (!nextActive) {
      throw badRequest("You cannot deactivate your own account.")
    }
    if (input.role !== undefined && input.role !== target.role) {
      throw badRequest("You cannot change your own role.")
    }
  }

  if (
    target.role === "SUPER_ADMIN" &&
    target.isActive &&
    (nextRole !== "SUPER_ADMIN" || !nextActive)
  ) {
    const activeSuperAdmins = await prisma.user.count({
      where: { role: "SUPER_ADMIN", isActive: true },
    })

    if (activeSuperAdmins <= 1) {
      throw badRequest("At least one active super admin must remain.")
    }
  }

  const finalBranchIds = unique(
    input.branchIds ??
      target.branchAssignments.map((assignment) => assignment.branchId)
  )
  const finalRegionIds = unique(
    input.regionIds ??
      target.regionAssignments.map((assignment) => assignment.regionId)
  )

  if (
    input.role !== undefined ||
    input.branchIds !== undefined ||
    input.regionIds !== undefined
  ) {
    await assertAssignmentsExist(scope, finalBranchIds, finalRegionIds)
    assertRoleAssignments(nextRole, finalBranchIds, finalRegionIds)
  }

  const data: Prisma.UserUncheckedUpdateInput = {}

  if (input.name !== undefined) data.name = input.name
  if (input.role !== undefined) data.role = input.role
  if (input.isActive !== undefined) data.isActive = input.isActive
  if (input.password !== undefined) {
    data.passwordHash = await hash(input.password, BCRYPT_COST)
  }

  const clearManagedBranches =
    !nextActive || nextRole === "BRANCH_EMPLOYEE"
  let managerReferencesCleared = false

  try {
    const user = await prisma.$transaction(async (tx) => {
      if (Object.keys(data).length > 0) {
        await tx.user.update({
          where: { id: target.id },
          data,
        })
      }

      if (input.branchIds !== undefined) {
        await tx.userBranchAssignment.deleteMany({
          where: { userId: target.id },
        })

        if (finalBranchIds.length > 0) {
          await tx.userBranchAssignment.createMany({
            data: finalBranchIds.map((branchId, index) => ({
              userId: target.id,
              branchId,
              isPrimary: index === 0,
            })),
          })
        }
      }

      if (input.regionIds !== undefined) {
        await tx.userRegionAssignment.deleteMany({
          where: { userId: target.id },
        })

        if (finalRegionIds.length > 0) {
          await tx.userRegionAssignment.createMany({
            data: finalRegionIds.map((regionId) => ({
              userId: target.id,
              regionId,
            })),
          })
        }
      }

      if (clearManagedBranches) {
        const cleared = await tx.branch.updateMany({
          where: { managerId: target.id },
          data: { managerId: null },
        })
        managerReferencesCleared = cleared.count > 0
      }

      return tx.user.findUniqueOrThrow({
        where: { id: target.id },
        select: detailUserSelect,
      })
    })

    const activationChanged =
      input.isActive !== undefined && input.isActive !== target.isActive

    await writeAudit({
      actorId: scope.userId,
      action: activationChanged
        ? nextActive
          ? "ACTIVATE"
          : "DEACTIVATE"
        : "UPDATE",
      entityType: "User",
      entityId: user.id,
      summary: activationChanged
        ? `${nextActive ? "Activated" : "Deactivated"} user ${user.email}`
        : `Updated user ${user.email}`,
      metadata: {
        email: user.email,
        role: nextRole,
        isActive: nextActive,
        passwordReset: input.password !== undefined,
        branchIds: finalBranchIds,
        regionIds: finalRegionIds,
        managerReferencesCleared,
      },
    })

    return user
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      throw conflict("The requested user assignment already exists.")
    }
    throw error
  }
}

export async function updateProfile(userId: string, input: { name: string }) {
  const name = input.name.trim()
  if (name.length < 2) {
    throw badRequest("Name must be at least 2 characters.")
  }

  const existing = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, isActive: true },
  })

  if (!existing) {
    throw notFound("User not found.")
  }
  if (!existing.isActive) {
    throw forbidden("Your account is inactive.")
  }

  const user = await prisma.user.update({
    where: { id: existing.id },
    data: { name },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      isActive: true,
      lastLoginAt: true,
      createdAt: true,
      updatedAt: true,
    },
  })

  await writeAudit({
    actorId: userId,
    action: "UPDATE",
    entityType: "User",
    entityId: user.id,
    summary: `${user.name} updated their profile`,
    metadata: { changedFields: ["name"] },
  })

  return user
}

export async function changePassword(
  userId: string,
  input: { currentPassword: string; newPassword: string }
) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, passwordHash: true, isActive: true },
  })

  if (!user) {
    throw notFound("User not found.")
  }
  if (!user.isActive) {
    throw forbidden("Your account is inactive.")
  }
  if (input.newPassword.length < 12) {
    throw badRequest("Use at least 12 characters for the new password.")
  }

  const currentPasswordMatches = await compare(
    input.currentPassword,
    user.passwordHash
  )
  if (!currentPasswordMatches) {
    throw badRequest("The current password is incorrect.")
  }

  const passwordHash = await hash(input.newPassword, BCRYPT_COST)

  await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash },
  })

  await writeAudit({
    actorId: userId,
    action: "UPDATE",
    entityType: "User",
    entityId: user.id,
    summary: "Changed their password",
    metadata: { passwordChanged: true },
  })
}

function isUniqueConstraintError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: unknown }).code === "P2002"
  )
}
