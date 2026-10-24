import "server-only"

import type {
  CustomFieldDefinition,
  Prisma,
} from "@/lib/generated/prisma/client"
import type { NotificationType } from "@/lib/generated/prisma/enums"
import {
  assertBranchAccess,
  assertCanReview,
  assertRecordEditable,
  assertRecordSubmittable,
  branchScopeWhere,
  recordScopeWhere,
} from "@/lib/access"
import { writeAudit } from "@/lib/audit"
import { prisma } from "@/lib/db"
import { badRequest, conflict, forbidden, notFound } from "@/lib/http"
import { notifyUsers, reviewerIdsForBranch } from "@/lib/notifications"
import { canArchiveRecord, canViewRecord } from "@/lib/permissions"
import type { AccessScope } from "@/lib/permissions"
import {
  missingRequiredFields,
  parseDateOnly,
  serializeRecordValues,
  validateRecordValues,
  type ValidatedRecordValue,
} from "@/lib/records/fields"
import { nextRecordNumber } from "@/lib/records/numbering"
import { getSystemSettings } from "@/lib/settings"
import type {
  RecordCreateInput,
  RecordQueryInput,
  RecordUpdateInput,
  ReviewInput,
} from "@/lib/validations/record"

export type RecordListParams = RecordQueryInput

const recordListInclude = {
  branch: {
    select: {
      id: true,
      code: true,
      name: true,
      region: { select: { id: true, code: true, name: true } },
    },
  },
  category: { select: { id: true, name: true } },
  createdBy: { select: { id: true, name: true } },
  submittedBy: { select: { id: true, name: true } },
  _count: { select: { attachments: true } },
} satisfies Prisma.DataRecordInclude

const userSummarySelect = {
  id: true,
  name: true,
  role: true,
} satisfies Prisma.UserSelect

export async function listRecords(
  scope: AccessScope,
  params: RecordListParams
) {
  return queryRecords(scope, params)
}

export async function getRecord(scope: AccessScope, id: string) {
  const record = await prisma.dataRecord.findUnique({
    where: { id },
    include: {
      branch: {
        select: {
          id: true,
          code: true,
          name: true,
          region: { select: { id: true, code: true, name: true } },
        },
      },
      category: {
        select: { id: true, code: true, name: true, isActive: true },
      },
      values: {
        include: { fieldDefinition: true },
        orderBy: [
          { fieldDefinition: { sortOrder: "asc" } },
          { fieldDefinition: { label: "asc" } },
        ],
      },
      approvals: {
        include: { actor: { select: userSummarySelect } },
        orderBy: { createdAt: "asc" },
      },
      attachments: {
        // Never load inline attachment bytes with the record.
        select: {
          id: true,
          fileName: true,
          mimeType: true,
          size: true,
          createdAt: true,
          uploadedBy: { select: { id: true, name: true } },
        },
        orderBy: { createdAt: "desc" },
      },
      createdBy: { select: userSummarySelect },
      updatedBy: { select: userSummarySelect },
      submittedBy: { select: userSummarySelect },
      approvedBy: { select: userSummarySelect },
    },
  })

  if (!record || !canViewRecord(scope, record)) {
    throw notFound("Record not found.")
  }

  return record
}

const recordCategoryFormSelect = {
  id: true,
  code: true,
  name: true,
  description: true,
  fields: {
    select: {
      id: true,
      key: true,
      label: true,
      type: true,
      required: true,
      options: true,
      placeholder: true,
      helpText: true,
      minValue: true,
      maxValue: true,
      maxLength: true,
      sortOrder: true,
    },
    orderBy: [{ sortOrder: "asc" }, { label: "asc" }],
  },
} satisfies Prisma.RecordCategorySelect

/** Category + every field, including inactive ones, for editing old records. */
export async function getRecordCategoryWithFields(categoryId: string) {
  return prisma.recordCategory.findUnique({
    where: { id: categoryId },
    select: recordCategoryFormSelect,
  })
}

export async function getRecordFormData(scope: AccessScope) {
  const [branches, categories] = await Promise.all([
    prisma.branch.findMany({
      where: { ...branchScopeWhere(scope), isActive: true },
      select: {
        id: true,
        code: true,
        name: true,
        region: { select: { id: true, code: true, name: true } },
      },
      orderBy: { name: "asc" },
    }),
    prisma.recordCategory.findMany({
      where: { isActive: true },
      select: {
        ...recordCategoryFormSelect,
        fields: {
          ...recordCategoryFormSelect.fields,
          where: { isActive: true },
        },
      },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    }),
  ])

  return { branches, categories }
}

export async function createRecord(
  scope: AccessScope,
  actor: { id: string },
  input: RecordCreateInput
) {
  if (!scope.canCreateRecords) {
    throw forbidden("You do not have permission to create records.")
  }

  const branch = await prisma.branch.findUnique({
    where: { id: input.branchId },
    select: { id: true, code: true, name: true, isActive: true },
  })

  if (!branch) throw notFound("Branch not found.")
  assertBranchAccess(scope, branch.id)
  if (!branch.isActive) {
    throw badRequest("The selected branch is inactive.")
  }

  const category = await prisma.recordCategory.findUnique({
    where: { id: input.categoryId },
    include: {
      fields: {
        orderBy: [{ sortOrder: "asc" }, { label: "asc" }],
      },
    },
  })

  if (!category) throw notFound("Record category not found.")
  if (!category.isActive) {
    throw badRequest("The selected record category is inactive.")
  }

  const recordDate = parseDateOnlyOrThrow(input.recordDate)
  const title = input.title.trim()
  const validatedValues = validateRecordValues(category.fields, input.values)
  const submit = input.submit
  const now = new Date()

  const created = await prisma.$transaction(async (tx) => {
    const recordNumber = await nextRecordNumber(
      tx,
      branch.id,
      branch.code,
      recordDate
    )

    return tx.dataRecord.create({
      data: {
        recordNumber,
        branchId: branch.id,
        categoryId: category.id,
        recordDate,
        title,
        referenceNumber: normalizeOptional(input.referenceNumber),
        remarks: normalizeOptional(input.remarks),
        status: submit ? "SUBMITTED" : "DRAFT",
        createdById: actor.id,
        updatedById: actor.id,
        submittedById: submit ? actor.id : null,
        submittedAt: submit ? now : null,
        values:
          validatedValues.length > 0
            ? { create: validatedValues }
            : undefined,
        approvals: submit
          ? {
              create: {
                actorId: actor.id,
                action: "SUBMITTED",
                fromStatus: "DRAFT",
                toStatus: "SUBMITTED",
              },
            }
          : undefined,
      },
      select: { id: true, recordNumber: true },
    })
  })

  await writeAudit({
    actorId: actor.id,
    action: "CREATE",
    entityType: "DataRecord",
    entityId: created.id,
    summary: `Created record ${created.recordNumber} (${title})`,
    metadata: {
      recordNumber: created.recordNumber,
      branchId: branch.id,
      categoryId: category.id,
      status: submit ? "SUBMITTED" : "DRAFT",
    },
  })

  if (submit) {
    await writeAudit({
      actorId: actor.id,
      action: "SUBMIT",
      entityType: "DataRecord",
      entityId: created.id,
      summary: `Submitted record ${created.recordNumber} for review`,
      metadata: { recordNumber: created.recordNumber },
    })

    const reviewerIds = await reviewerIdsForBranch(branch.id, actor.id)
    await notifyUsers(reviewerIds, {
      type: "RECORD_SUBMITTED",
      title: "Record submitted for review",
      message: `Record ${created.recordNumber} (${title}) was submitted for review.`,
    })
  }

  return getRecord(scope, created.id)
}

export async function updateRecord(
  scope: AccessScope,
  actor: { id: string },
  id: string,
  input: RecordUpdateInput
) {
  const existing = await prisma.dataRecord.findUnique({
    where: { id },
    select: {
      id: true,
      recordNumber: true,
      branchId: true,
      categoryId: true,
      status: true,
      createdById: true,
      submittedById: true,
    },
  })

  if (!existing) throw notFound("Record not found.")
  assertRecordEditable(scope, existing)

  const targetCategoryId = input.categoryId ?? existing.categoryId
  const categoryChanged = targetCategoryId !== existing.categoryId
  let targetFields: CustomFieldDefinition[] | null = null

  if (categoryChanged) {
    const category = await prisma.recordCategory.findUnique({
      where: { id: targetCategoryId },
      select: { id: true, isActive: true },
    })

    if (!category) throw notFound("Record category not found.")
    if (!category.isActive) {
      throw badRequest("The selected record category is inactive.")
    }

    targetFields = await fieldsForCategory(targetCategoryId)
  }

  const replacesValues = input.values !== undefined || categoryChanged
  let validatedValues: ValidatedRecordValue[] = []

  if (replacesValues) {
    const fields =
      targetFields ?? (await fieldsForCategory(targetCategoryId))
    validatedValues = validateRecordValues(fields, input.values ?? {})
  }

  const recordDate = input.recordDate
    ? parseDateOnlyOrThrow(input.recordDate)
    : undefined
  const title = input.title !== undefined ? input.title.trim() : undefined

  await prisma.$transaction(async (tx) => {
    if (replacesValues) {
      // Deactivated fields are not part of the submitted form. Keep their
      // historical values unless the whole category is being replaced.
      await tx.recordValue.deleteMany({
        where: {
          recordId: id,
          ...(categoryChanged ? {} : { fieldDefinition: { isActive: true } }),
        },
      })

      if (validatedValues.length > 0) {
        await tx.recordValue.createMany({
          data: validatedValues.map((value) => ({ ...value, recordId: id })),
        })
      }
    }

    await tx.dataRecord.update({
      where: { id },
      data: {
        ...(input.categoryId !== undefined
          ? { categoryId: input.categoryId }
          : {}),
        ...(recordDate ? { recordDate } : {}),
        ...(title !== undefined ? { title } : {}),
        ...(input.referenceNumber !== undefined
          ? { referenceNumber: normalizeOptional(input.referenceNumber) }
          : {}),
        ...(input.remarks !== undefined
          ? { remarks: normalizeOptional(input.remarks) }
          : {}),
        updatedById: actor.id,
      },
    })
  })

  const changedFields = (
    [
      "categoryId",
      "recordDate",
      "title",
      "referenceNumber",
      "remarks",
      "values",
    ] as const
  ).filter((key) => input[key] !== undefined)

  await writeAudit({
    actorId: actor.id,
    action: "UPDATE",
    entityType: "DataRecord",
    entityId: id,
    summary: `Updated record ${existing.recordNumber}`,
    metadata: {
      recordNumber: existing.recordNumber,
      changedFields,
    },
  })

  return getRecord(scope, id)
}

export async function submitRecord(
  scope: AccessScope,
  actor: { id: string },
  id: string,
  comment?: string
) {
  const record = await prisma.dataRecord.findUnique({
    where: { id },
    select: {
      id: true,
      recordNumber: true,
      title: true,
      branchId: true,
      categoryId: true,
      status: true,
      createdById: true,
      submittedById: true,
      values: { include: { fieldDefinition: true } },
    },
  })

  if (!record) throw notFound("Record not found.")
  assertRecordSubmittable(scope, record)

  const fields = await fieldsForCategory(record.categoryId)
  const currentValues = serializeRecordValues(record.values, fields)
  const missing = missingRequiredFields(fields, currentValues)

  if (missing.length > 0) {
    throw badRequest(
      `Complete the required fields before submitting: ${missing
        .map((field) => field.label)
        .join(", ")}.`
    )
  }

  const resubmission = record.status === "RETURNED"
  const historyAction = resubmission ? "RESUBMITTED" : "SUBMITTED"
  const trimmedComment = normalizeOptional(comment)
  const now = new Date()

  await prisma.$transaction([
    prisma.dataRecord.update({
      where: { id },
      data: {
        status: "SUBMITTED",
        submittedAt: now,
        submittedById: actor.id,
        approvedAt: null,
        approvedById: null,
        updatedById: actor.id,
      },
    }),
    prisma.approvalHistory.create({
      data: {
        recordId: id,
        actorId: actor.id,
        action: historyAction,
        fromStatus: record.status,
        toStatus: "SUBMITTED",
        comment: trimmedComment,
      },
    }),
  ])

  await writeAudit({
    actorId: actor.id,
    action: "SUBMIT",
    entityType: "DataRecord",
    entityId: id,
    summary: `${resubmission ? "Resubmitted" : "Submitted"} record ${
      record.recordNumber
    } for review`,
    metadata: {
      recordNumber: record.recordNumber,
      fromStatus: record.status,
    },
  })

  const reviewerIds = await reviewerIdsForBranch(record.branchId, actor.id)
  await notifyUsers(reviewerIds, {
    type: "RECORD_SUBMITTED",
    title: resubmission
      ? "Record resubmitted for review"
      : "Record submitted for review",
    message: `Record ${record.recordNumber} (${record.title}) was ${
      resubmission ? "resubmitted" : "submitted"
    } for review.`,
  })

  return getRecord(scope, id)
}

export async function reviewRecord(
  scope: AccessScope,
  actor: { id: string },
  id: string,
  input: ReviewInput
) {
  const settings = await getSystemSettings()
  const record = await prisma.dataRecord.findUnique({
    where: { id },
    select: {
      id: true,
      recordNumber: true,
      title: true,
      branchId: true,
      status: true,
      createdById: true,
      submittedById: true,
    },
  })

  if (!record) throw notFound("Record not found.")
  assertCanReview(scope, record, {
    allowSelfApproval: settings.allowSelfApproval,
  })

  const comment = normalizeOptional(input.comment)
  if (input.decision !== "APPROVE" && !comment) {
    throw badRequest(
      "A comment is required when rejecting or returning a record."
    )
  }

  const nextStatus =
    input.decision === "APPROVE"
      ? ("APPROVED" as const)
      : input.decision === "REJECT"
        ? ("REJECTED" as const)
        : ("RETURNED" as const)

  const notificationType: NotificationType =
    nextStatus === "APPROVED"
      ? "RECORD_APPROVED"
      : nextStatus === "REJECTED"
        ? "RECORD_REJECTED"
        : "RECORD_RETURNED"

  const notificationTitle =
    nextStatus === "APPROVED"
      ? "Record approved"
      : nextStatus === "REJECTED"
        ? "Record rejected"
        : "Record returned for changes"

  const notificationMessage = `Record ${record.recordNumber} (${
    record.title
  }) was ${nextStatus.toLowerCase()}.${comment ? ` Comment: ${comment}` : ""}`

  const auditAction =
    nextStatus === "APPROVED"
      ? ("APPROVE" as const)
      : nextStatus === "REJECTED"
        ? ("REJECT" as const)
        : ("RETURN" as const)

  const now = new Date()

  await prisma.$transaction([
    prisma.dataRecord.update({
      where: { id },
      data: {
        status: nextStatus,
        approvedById: nextStatus === "APPROVED" ? actor.id : null,
        approvedAt: nextStatus === "APPROVED" ? now : null,
        updatedById: actor.id,
      },
    }),
    prisma.approvalHistory.create({
      data: {
        recordId: id,
        actorId: actor.id,
        action: nextStatus,
        fromStatus: record.status,
        toStatus: nextStatus,
        comment,
      },
    }),
  ])

  await writeAudit({
    actorId: actor.id,
    action: auditAction,
    entityType: "DataRecord",
    entityId: id,
    summary: `${
      nextStatus === "APPROVED"
        ? "Approved"
        : nextStatus === "REJECTED"
          ? "Rejected"
          : "Returned"
    } record ${record.recordNumber}`,
    metadata: {
      recordNumber: record.recordNumber,
      decision: input.decision,
      fromStatus: record.status,
      toStatus: nextStatus,
    },
  })

  const recipientIds = [record.createdById, record.submittedById].filter(
    (userId): userId is string => Boolean(userId)
  )

  await notifyUsers(recipientIds, {
    type: notificationType,
    title: notificationTitle,
    message: notificationMessage,
  })

  return getRecord(scope, id)
}

export async function archiveRecord(
  scope: AccessScope,
  actor: { id: string },
  id: string,
  reason?: string
) {
  const record = await prisma.dataRecord.findUnique({
    where: { id },
    select: {
      id: true,
      recordNumber: true,
      branchId: true,
      status: true,
    },
  })

  if (!record) throw notFound("Record not found.")
  if (!canViewRecord(scope, record)) {
    throw notFound("Record not found.")
  }

  if (!canArchiveRecord(scope, record)) {
    if (record.status === "ARCHIVED") {
      throw conflict("This record is already archived.")
    }
    throw forbidden("You cannot archive this record.")
  }

  if (record.status === "SUBMITTED") {
    throw conflict(
      "A submitted record must be reviewed before it can be archived."
    )
  }

  const trimmedReason = normalizeOptional(reason)
  const now = new Date()

  await prisma.$transaction([
    prisma.dataRecord.update({
      where: { id },
      data: {
        status: "ARCHIVED",
        archivedAt: now,
        updatedById: actor.id,
      },
    }),
    prisma.approvalHistory.create({
      data: {
        recordId: id,
        actorId: actor.id,
        action: "ARCHIVED",
        fromStatus: record.status,
        toStatus: "ARCHIVED",
        comment: trimmedReason,
      },
    }),
  ])

  await writeAudit({
    actorId: actor.id,
    action: "ARCHIVE",
    entityType: "DataRecord",
    entityId: id,
    summary: `Archived record ${record.recordNumber}`,
    metadata: {
      recordNumber: record.recordNumber,
      fromStatus: record.status,
      reason: trimmedReason,
    },
  })

  return getRecord(scope, id)
}

export async function restoreRecord(
  scope: AccessScope,
  actor: { id: string },
  id: string
) {
  if (!scope.canManageBranches && scope.role !== "BRANCH_MANAGER") {
    throw forbidden(
      "Only administrators and branch managers can restore archived records."
    )
  }

  const record = await prisma.dataRecord.findUnique({
    where: { id },
    select: {
      id: true,
      recordNumber: true,
      branchId: true,
      status: true,
    },
  })

  if (!record || !canViewRecord(scope, record)) {
    throw notFound("Record not found.")
  }

  if (record.status !== "ARCHIVED") {
    throw conflict("Only archived records can be restored.")
  }

  await prisma.$transaction([
    prisma.dataRecord.update({
      where: { id },
      data: {
        status: "DRAFT",
        archivedAt: null,
        submittedAt: null,
        submittedById: null,
        approvedAt: null,
        approvedById: null,
        updatedById: actor.id,
      },
    }),
    prisma.approvalHistory.create({
      data: {
        recordId: id,
        actorId: actor.id,
        action: "RESTORED",
        fromStatus: "ARCHIVED",
        toStatus: "DRAFT",
        comment: null,
      },
    }),
  ])

  await writeAudit({
    actorId: actor.id,
    action: "RESTORE",
    entityType: "DataRecord",
    entityId: id,
    summary: `Restored archived record ${record.recordNumber}`,
    metadata: { recordNumber: record.recordNumber },
  })

  return getRecord(scope, id)
}

export async function getApprovalQueue(
  scope: AccessScope,
  params: RecordListParams
) {
  if (!scope.canApproveRecords) {
    throw forbidden("You do not have permission to review records.")
  }

  const settings = await getSystemSettings()
  const reviewableWhere: Prisma.DataRecordWhereInput =
    settings.allowSelfApproval
      ? {}
      : {
          OR: [
            { submittedById: { not: scope.userId } },
            {
              submittedById: null,
              createdById: { not: scope.userId },
            },
          ],
        }

  return queryRecords(
    scope,
    { ...params, status: "SUBMITTED" },
    reviewableWhere
  )
}

async function queryRecords(
  scope: AccessScope,
  params: RecordQueryInput,
  extraWhere?: Prisma.DataRecordWhereInput
) {
  const where = buildRecordWhere(scope, params, extraWhere)
  const skip = (params.page - 1) * params.pageSize

  const [items, total] = await prisma.$transaction([
    prisma.dataRecord.findMany({
      where,
      include: recordListInclude,
      orderBy: recordOrderBy(params.sort, params.direction),
      skip,
      take: params.pageSize,
    }),
    prisma.dataRecord.count({ where }),
  ])

  return {
    items,
    total,
    page: params.page,
    pageSize: params.pageSize,
    totalPages: Math.ceil(total / params.pageSize),
  }
}

/**
 * Scope is always the first AND term, so branch/region filters can only narrow
 * the result set and can never widen it.
 */
function buildRecordWhere(
  scope: AccessScope,
  params: RecordQueryInput,
  extraWhere?: Prisma.DataRecordWhereInput
): Prisma.DataRecordWhereInput {
  const filters: Prisma.DataRecordWhereInput[] = [recordScopeWhere(scope)]

  filters.push(
    params.status === "all"
      ? { status: { not: "ARCHIVED" } }
      : { status: params.status }
  )

  if (params.branchId) filters.push({ branchId: params.branchId })
  if (params.categoryId) filters.push({ categoryId: params.categoryId })

  if (params.q) {
    filters.push({
      OR: [
        { recordNumber: { contains: params.q, mode: "insensitive" } },
        { title: { contains: params.q, mode: "insensitive" } },
        { referenceNumber: { contains: params.q, mode: "insensitive" } },
      ],
    })
  }

  if (params.regionId || params.country || params.city) {
    const branchFilter: Prisma.BranchWhereInput = {}
    if (params.regionId) branchFilter.regionId = params.regionId
    if (params.country) {
      branchFilter.country = {
        equals: params.country,
        mode: "insensitive",
      }
    }
    if (params.city) {
      branchFilter.city = { equals: params.city, mode: "insensitive" }
    }
    filters.push({ branch: { is: branchFilter } })
  }

  if (params.from || params.to) {
    if (params.from && params.to && params.from > params.to) {
      throw badRequest("The start date must be on or before the end date.")
    }

    const dateFilter: Prisma.DateTimeFilter<"DataRecord"> = {}
    if (params.from) {
      dateFilter.gte = parseDateOnlyOrThrow(params.from)
    }
    if (params.to) {
      const to = parseDateOnlyOrThrow(params.to)
      to.setUTCHours(23, 59, 59, 999)
      dateFilter.lte = to
    }
    filters.push({ recordDate: dateFilter })
  }

  if (extraWhere && Object.keys(extraWhere).length > 0) {
    filters.push(extraWhere)
  }

  return { AND: filters }
}

function recordOrderBy(
  sort: RecordQueryInput["sort"],
  direction: Prisma.SortOrder
): Prisma.DataRecordOrderByWithRelationInput[] {
  switch (sort) {
    case "recordDate":
      return [{ recordDate: direction }, { id: "desc" }]
    case "recordNumber":
      return [{ recordNumber: direction }, { id: "desc" }]
    case "title":
      return [{ title: direction }, { id: "desc" }]
    case "status":
      return [{ status: direction }, { id: "desc" }]
    case "updatedAt":
      return [{ updatedAt: direction }, { id: "desc" }]
    case "createdAt":
    default:
      return [{ createdAt: direction }, { id: "desc" }]
  }
}

async function fieldsForCategory(categoryId: string) {
  return prisma.customFieldDefinition.findMany({
    where: { categoryId },
    orderBy: [{ sortOrder: "asc" }, { label: "asc" }],
  })
}

function parseDateOnlyOrThrow(value: string): Date {
  const date = parseDateOnly(value)
  if (!date) {
    throw badRequest("Use a valid date in YYYY-MM-DD format.")
  }
  return date
}

function normalizeOptional(value: string | null | undefined): string | null {
  const trimmed = value?.trim()
  return trimmed ? trimmed : null
}
