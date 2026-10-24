/**
 * Pure permission helpers. No database or framework imports so this module can
 * be unit tested in isolation and safely reasoned about.
 *
 * Server-side data filtering lives in `lib/access.ts`; this file answers
 * "may this actor perform this action?" and is used by both the UI (to hide
 * impossible actions) and the server (to enforce them).
 */

export const ROLES = [
  "SUPER_ADMIN",
  "REGIONAL_MANAGER",
  "BRANCH_MANAGER",
  "BRANCH_EMPLOYEE",
] as const

export type AppRole = (typeof ROLES)[number]

export const RECORD_STATUSES = [
  "DRAFT",
  "SUBMITTED",
  "APPROVED",
  "REJECTED",
  "RETURNED",
  "ARCHIVED",
] as const

export type RecordStatusValue = (typeof RECORD_STATUSES)[number]

export type AccessScope = {
  userId: string
  role: AppRole
  isSuperAdmin: boolean
  regionIds: string[]
  branchIds: string[]
  canManageBranches: boolean
  canManageUsers: boolean
  canManageSettings: boolean
  canViewAuditLogs: boolean
  canCreateRecords: boolean
  canApproveRecords: boolean
  canExport: boolean
  canViewAllBranchRecords: boolean
}

export const ROLE_LABELS: Record<AppRole, string> = {
  SUPER_ADMIN: "Super Admin",
  REGIONAL_MANAGER: "Regional Manager",
  BRANCH_MANAGER: "Branch Manager",
  BRANCH_EMPLOYEE: "Branch Employee",
}

const BASE_CAPABILITIES: Record<
  AppRole,
  Pick<
    AccessScope,
    | "canManageBranches"
    | "canManageUsers"
    | "canManageSettings"
    | "canViewAuditLogs"
    | "canCreateRecords"
    | "canApproveRecords"
    | "canExport"
    | "canViewAllBranchRecords"
  >
> = {
  SUPER_ADMIN: {
    canManageBranches: true,
    canManageUsers: true,
    canManageSettings: true,
    canViewAuditLogs: true,
    canCreateRecords: true,
    canApproveRecords: true,
    canExport: true,
    canViewAllBranchRecords: true,
  },
  REGIONAL_MANAGER: {
    canManageBranches: false,
    canManageUsers: false,
    canManageSettings: false,
    canViewAuditLogs: false,
    canCreateRecords: false,
    canApproveRecords: true,
    canExport: true,
    canViewAllBranchRecords: true,
  },
  BRANCH_MANAGER: {
    canManageBranches: false,
    canManageUsers: false,
    canManageSettings: false,
    canViewAuditLogs: false,
    canCreateRecords: true,
    canApproveRecords: true,
    canExport: true,
    canViewAllBranchRecords: true,
  },
  BRANCH_EMPLOYEE: {
    canManageBranches: false,
    canManageUsers: false,
    canManageSettings: false,
    canViewAuditLogs: false,
    canCreateRecords: true,
    canApproveRecords: false,
    canExport: false,
    canViewAllBranchRecords: true,
  },
}

export function buildAccessScope(input: {
  userId: string
  role: AppRole
  regionIds?: string[]
  branchIds?: string[]
}): AccessScope {
  const regionIds = unique(input.regionIds ?? [])
  const branchIds = unique(input.branchIds ?? [])
  const capabilities = BASE_CAPABILITIES[input.role]

  return {
    userId: input.userId,
    role: input.role,
    isSuperAdmin: input.role === "SUPER_ADMIN",
    regionIds,
    branchIds,
    ...capabilities,
  }
}

export function unique(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))]
}

export function canAccessBranch(scope: AccessScope, branchId: string): boolean {
  if (scope.isSuperAdmin) return true
  return scope.branchIds.includes(branchId)
}

export function canAccessRegion(scope: AccessScope, regionId: string): boolean {
  if (scope.isSuperAdmin) return true
  return scope.regionIds.includes(regionId)
}

/** Whether the actor may see a record at all. */
export function canViewRecord(
  scope: AccessScope,
  record: { branchId: string }
): boolean {
  return canAccessBranch(scope, record.branchId)
}

/**
 * Records are editable only while they are DRAFT or RETURNED. Employees may
 * only edit records they created; managers and admins may edit any editable
 * record inside their scope.
 */
export function canEditRecord(
  scope: AccessScope,
  record: { branchId: string; createdById: string; status: RecordStatusValue }
): boolean {
  if (!canViewRecord(scope, record)) return false
  if (record.status !== "DRAFT" && record.status !== "RETURNED") return false
  if (scope.role === "BRANCH_EMPLOYEE") {
    return record.createdById === scope.userId
  }
  return scope.canCreateRecords
}

export function canSubmitRecord(
  scope: AccessScope,
  record: { branchId: string; createdById: string; status: RecordStatusValue }
): boolean {
  if (!canViewRecord(scope, record)) return false
  if (record.status !== "DRAFT" && record.status !== "RETURNED") return false
  if (scope.role === "BRANCH_EMPLOYEE") {
    return record.createdById === scope.userId
  }
  return scope.canCreateRecords
}

/** Whether the actor may approve/reject/return this submission. */
export function canReviewRecord(
  scope: AccessScope,
  record: {
    branchId: string
    createdById: string
    submittedById: string | null
    status: RecordStatusValue
  },
  options: { allowSelfApproval: boolean } = { allowSelfApproval: false }
): { allowed: boolean; reason?: string } {
  if (!scope.canApproveRecords) {
    return { allowed: false, reason: "You do not have approval permission." }
  }
  if (!canViewRecord(scope, record)) {
    return { allowed: false, reason: "This record is outside your branch access." }
  }
  if (record.status !== "SUBMITTED") {
    return { allowed: false, reason: "Only submitted records can be reviewed." }
  }

  const submitterId = record.submittedById ?? record.createdById
  if (!options.allowSelfApproval && submitterId === scope.userId) {
    return {
      allowed: false,
      reason: "You cannot review a record you submitted.",
    }
  }

  return { allowed: true }
}

export function canArchiveRecord(
  scope: AccessScope,
  record: { branchId: string; status: RecordStatusValue }
): boolean {
  if (!canViewRecord(scope, record)) return false
  if (!scope.canCreateRecords) return false
  return record.status !== "ARCHIVED" && record.status !== "SUBMITTED"
}

export function canExportScope(scope: AccessScope): boolean {
  return scope.canExport
}

/** Human readable label for a status, used in tables and badge styling. */
export const STATUS_LABELS: Record<RecordStatusValue, string> = {
  DRAFT: "Draft",
  SUBMITTED: "Submitted",
  APPROVED: "Approved",
  REJECTED: "Rejected",
  RETURNED: "Returned",
  ARCHIVED: "Archived",
}
