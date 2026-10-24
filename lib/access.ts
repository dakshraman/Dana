import "server-only"

import type { Prisma } from "@/lib/generated/prisma/client"
import { forbidden } from "@/lib/http"
import {
  canAccessBranch,
  canEditRecord,
  canReviewRecord,
  canSubmitRecord,
  canViewRecord,
  type AccessScope,
  type RecordStatusValue,
} from "@/lib/permissions"

/** Branch list filter for an access scope. Super admins see everything. */
export function branchScopeWhere(scope: AccessScope): Prisma.BranchWhereInput {
  if (scope.isSuperAdmin) return {}
  return { id: { in: scope.branchIds } }
}

/** Record list filter for an access scope. */
export function recordScopeWhere(
  scope: AccessScope
): Prisma.DataRecordWhereInput {
  if (scope.isSuperAdmin) return {}
  return { branchId: { in: scope.branchIds } }
}

/** User list filter: super admins see everyone; others see their branches. */
export function userScopeWhere(scope: AccessScope): Prisma.UserWhereInput {
  if (scope.isSuperAdmin) return {}
  return {
    OR: [
      { branchAssignments: { some: { branchId: { in: scope.branchIds } } } },
      { managedBranches: { some: { id: { in: scope.branchIds } } } },
    ],
  }
}

export function assertBranchAccess(scope: AccessScope, branchId: string) {
  if (!canAccessBranch(scope, branchId)) {
    throw forbidden("You do not have access to this branch.")
  }
}

type RecordAccessShape = {
  branchId: string
  createdById: string
  submittedById: string | null
  status: RecordStatusValue
}

export function assertRecordView(scope: AccessScope, record: RecordAccessShape) {
  if (!canViewRecord(scope, record)) {
    throw forbidden("You do not have access to this record.")
  }
}

export function assertRecordEditable(
  scope: AccessScope,
  record: RecordAccessShape
) {
  if (!canEditRecord(scope, record)) {
    throw forbidden(
      "This record cannot be edited. Only draft or returned records can be changed."
    )
  }
}

export function assertRecordSubmittable(
  scope: AccessScope,
  record: RecordAccessShape
) {
  if (!canSubmitRecord(scope, record)) {
    throw forbidden("This record cannot be submitted by your account.")
  }
}

export function assertCanReview(
  scope: AccessScope,
  record: RecordAccessShape,
  options: { allowSelfApproval: boolean }
) {
  const result = canReviewRecord(scope, record, options)
  if (!result.allowed) {
    throw forbidden(result.reason ?? "You cannot review this record.")
  }
}
