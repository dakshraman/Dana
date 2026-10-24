import { describe, expect, it } from "vitest"

import {
  buildAccessScope,
  canAccessBranch,
  canAccessRegion,
  canArchiveRecord,
  canEditRecord,
  canReviewRecord,
  canSubmitRecord,
  canViewRecord,
} from "@/lib/permissions"

const EMPLOYEE_BRANCH = "branch-employee"
const EMPLOYEE_ID = "user-employee"

function employeeScope() {
  return buildAccessScope({
    userId: EMPLOYEE_ID,
    role: "BRANCH_EMPLOYEE",
    branchIds: [EMPLOYEE_BRANCH],
  })
}

function managerScope() {
  return buildAccessScope({
    userId: "user-manager",
    role: "BRANCH_MANAGER",
    branchIds: [EMPLOYEE_BRANCH],
  })
}

describe("buildAccessScope", () => {
  it("maps roles to capabilities", () => {
    const employee = employeeScope()
    expect(employee.canCreateRecords).toBe(true)
    expect(employee.canApproveRecords).toBe(false)
    expect(employee.canManageUsers).toBe(false)
    expect(employee.canExport).toBe(false)

    const manager = managerScope()
    expect(manager.canApproveRecords).toBe(true)
    expect(manager.canManageUsers).toBe(false)
    expect(manager.canExport).toBe(true)

    const admin = buildAccessScope({ userId: "admin", role: "SUPER_ADMIN" })
    expect(admin.isSuperAdmin).toBe(true)
    expect(admin.canManageSettings).toBe(true)
    expect(admin.canViewAuditLogs).toBe(true)
    expect(canAccessBranch(admin, "anything")).toBe(true)
    expect(canAccessRegion(admin, "anything")).toBe(true)
  })

  it("deduplicates and exposes region and branch assignments", () => {
    const scope = buildAccessScope({
      userId: "u",
      role: "REGIONAL_MANAGER",
      regionIds: ["r1", "r1", "r2"],
      branchIds: ["b1", "b1"],
    })
    expect(scope.regionIds).toEqual(["r1", "r2"])
    expect(scope.branchIds).toEqual(["b1"])
    expect(scope.canCreateRecords).toBe(false)
    expect(scope.canApproveRecords).toBe(true)
  })
})

describe("record permissions", () => {
  const draft = {
    branchId: EMPLOYEE_BRANCH,
    createdById: EMPLOYEE_ID,
    status: "DRAFT" as const,
  }

  it("limits employees to their own drafts", () => {
    const employee = employeeScope()
    expect(canViewRecord(employee, draft)).toBe(true)
    expect(canEditRecord(employee, draft)).toBe(true)
    expect(canSubmitRecord(employee, draft)).toBe(true)
    expect(
      canEditRecord(employee, { ...draft, createdById: "someone-else" })
    ).toBe(false)
    expect(canEditRecord(employee, { ...draft, status: "SUBMITTED" })).toBe(false)
  })

  it("lets managers edit editable records in scope only", () => {
    const manager = managerScope()
    expect(canEditRecord(manager, { ...draft, createdById: "someone-else" })).toBe(
      true
    )
    expect(
      canEditRecord(manager, { ...draft, branchId: "another-branch" })
    ).toBe(false)
    expect(canEditRecord(manager, { ...draft, status: "APPROVED" })).toBe(false)
  })

  it("blocks self-approval unless explicitly allowed", () => {
    const manager = managerScope()
    const record = {
      ...draft,
      status: "SUBMITTED" as const,
      submittedById: manager.userId,
    }

    expect(canReviewRecord(manager, record)).toEqual({
      allowed: false,
      reason: "You cannot review a record you submitted.",
    })
    expect(
      canReviewRecord(manager, record, { allowSelfApproval: true }).allowed
    ).toBe(true)
  })

  it("rejects review outside scope and for non-submitted records", () => {
    const manager = managerScope()
    const base = {
      ...draft,
      createdById: "other-user",
      submittedById: "other-user",
      status: "SUBMITTED" as const,
    }

    expect(canReviewRecord(manager, base).allowed).toBe(true)
    expect(
      canReviewRecord(manager, { ...base, branchId: "other-branch" }).allowed
    ).toBe(false)
    expect(
      canReviewRecord(manager, { ...base, status: "DRAFT" }).allowed
    ).toBe(false)
  })

  it("prevents archiving submitted and archived records", () => {
    const manager = managerScope()
    expect(canArchiveRecord(manager, draft)).toBe(true)
    expect(
      canArchiveRecord(manager, { ...draft, status: "SUBMITTED" })
    ).toBe(false)
    expect(
      canArchiveRecord(manager, { ...draft, status: "ARCHIVED" })
    ).toBe(false)
  })
})
