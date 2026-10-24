import "server-only"

import type { Prisma } from "@/lib/generated/prisma/client"
import { branchScopeWhere } from "@/lib/access"
import { writeAudit } from "@/lib/audit"
import { prisma } from "@/lib/db"
import { badRequest, conflict, forbidden, notFound } from "@/lib/http"
import { RECORD_STATUSES, type AccessScope } from "@/lib/permissions"
import type {
  BranchCreateInput,
  BranchQueryInput,
  BranchUpdateInput,
} from "@/lib/validations/branch"

export type BranchListItem = {
  id: string
  code: string
  name: string
  country: string
  state: string
  city: string
  email: string
  phone: string
  isActive: boolean
  createdAt: Date
  region: { id: string; code: string; name: string }
  manager: { id: string; name: string; email: string } | null
  recordCount: number
  pendingCount: number
}

const MANAGER_ROLES = new Set<string>([
  "BRANCH_MANAGER",
  "REGIONAL_MANAGER",
  "SUPER_ADMIN",
])

const branchInclude = {
  region: { select: { id: true, code: true, name: true } },
  manager: {
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      isActive: true,
    },
  },
} satisfies Prisma.BranchInclude

function assertCanManageBranches(scope: AccessScope) {
  if (!scope.canManageBranches) {
    throw forbidden("You do not have permission to manage branches.")
  }
}

function branchOrderBy(
  sort: BranchQueryInput["sort"],
  direction: BranchQueryInput["direction"]
): Prisma.BranchOrderByWithRelationInput[] {
  switch (sort) {
    case "code":
      return [{ code: direction }, { id: "asc" }]
    case "country":
      return [{ country: direction }, { name: "asc" }, { id: "asc" }]
    case "createdAt":
      return [{ createdAt: direction }, { id: "asc" }]
    case "name":
    default:
      return [{ name: direction }, { id: "asc" }]
  }
}

async function assertCodeAvailable(code: string, excludeId?: string) {
  const existing = await prisma.branch.findUnique({
    where: { code },
    select: { id: true },
  })

  if (existing && existing.id !== excludeId) {
    throw conflict("A branch with this code already exists.")
  }
}

async function validateRegion(scope: AccessScope, regionId: string) {
  const region = await prisma.region.findUnique({
    where: { id: regionId },
    select: { id: true },
  })

  if (!region) {
    throw badRequest("The selected region does not exist.")
  }

  if (!scope.isSuperAdmin && !scope.regionIds.includes(regionId)) {
    throw forbidden("You do not have access to the selected region.")
  }
}

async function validateManager(managerId: string) {
  const manager = await prisma.user.findUnique({
    where: { id: managerId },
    select: { id: true, role: true, isActive: true },
  })

  if (!manager) {
    throw badRequest("The selected branch manager does not exist.")
  }
  if (!manager.isActive) {
    throw badRequest("The selected branch manager is inactive.")
  }
  if (!MANAGER_ROLES.has(manager.role)) {
    throw badRequest(
      "The selected branch manager must be a branch manager, regional manager or administrator."
    )
  }
}

export async function listBranches(
  scope: AccessScope,
  params: BranchQueryInput
): Promise<{
  items: BranchListItem[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}> {
  const filters: Prisma.BranchWhereInput[] = [branchScopeWhere(scope)]

  if (params.q) {
    filters.push({
      OR: [
        { name: { contains: params.q, mode: "insensitive" } },
        { code: { contains: params.q, mode: "insensitive" } },
        { city: { contains: params.q, mode: "insensitive" } },
      ],
    })
  }
  if (params.country) {
    filters.push({
      country: { equals: params.country, mode: "insensitive" },
    })
  }
  if (params.regionId) {
    filters.push({ regionId: params.regionId })
  }
  if (params.city) {
    filters.push({ city: { equals: params.city, mode: "insensitive" } })
  }
  if (params.status === "active") {
    filters.push({ isActive: true })
  }
  if (params.status === "inactive") {
    filters.push({ isActive: false })
  }

  const where: Prisma.BranchWhereInput = { AND: filters }
  const skip = (params.page - 1) * params.pageSize

  const [total, branches] = await Promise.all([
    prisma.branch.count({ where }),
    prisma.branch.findMany({
      where,
      skip,
      take: params.pageSize,
      orderBy: branchOrderBy(params.sort, params.direction),
      select: {
        id: true,
        code: true,
        name: true,
        country: true,
        state: true,
        city: true,
        email: true,
        phone: true,
        isActive: true,
        createdAt: true,
        region: { select: { id: true, code: true, name: true } },
        manager: { select: { id: true, name: true, email: true } },
        _count: { select: { records: true } },
      },
    }),
  ])

  const branchIds = branches.map((branch) => branch.id)
  const pendingRows = branchIds.length
    ? await prisma.dataRecord.groupBy({
        by: ["branchId"],
        where: {
          branchId: { in: branchIds },
          status: "SUBMITTED",
        },
        _count: { _all: true },
      })
    : []

  const pendingByBranch = new Map<string, number>(
    pendingRows.map(
      (row) => [row.branchId, row._count?._all ?? 0] as const
    )
  )

  const items: BranchListItem[] = branches.map((branch) => ({
    id: branch.id,
    code: branch.code,
    name: branch.name,
    country: branch.country,
    state: branch.state,
    city: branch.city,
    email: branch.email,
    phone: branch.phone,
    isActive: branch.isActive,
    createdAt: branch.createdAt,
    region: branch.region,
    manager: branch.manager,
    recordCount: branch._count.records,
    pendingCount: pendingByBranch.get(branch.id) ?? 0,
  }))

  return {
    items,
    total,
    page: params.page,
    pageSize: params.pageSize,
    totalPages: total === 0 ? 1 : Math.ceil(total / params.pageSize),
  }
}

export async function getBranch(scope: AccessScope, id: string) {
  const branch = await prisma.branch.findFirst({
    where: {
      AND: [{ id }, branchScopeWhere(scope)],
    },
    include: {
      ...branchInclude,
      assignments: {
        select: {
          id: true,
          isPrimary: true,
          jobTitle: true,
          createdAt: true,
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              role: true,
              isActive: true,
            },
          },
        },
        orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }],
      },
      _count: { select: { records: true } },
    },
  })

  if (!branch) {
    throw notFound("Branch not found.")
  }

  const { _count, ...branchData } = branch

  const [statusRows, recentRecords] = await Promise.all([
    prisma.dataRecord.groupBy({
      by: ["status"],
      where: { branchId: branch.id },
      _count: { _all: true },
    }),
    prisma.dataRecord.findMany({
      where: { branchId: branch.id },
      take: 10,
      orderBy: [{ recordDate: "desc" }, { createdAt: "desc" }],
      select: {
        id: true,
        recordNumber: true,
        title: true,
        status: true,
        recordDate: true,
        createdAt: true,
        updatedAt: true,
        category: { select: { id: true, code: true, name: true } },
        createdBy: { select: { id: true, name: true, email: true } },
        submittedBy: { select: { id: true, name: true } },
        approvedBy: { select: { id: true, name: true } },
      },
    }),
  ])

  const statusCounts: Record<string, number> = {}
  for (const status of RECORD_STATUSES) {
    statusCounts[status] = 0
  }
  for (const row of statusRows) {
    statusCounts[row.status] = row._count?._all ?? 0
  }

  return {
    branch: branchData,
    statusCounts,
    recentRecords,
    totalRecords: _count.records,
  }
}

export async function getBranchOptions(
  scope: AccessScope
): Promise<{ id: string; code: string; name: string; regionId: string }[]> {
  return prisma.branch.findMany({
    where: {
      AND: [branchScopeWhere(scope), { isActive: true }],
    },
    select: { id: true, code: true, name: true, regionId: true },
    orderBy: { name: "asc" },
  })
}

export async function getRegionOptions(
  scope: AccessScope
): Promise<{ id: string; code: string; name: string }[]> {
  const where: Prisma.RegionWhereInput = scope.isSuperAdmin
    ? {}
    : {
        OR: [
          { id: { in: scope.regionIds } },
          { branches: { some: { id: { in: scope.branchIds } } } },
        ],
      }

  return prisma.region.findMany({
    where,
    select: { id: true, code: true, name: true },
    orderBy: { name: "asc" },
  })
}

export async function getCountryOptions(scope: AccessScope): Promise<string[]> {
  const rows = await prisma.branch.findMany({
    where: branchScopeWhere(scope),
    distinct: ["country"],
    select: { country: true },
    orderBy: { country: "asc" },
  })

  return rows.map((row) => row.country)
}

export async function createBranch(
  scope: AccessScope,
  input: BranchCreateInput
) {
  assertCanManageBranches(scope)

  const code = input.code.trim().toUpperCase()
  await assertCodeAvailable(code)
  await validateRegion(scope, input.regionId)

  if (input.managerId) {
    await validateManager(input.managerId)
  }

  try {
    const branch = await prisma.branch.create({
      data: {
        code,
        name: input.name,
        country: input.country,
        state: input.state,
        city: input.city,
        address: input.address,
        contactPerson: input.contactPerson,
        email: input.email,
        phone: input.phone,
        regionId: input.regionId,
        managerId: input.managerId ?? null,
        isActive: input.isActive,
      },
      include: branchInclude,
    })

    await writeAudit({
      actorId: scope.userId,
      action: "CREATE",
      entityType: "Branch",
      entityId: branch.id,
      summary: `Created branch ${branch.code} (${branch.name})`,
      metadata: {
        code: branch.code,
        name: branch.name,
        regionId: branch.regionId,
      },
    })

    return branch
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      throw conflict("A branch with this code already exists.")
    }
    throw error
  }
}

export async function updateBranch(
  scope: AccessScope,
  id: string,
  input: BranchUpdateInput
) {
  assertCanManageBranches(scope)

  const existing = await prisma.branch.findFirst({
    where: {
      AND: [{ id }, branchScopeWhere(scope)],
    },
    select: { id: true, code: true, isActive: true },
  })

  if (!existing) {
    throw notFound("Branch not found.")
  }

  const data: Prisma.BranchUncheckedUpdateInput = {}

  if (input.code !== undefined) {
    const code = input.code.trim().toUpperCase()
    if (code !== existing.code) {
      await assertCodeAvailable(code, existing.id)
    }
    data.code = code
  }
  if (input.name !== undefined) data.name = input.name
  if (input.country !== undefined) data.country = input.country
  if (input.state !== undefined) data.state = input.state
  if (input.city !== undefined) data.city = input.city
  if (input.address !== undefined) data.address = input.address
  if (input.contactPerson !== undefined) data.contactPerson = input.contactPerson
  if (input.email !== undefined) data.email = input.email
  if (input.phone !== undefined) data.phone = input.phone
  if (input.regionId !== undefined) {
    await validateRegion(scope, input.regionId)
    data.regionId = input.regionId
  }
  if (input.managerId !== undefined) {
    if (input.managerId === null) {
      data.managerId = null
    } else {
      await validateManager(input.managerId)
      data.managerId = input.managerId
    }
  }
  if (input.isActive !== undefined) data.isActive = input.isActive

  const activationChanged =
    input.isActive !== undefined && input.isActive !== existing.isActive

  try {
    const branch = await prisma.branch.update({
      where: { id: existing.id },
      data,
      include: branchInclude,
    })

    await writeAudit({
      actorId: scope.userId,
      action: activationChanged
        ? input.isActive
          ? "ACTIVATE"
          : "DEACTIVATE"
        : "UPDATE",
      entityType: "Branch",
      entityId: branch.id,
      summary: activationChanged
        ? `${input.isActive ? "Activated" : "Deactivated"} branch ${branch.code}`
        : `Updated branch ${branch.code} (${branch.name})`,
      metadata: {
        code: branch.code,
        changedFields: Object.keys(data),
      },
    })

    return branch
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      throw conflict("A branch with this code already exists.")
    }
    throw error
  }
}

export async function setBranchActive(
  scope: AccessScope,
  id: string,
  isActive: boolean
) {
  assertCanManageBranches(scope)

  const existing = await prisma.branch.findFirst({
    where: {
      AND: [{ id }, branchScopeWhere(scope)],
    },
    select: { id: true },
  })

  if (!existing) {
    throw notFound("Branch not found.")
  }

  const branch = await prisma.branch.update({
    where: { id: existing.id },
    data: { isActive },
    include: branchInclude,
  })

  await writeAudit({
    actorId: scope.userId,
    action: isActive ? "ACTIVATE" : "DEACTIVATE",
    entityType: "Branch",
    entityId: branch.id,
    summary: `${isActive ? "Activated" : "Deactivated"} branch ${branch.code}`,
    metadata: { code: branch.code, isActive },
  })

  return branch
}

export async function listRegions(scope: AccessScope) {
  if (!scope.canManageSettings) {
    throw forbidden("You do not have permission to manage regions.")
  }

  return prisma.region.findMany({
    include: {
      _count: { select: { branches: true, userAssignments: true } },
    },
    orderBy: { name: "asc" },
  })
}

export async function getRegion(scope: AccessScope, id: string) {
  if (!scope.canManageSettings) {
    throw forbidden("You do not have permission to manage regions.")
  }

  const region = await prisma.region.findUnique({
    where: { id },
    select: { id: true, code: true, name: true, description: true },
  })

  if (!region) throw notFound("Region not found.")
  return region
}

export async function createRegion(
  scope: AccessScope,
  input: { code: string; name: string; description?: string }
) {
  if (!scope.canManageSettings) {
    throw forbidden("You do not have permission to manage regions.")
  }

  const code = input.code.trim().toUpperCase()
  const duplicate = await prisma.region.findUnique({
    where: { code },
    select: { id: true },
  })
  if (duplicate) throw conflict("A region with this code already exists.")

  const region = await prisma.region.create({
    data: {
      code,
      name: input.name,
      description: input.description ?? null,
    },
    select: { id: true, code: true, name: true, description: true },
  })

  await writeAudit({
    actorId: scope.userId,
    action: "CREATE",
    entityType: "Region",
    entityId: region.id,
    summary: `Created region ${region.code} (${region.name})`,
  })

  return region
}

export async function updateRegion(
  scope: AccessScope,
  id: string,
  input: { code?: string; name?: string; description?: string | null }
) {
  if (!scope.canManageSettings) {
    throw forbidden("You do not have permission to manage regions.")
  }

  const existing = await prisma.region.findUnique({
    where: { id },
    select: { id: true, code: true, name: true },
  })
  if (!existing) throw notFound("Region not found.")

  if (input.code && input.code.trim().toUpperCase() !== existing.code) {
    const duplicate = await prisma.region.findUnique({
      where: { code: input.code.trim().toUpperCase() },
      select: { id: true },
    })
    if (duplicate) throw conflict("A region with this code already exists.")
  }

  const region = await prisma.region.update({
    where: { id },
    data: {
      ...(input.code !== undefined ? { code: input.code.trim().toUpperCase() } : {}),
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.description !== undefined
        ? { description: input.description || null }
        : {}),
    },
    select: { id: true, code: true, name: true, description: true },
  })

  await writeAudit({
    actorId: scope.userId,
    action: "UPDATE",
    entityType: "Region",
    entityId: id,
    summary: `Updated region ${region.code} (${region.name})`,
    metadata: { changedFields: Object.keys(input) },
  })

  return region
}

function isUniqueConstraintError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: unknown }).code === "P2002"
  )
}
