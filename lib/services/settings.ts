import "server-only"

import type { Prisma } from "@/lib/generated/prisma/client"
import { writeAudit } from "@/lib/audit"
import { prisma } from "@/lib/db"
import { badRequest, conflict, forbidden, notFound } from "@/lib/http"
import { SETTING_KEYS } from "@/lib/settings"
import type { AccessScope } from "@/lib/permissions"
import type {
  CategoryCreateInput,
  CustomFieldInput,
  SystemSettingsInput,
} from "@/lib/validations/settings"

function categoryInclude(includeInactiveFields: boolean) {
  return {
    fields: {
      ...(includeInactiveFields ? {} : { where: { isActive: true } }),
      orderBy: [{ sortOrder: "asc" }, { label: "asc" }],
    },
    _count: { select: { records: true } },
  } satisfies Prisma.RecordCategoryInclude
}

function assertCanManageSettings(scope: AccessScope) {
  if (!scope.canManageSettings) {
    throw forbidden("You do not have permission to manage settings.")
  }
}

function assertUniqueFieldKeys(fields: CustomFieldInput[]) {
  const keys = new Set<string>()
  const ids = new Set<string>()

  for (const field of fields) {
    const key = field.key.trim()

    if (!key) {
      throw badRequest("Every field needs a key.")
    }
    if (keys.has(key)) {
      throw badRequest(`Duplicate field key "${key}".`)
    }
    keys.add(key)

    if (field.id) {
      if (ids.has(field.id)) {
        throw badRequest("The same field appears more than once.")
      }
      ids.add(field.id)
    }
  }
}

function validateFieldInput(field: CustomFieldInput) {
  if (field.type === "SELECT" && (field.options ?? []).length === 0) {
    throw badRequest(`Select field "${field.label}" needs at least one option.`)
  }

  if (
    field.minValue !== undefined &&
    field.maxValue !== undefined &&
    field.minValue > field.maxValue
  ) {
    throw badRequest(
      `Field "${field.label}" has a maximum below its minimum.`
    )
  }
}

function fieldData(field: CustomFieldInput) {
  return {
    key: field.key.trim(),
    label: field.label,
    type: field.type,
    required: field.required,
    options: field.options ?? [],
    placeholder: field.placeholder ?? null,
    helpText: field.helpText ?? null,
    minValue: field.minValue ?? null,
    maxValue: field.maxValue ?? null,
    maxLength: field.maxLength ?? null,
    sortOrder: field.sortOrder,
    isActive: field.isActive,
  }
}

async function assertCategoryCodeAvailable(code: string, excludeId?: string) {
  const existing = await prisma.recordCategory.findUnique({
    where: { code },
    select: { id: true },
  })

  if (existing && existing.id !== excludeId) {
    throw conflict("A category with this code already exists.")
  }
}

export async function listCategories(scope: AccessScope) {
  const includeInactive = scope.canManageSettings

  return prisma.recordCategory.findMany({
    where: includeInactive ? {} : { isActive: true },
    include: categoryInclude(includeInactive),
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
  })
}

export async function getCategory(scope: AccessScope, id: string) {
  const includeInactive = scope.canManageSettings

  const category = await prisma.recordCategory.findFirst({
    where: {
      id,
      ...(includeInactive ? {} : { isActive: true }),
    },
    include: categoryInclude(includeInactive),
  })

  if (!category) {
    throw notFound("Category not found.")
  }

  return category
}

export async function createCategory(
  scope: AccessScope,
  input: CategoryCreateInput
) {
  assertCanManageSettings(scope)

  const code = input.code.trim().toUpperCase()
  const fields = input.fields ?? []

  await assertCategoryCodeAvailable(code)
  assertUniqueFieldKeys(fields)
  for (const field of fields) {
    validateFieldInput(field)
  }

  try {
    const category = await prisma.recordCategory.create({
      data: {
        code,
        name: input.name,
        description: input.description ?? null,
        isActive: input.isActive,
        sortOrder: input.sortOrder,
        fields: {
          create: fields.map((field) => fieldData(field)),
        },
      },
      include: categoryInclude(true),
    })

    await writeAudit({
      actorId: scope.userId,
      action: "CREATE",
      entityType: "RecordCategory",
      entityId: category.id,
      summary: `Created record category ${category.code} (${category.name})`,
      metadata: {
        code: category.code,
        name: category.name,
        fieldKeys: fields.map((field) => field.key.trim()),
      },
    })

    return category
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      throw conflict("The category code or a field key already exists.")
    }
    throw error
  }
}

export async function updateCategory(
  scope: AccessScope,
  id: string,
  input: Partial<CategoryCreateInput>
) {
  assertCanManageSettings(scope)

  const existing = await prisma.recordCategory.findUnique({
    where: { id },
    include: { fields: true },
  })

  if (!existing) {
    throw notFound("Category not found.")
  }

  const code = input.code?.trim().toUpperCase()
  if (code !== undefined && code !== existing.code) {
    await assertCategoryCodeAvailable(code, existing.id)
  }

  const categoryData: Prisma.RecordCategoryUncheckedUpdateInput = {}

  if (code !== undefined) categoryData.code = code
  if (input.name !== undefined) categoryData.name = input.name
  if (input.description !== undefined) {
    categoryData.description = input.description
  }
  if (input.isActive !== undefined) categoryData.isActive = input.isActive
  if (input.sortOrder !== undefined) categoryData.sortOrder = input.sortOrder

  const existingById = new Map(
    existing.fields.map((field) => [field.id, field] as const)
  )
  const matchedExistingIds = new Set<string>()

  const matchedFields: {
    input: CustomFieldInput
    existingId: string | null
  }[] = []
  const removedFields: typeof existing.fields = []

  if (input.fields !== undefined) {
    assertUniqueFieldKeys(input.fields)

    for (const field of input.fields) {
      validateFieldInput(field)
      const key = field.key.trim()

      if (field.id) {
        const byId = existingById.get(field.id)
        if (!byId) {
          throw badRequest(
            `Field "${field.label}" does not belong to this category.`
          )
        }
        if (matchedExistingIds.has(byId.id)) {
          throw badRequest("The same field appears more than once.")
        }
        matchedExistingIds.add(byId.id)
        matchedFields.push({ input: field, existingId: byId.id })
        continue
      }

      const byKey = existing.fields.find((item) => item.key === key)
      if (byKey) {
        if (matchedExistingIds.has(byKey.id)) {
          throw badRequest("The same field appears more than once.")
        }
        matchedExistingIds.add(byKey.id)
        matchedFields.push({ input: field, existingId: byKey.id })
      } else {
        matchedFields.push({ input: field, existingId: null })
      }
    }

    const desiredKeys = new Set(
      matchedFields.map(({ input: field }) => field.key.trim())
    )
    removedFields.push(
      ...existing.fields.filter(
        (field) => !matchedExistingIds.has(field.id)
      )
    )

    // The database unique index still covers inactive fields. Reject a desired
    // key that is reserved by a field which is not part of this update.
    for (const removed of removedFields) {
      if (desiredKeys.has(removed.key)) {
        throw badRequest(
          `Field key "${removed.key}" is still used by an existing field.`
        )
      }
    }
  }

  const deactivatedFieldKeys: string[] = []
  const deletedFieldKeys: string[] = []

  try {
    const category = await prisma.$transaction(async (tx) => {
      if (Object.keys(categoryData).length > 0) {
        await tx.recordCategory.update({
          where: { id: existing.id },
          data: categoryData,
        })
      }

      for (const { input: field, existingId } of matchedFields) {
        if (existingId) {
          await tx.customFieldDefinition.update({
            where: { id: existingId },
            data: fieldData(field),
          })
        } else {
          await tx.customFieldDefinition.create({
            data: {
              categoryId: existing.id,
              ...fieldData(field),
            },
          })
        }
      }

      if (removedFields.length > 0) {
        const valueCounts = await tx.recordValue.groupBy({
          by: ["fieldDefinitionId"],
          where: {
            fieldDefinitionId: {
              in: removedFields.map((field) => field.id),
            },
          },
          _count: { _all: true },
        })

        const fieldsWithValues = new Set(
          valueCounts.map((row) => row.fieldDefinitionId)
        )

        for (const field of removedFields) {
          if (fieldsWithValues.has(field.id)) {
            await tx.customFieldDefinition.update({
              where: { id: field.id },
              data: { isActive: false },
            })
            deactivatedFieldKeys.push(field.key)
          } else {
            await tx.customFieldDefinition.delete({
              where: { id: field.id },
            })
            deletedFieldKeys.push(field.key)
          }
        }
      }

      return tx.recordCategory.findUniqueOrThrow({
        where: { id: existing.id },
        include: categoryInclude(true),
      })
    })

    await writeAudit({
      actorId: scope.userId,
      action: "UPDATE",
      entityType: "RecordCategory",
      entityId: category.id,
      summary: `Updated record category ${category.code} (${category.name})`,
      metadata: {
        code: category.code,
        name: category.name,
        createdFields: matchedFields
          .filter((field) => field.existingId === null)
          .map((field) => field.input.key.trim()),
        updatedFields: matchedFields
          .filter((field) => field.existingId !== null)
          .map((field) => field.input.key.trim()),
        deactivatedFieldKeys,
        deletedFieldKeys,
      },
    })

    return category
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      throw conflict("The category code or a field key already exists.")
    }
    throw error
  }
}

export async function updateSystemSettings(
  scope: AccessScope,
  input: SystemSettingsInput
) {
  assertCanManageSettings(scope)

  const rows: {
    key: string
    value: Prisma.InputJsonValue
    description: string
  }[] = [
    {
      key: SETTING_KEYS.companyName,
      value: input.companyName,
      description: "Company name shown throughout the application.",
    },
    {
      key: SETTING_KEYS.timezone,
      value: input.timezone,
      description: "Timezone used for business dates and reporting.",
    },
    {
      key: SETTING_KEYS.allowSelfApproval,
      value: input.allowSelfApproval,
      description: "Whether a user may approve a record they submitted.",
    },
    {
      key: SETTING_KEYS.overdueDays,
      value: input.overdueDays,
      description: "Days after submission before a record is overdue.",
    },
  ]

  await prisma.$transaction(
    rows.map((row) =>
      prisma.systemSetting.upsert({
        where: { key: row.key },
        create: {
          key: row.key,
          value: row.value,
          description: row.description,
          updatedById: scope.userId,
        },
        update: {
          value: row.value,
          description: row.description,
          updatedById: scope.userId,
        },
      })
    )
  )

  await writeAudit({
    actorId: scope.userId,
    action: "SETTINGS_CHANGE",
    entityType: "SystemSetting",
    summary: "Updated system settings",
    metadata: {
      settings: {
        companyName: input.companyName,
        timezone: input.timezone,
        allowSelfApproval: input.allowSelfApproval,
        overdueDays: input.overdueDays,
      },
    },
  })

  return {
    companyName: input.companyName,
    timezone: input.timezone,
    allowSelfApproval: input.allowSelfApproval,
    overdueDays: input.overdueDays,
  }
}

function isUniqueConstraintError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: unknown }).code === "P2002"
  )
}
