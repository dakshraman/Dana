/**
 * Idempotent sample data for the Dana Company app.
 *
 * Run with: SEED_PASSWORD='<strong password>' npx prisma db seed
 * The same password is assigned to every seeded account and is never stored in
 * this repository.
 *
 * Safe to run repeatedly: rows use natural keys, assignments are upserted, and
 * existing records (with their history/notifications/audit rows) are skipped.
 */
import "dotenv/config"

import { hash } from "bcryptjs"
import { PrismaPg } from "@prisma/adapter-pg"

import {
  PrismaClient,
  type Branch,
  type Prisma,
  type Region,
  type User,
} from "../lib/generated/prisma/client"
import {
  ApprovalAction,
  AuditAction,
  FieldType,
  NotificationType,
  RecordStatus,
  UserRole,
} from "../lib/generated/prisma/enums"

const SEED_YEAR = 2026
const BCRYPT_COST = 12

function seedPassword(): string {
  const value = process.env.SEED_PASSWORD
  if (!value || value.length < 12) {
    throw new Error(
      "SEED_PASSWORD is not set (minimum 12 characters). " +
        "Export it before running the seed; never commit it."
    )
  }
  return value
}

const connectionString = process.env.DIRECT_URL
if (!connectionString) {
  throw new Error("DIRECT_URL is not set. Add it to your .env file.")
}

const prisma = new PrismaClient({
  adapter: new PrismaPg(connectionString),
})

type SeedBranch = {
  code: string
  name: string
  country: string
  state: string
  city: string
  address: string
  contactPerson: string
  email: string
  phone: string
  regionCode: string
  managerEmail?: string
}

type SeedUser = {
  email: string
  name: string
  role: UserRole
  branchCodes: string[]
  regionCodes: string[]
  jobTitle?: string
}

type SeedField = {
  key: string
  label: string
  type: FieldType
  required?: boolean
  options?: string[]
  placeholder?: string
  minValue?: number
  maxValue?: number
  sortOrder: number
}

type SeedCategory = {
  code: string
  name: string
  description: string
  sortOrder: number
  fields: SeedField[]
}

type SeededUser = {
  id: string
  email: string
  name: string
  role: UserRole
  branchCodes: string[]
  regionCodes: string[]
}

type RecordValuePlan = {
  fieldDefinitionId: string
  valueText: string | null
  valueNumber: number | null
  valueDate: Date | null
  valueBoolean: boolean | null
}

type RecordPlan = {
  index: number
  recordNumber: string
  referenceNumber: string
  title: string
  branchId: string
  branchCode: string
  categoryId: string
  categoryCode: string
  categoryName: string
  recordDate: Date
  status: RecordStatus
  createdAt: Date
  updatedAt: Date
  submittedAt: Date | null
  approvedAt: Date | null
  creator: SeededUser
  reviewer: SeededUser | null
  values: RecordValuePlan[]
}

const regions = [
  {
    code: "NA",
    name: "North America",
    description: "United States and Canada operations.",
  },
  {
    code: "EU",
    name: "Europe",
    description: "Germany and United Kingdom operations.",
  },
  {
    code: "APAC",
    name: "Asia Pacific",
    description: "India, Singapore and Australia operations.",
  },
]

const seedBranches: SeedBranch[] = [
  {
    code: "DET",
    name: "Detroit Operations",
    country: "United States",
    state: "Michigan",
    city: "Detroit",
    address: "1200 Woodward Avenue",
    contactPerson: "Marcus Reed",
    email: "detroit@dana.com",
    phone: "+1 313 555 0101",
    regionCode: "NA",
    managerEmail: "branch.manager@dana.com",
  },
  {
    code: "TOR",
    name: "Toronto Branch",
    country: "Canada",
    state: "Ontario",
    city: "Toronto",
    address: "88 King Street West",
    contactPerson: "Nora Alvarez",
    email: "toronto@dana.com",
    phone: "+1 416 555 0102",
    regionCode: "NA",
  },
  {
    code: "MUC",
    name: "Munich Branch",
    country: "Germany",
    state: "Bavaria",
    city: "Munich",
    address: "Leopoldstrasse 42",
    contactPerson: "Lena Hoffmann",
    email: "munich@dana.com",
    phone: "+49 89 555 0103",
    regionCode: "EU",
    managerEmail: "munich.manager@dana.com",
  },
  {
    code: "LON",
    name: "London Branch",
    country: "United Kingdom",
    state: "England",
    city: "London",
    address: "15 Bishopsgate",
    contactPerson: "Elias Weber",
    email: "london@dana.com",
    phone: "+44 20 5550 0104",
    regionCode: "EU",
  },
  {
    code: "CHN",
    name: "Chennai Branch",
    country: "India",
    state: "Tamil Nadu",
    city: "Chennai",
    address: "12 Anna Salai",
    contactPerson: "Priya Raman",
    email: "chennai@dana.com",
    phone: "+91 44 5550 0105",
    regionCode: "APAC",
    managerEmail: "chennai.manager@dana.com",
  },
  {
    code: "SIN",
    name: "Singapore Branch",
    country: "Singapore",
    state: "Singapore",
    city: "Singapore",
    address: "8 Marina Boulevard",
    contactPerson: "Dana Administrator",
    email: "singapore@dana.com",
    phone: "+65 6555 0106",
    regionCode: "APAC",
  },
  {
    code: "SYD",
    name: "Sydney Branch",
    country: "Australia",
    state: "New South Wales",
    city: "Sydney",
    address: "100 George Street",
    contactPerson: "Dana Administrator",
    email: "sydney@dana.com",
    phone: "+61 2 5550 0107",
    regionCode: "APAC",
  },
]

const seedUsers: SeedUser[] = [
  {
    email: "superadmin@dana.com",
    name: "Dana Administrator",
    role: UserRole.SUPER_ADMIN,
    branchCodes: [],
    regionCodes: [],
    jobTitle: "System Administrator",
  },
  {
    email: "regional.na@dana.com",
    name: "Nora Alvarez",
    role: UserRole.REGIONAL_MANAGER,
    branchCodes: [],
    regionCodes: ["NA"],
    jobTitle: "Regional Manager, North America",
  },
  {
    email: "regional.eu@dana.com",
    name: "Elias Weber",
    role: UserRole.REGIONAL_MANAGER,
    branchCodes: [],
    regionCodes: ["EU"],
    jobTitle: "Regional Manager, Europe",
  },
  {
    email: "branch.manager@dana.com",
    name: "Marcus Reed",
    role: UserRole.BRANCH_MANAGER,
    branchCodes: ["DET"],
    regionCodes: [],
    jobTitle: "Branch Manager",
  },
  {
    email: "employee@dana.com",
    name: "Emily Carter",
    role: UserRole.BRANCH_EMPLOYEE,
    branchCodes: ["DET"],
    regionCodes: [],
    jobTitle: "Operations Associate",
  },
  {
    email: "munich.manager@dana.com",
    name: "Lena Hoffmann",
    role: UserRole.BRANCH_MANAGER,
    branchCodes: ["MUC"],
    regionCodes: [],
    jobTitle: "Branch Manager",
  },
  {
    email: "munich.employee@dana.com",
    name: "Jonas Fischer",
    role: UserRole.BRANCH_EMPLOYEE,
    branchCodes: ["MUC"],
    regionCodes: [],
    jobTitle: "Quality Inspector",
  },
  {
    email: "chennai.manager@dana.com",
    name: "Priya Raman",
    role: UserRole.BRANCH_MANAGER,
    branchCodes: ["CHN"],
    regionCodes: [],
    jobTitle: "Branch Manager",
  },
  {
    email: "chennai.employee@dana.com",
    name: "Arjun Mehta",
    role: UserRole.BRANCH_EMPLOYEE,
    branchCodes: ["CHN"],
    regionCodes: [],
    jobTitle: "Logistics Coordinator",
  },
]

const seedCategories: SeedCategory[] = [
  {
    code: "DAILY-OPS",
    name: "Daily Operations",
    description: "Daily production and safety reporting.",
    sortOrder: 1,
    fields: [
      {
        key: "shift",
        label: "Shift",
        type: FieldType.TEXT,
        required: true,
        placeholder: "Day, Swing or Night",
        sortOrder: 1,
      },
      {
        key: "unitsProduced",
        label: "Units Produced",
        type: FieldType.NUMBER,
        required: true,
        minValue: 0,
        sortOrder: 2,
      },
      {
        key: "downtimeHours",
        label: "Downtime Hours",
        type: FieldType.DECIMAL,
        minValue: 0,
        sortOrder: 3,
      },
      {
        key: "reportDate",
        label: "Report Date",
        type: FieldType.DATE,
        required: true,
        sortOrder: 4,
      },
      {
        key: "safetyIncident",
        label: "Safety Incident",
        type: FieldType.BOOLEAN,
        required: true,
        sortOrder: 5,
      },
      {
        key: "severity",
        label: "Severity",
        type: FieldType.SELECT,
        required: true,
        options: ["Low", "Medium", "High"],
        sortOrder: 6,
      },
    ],
  },
  {
    code: "QUALITY",
    name: "Quality Control",
    description: "Batch inspection and defect tracking.",
    sortOrder: 2,
    fields: [
      {
        key: "batchNumber",
        label: "Batch Number",
        type: FieldType.TEXT,
        required: true,
        sortOrder: 1,
      },
      {
        key: "inspected",
        label: "Units Inspected",
        type: FieldType.NUMBER,
        required: true,
        minValue: 0,
        sortOrder: 2,
      },
      {
        key: "defects",
        label: "Defects Found",
        type: FieldType.NUMBER,
        required: true,
        minValue: 0,
        sortOrder: 3,
      },
      {
        key: "defectRate",
        label: "Defect Rate (%)",
        type: FieldType.DECIMAL,
        minValue: 0,
        maxValue: 100,
        sortOrder: 4,
      },
    ],
  },
  {
    code: "LOGISTICS",
    name: "Logistics",
    description: "Shipment and carrier performance.",
    sortOrder: 3,
    fields: [
      {
        key: "carrier",
        label: "Carrier",
        type: FieldType.TEXT,
        required: true,
        sortOrder: 1,
      },
      {
        key: "shipments",
        label: "Shipments",
        type: FieldType.NUMBER,
        required: true,
        minValue: 0,
        sortOrder: 2,
      },
      {
        key: "weightKg",
        label: "Weight (kg)",
        type: FieldType.DECIMAL,
        minValue: 0,
        sortOrder: 3,
      },
      {
        key: "status",
        label: "Shipment Status",
        type: FieldType.SELECT,
        required: true,
        options: ["Scheduled", "In Transit", "Delivered", "Delayed"],
        sortOrder: 4,
      },
    ],
  },
]

function fieldData(field: SeedField) {
  return {
    label: field.label,
    type: field.type,
    required: field.required ?? false,
    options: field.options ?? [],
    placeholder: field.placeholder ?? null,
    minValue: field.minValue ?? null,
    maxValue: field.maxValue ?? null,
    sortOrder: field.sortOrder,
    isActive: true,
  }
}

function utcDateDaysAgo(days: number): Date {
  const now = new Date()
  return new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - days)
  )
}

function atUtcHour(date: Date, hour: number): Date {
  return new Date(
    Date.UTC(
      date.getUTCFullYear(),
      date.getUTCMonth(),
      date.getUTCDate(),
      hour
    )
  )
}

function addHours(date: Date, hours: number): Date {
  return new Date(date.getTime() + hours * 60 * 60 * 1000)
}

function sampleValue(
  categoryCode: string,
  fieldKey: string,
  index: number,
  branchCode: string,
  recordDate: Date
): string | number | boolean | Date {
  if (categoryCode === "DAILY-OPS") {
    if (fieldKey === "shift") return ["Day", "Swing", "Night"][index % 3]
    if (fieldKey === "unitsProduced") return 120 + ((index * 7) % 300)
    if (fieldKey === "downtimeHours") {
      return Number(((index % 7) * 0.5).toFixed(2))
    }
    if (fieldKey === "reportDate") return recordDate
    if (fieldKey === "safetyIncident") return index % 11 === 0
    if (fieldKey === "severity") return ["Low", "Medium", "High"][index % 3]
  }

  if (categoryCode === "QUALITY") {
    const inspected = 80 + ((index * 9) % 240)
    const defects = (index * 3) % 12

    if (fieldKey === "batchNumber") return `${branchCode}-B${1000 + index}`
    if (fieldKey === "inspected") return inspected
    if (fieldKey === "defects") return defects
    if (fieldKey === "defectRate") {
      return Number(((defects / inspected) * 100).toFixed(2))
    }
  }

  if (categoryCode === "LOGISTICS") {
    if (fieldKey === "carrier") {
      return ["Dana Freight", "Northstar Logistics", "GlobalMove"][index % 3]
    }
    if (fieldKey === "shipments") return 12 + ((index * 5) % 60)
    if (fieldKey === "weightKg") {
      return Number((220.5 + index * 17.75).toFixed(2))
    }
    if (fieldKey === "status") {
      return ["Scheduled", "In Transit", "Delivered", "Delayed"][index % 4]
    }
  }

  throw new Error(`No sample value for ${categoryCode}.${fieldKey}.`)
}

async function main() {
  const passwordHash = await hash(seedPassword(), BCRYPT_COST)

  const regionRows: Region[] = []
  for (const definition of regions) {
    const region = await prisma.region.upsert({
      where: { code: definition.code },
      update: { name: definition.name, description: definition.description },
      create: definition,
    })
    regionRows.push(region)
  }
  const regionByCode = new Map(
    regionRows.map((row) => [row.code, row] as const)
  )

  const branchRows: Branch[] = []
  for (const definition of seedBranches) {
    const region = regionByCode.get(definition.regionCode)
    if (!region) throw new Error(`Missing region ${definition.regionCode}.`)

    const branch = await prisma.branch.upsert({
      where: { code: definition.code },
      update: {
        name: definition.name,
        country: definition.country,
        state: definition.state,
        city: definition.city,
        address: definition.address,
        contactPerson: definition.contactPerson,
        email: definition.email,
        phone: definition.phone,
        regionId: region.id,
        isActive: true,
      },
      create: {
        code: definition.code,
        name: definition.name,
        country: definition.country,
        state: definition.state,
        city: definition.city,
        address: definition.address,
        contactPerson: definition.contactPerson,
        email: definition.email,
        phone: definition.phone,
        regionId: region.id,
        isActive: true,
      },
    })
    branchRows.push(branch)
  }
  const branchByCode = new Map(
    branchRows.map((row) => [row.code, row] as const)
  )

  const userRows: User[] = []
  for (const definition of seedUsers) {
    const email = definition.email.toLowerCase()
    const user = await prisma.user.upsert({
      where: { email },
      update: {
        name: definition.name,
        role: definition.role,
        isActive: true,
        passwordHash,
      },
      create: {
        email,
        name: definition.name,
        role: definition.role,
        isActive: true,
        passwordHash,
      },
    })
    userRows.push(user)
  }

  const storedUserByEmail = new Map(
    userRows.map((row) => [row.email, row] as const)
  )
  const seededUsers: SeededUser[] = seedUsers.map((definition) => {
    const user = storedUserByEmail.get(definition.email.toLowerCase())
    if (!user) throw new Error(`Missing seeded user ${definition.email}.`)
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      role: definition.role,
      branchCodes: definition.branchCodes,
      regionCodes: definition.regionCodes,
    }
  })
  const userByEmail = new Map(
    seededUsers.map((user) => [user.email, user] as const)
  )

  for (const definition of seedUsers) {
    const user = userByEmail.get(definition.email.toLowerCase())
    if (!user) throw new Error(`Missing seeded user ${definition.email}.`)

    for (const regionCode of definition.regionCodes) {
      const region = regionByCode.get(regionCode)
      if (!region) throw new Error(`Missing region ${regionCode}.`)
      await prisma.userRegionAssignment.upsert({
        where: { userId_regionId: { userId: user.id, regionId: region.id } },
        update: {},
        create: { userId: user.id, regionId: region.id },
      })
    }

    for (const [index, branchCode] of definition.branchCodes.entries()) {
      const branch = branchByCode.get(branchCode)
      if (!branch) throw new Error(`Missing branch ${branchCode}.`)
      await prisma.userBranchAssignment.upsert({
        where: {
          userId_branchId: { userId: user.id, branchId: branch.id },
        },
        update: {
          isPrimary: index === 0,
          jobTitle: definition.jobTitle ?? null,
        },
        create: {
          userId: user.id,
          branchId: branch.id,
          isPrimary: index === 0,
          jobTitle: definition.jobTitle ?? null,
        },
      })
    }
  }

  for (const definition of seedBranches) {
    if (!definition.managerEmail) continue
    const manager = userByEmail.get(definition.managerEmail.toLowerCase())
    if (!manager) {
      throw new Error(`Missing manager ${definition.managerEmail}.`)
    }
    await prisma.branch.update({
      where: { code: definition.code },
      data: { managerId: manager.id },
    })
  }

  const superAdmin = userByEmail.get("superadmin@dana.com")
  if (!superAdmin) throw new Error("Missing super admin.")

  const regionalManagerByRegion = new Map<string, SeededUser>()
  const managerByBranch = new Map<string, SeededUser>()
  const employeeByBranch = new Map<string, SeededUser>()
  const managersByRegion = new Map<string, SeededUser[]>()

  for (const user of seededUsers) {
    if (user.role === UserRole.REGIONAL_MANAGER) {
      for (const code of user.regionCodes) {
        regionalManagerByRegion.set(code, user)
      }
    }
    if (user.role === UserRole.BRANCH_MANAGER) {
      for (const code of user.branchCodes) managerByBranch.set(code, user)
    }
    if (user.role === UserRole.BRANCH_EMPLOYEE) {
      for (const code of user.branchCodes) employeeByBranch.set(code, user)
    }
  }

  for (const definition of seedBranches) {
    const manager = managerByBranch.get(definition.code)
    if (!manager) continue
    const current = managersByRegion.get(definition.regionCode) ?? []
    current.push(manager)
    managersByRegion.set(definition.regionCode, current)
  }

  function creatorFor(branch: SeedBranch): SeededUser {
    return (
      employeeByBranch.get(branch.code) ??
      managerByBranch.get(branch.code) ??
      regionalManagerByRegion.get(branch.regionCode) ??
      superAdmin!
    )
  }

  function reviewerFor(branch: SeedBranch, creator: SeededUser): SeededUser {
    const candidates: (SeededUser | undefined)[] = [
      managerByBranch.get(branch.code),
      regionalManagerByRegion.get(branch.regionCode),
      ...(managersByRegion.get(branch.regionCode) ?? []),
      superAdmin,
    ]
    for (const candidate of candidates) {
      if (candidate && candidate.id !== creator.id) return candidate
    }
    return superAdmin!
  }

  const categoryIds: string[] = []
  for (const definition of seedCategories) {
    const category = await prisma.recordCategory.upsert({
      where: { code: definition.code },
      update: {
        name: definition.name,
        description: definition.description,
        isActive: true,
        sortOrder: definition.sortOrder,
      },
      create: {
        code: definition.code,
        name: definition.name,
        description: definition.description,
        isActive: true,
        sortOrder: definition.sortOrder,
      },
    })
    categoryIds.push(category.id)

    for (const field of definition.fields) {
      await prisma.customFieldDefinition.upsert({
        where: {
          categoryId_key: { categoryId: category.id, key: field.key },
        },
        update: fieldData(field),
        create: {
          categoryId: category.id,
          key: field.key,
          ...fieldData(field),
        },
      })
    }
  }

  const categoryRows = await prisma.recordCategory.findMany({
    where: { id: { in: categoryIds } },
    include: { fields: true },
  })
  const categoryByCode = new Map(
    categoryRows.map((category) => [category.code, category] as const)
  )

  function buildValues(
    categoryCode: string,
    index: number,
    branchCode: string,
    recordDate: Date
  ): RecordValuePlan[] {
    const category = categoryByCode.get(categoryCode)
    if (!category) throw new Error(`Missing category ${categoryCode}.`)

    return category.fields.map((field) => {
      const raw = sampleValue(
        categoryCode,
        field.key,
        index,
        branchCode,
        recordDate
      )
      return {
        fieldDefinitionId: field.id,
        valueText:
          field.type === FieldType.TEXT ||
          field.type === FieldType.TEXTAREA ||
          field.type === FieldType.SELECT
            ? String(raw)
            : null,
        valueNumber:
          field.type === FieldType.NUMBER ||
          field.type === FieldType.DECIMAL
            ? Number(raw)
            : null,
        valueDate: field.type === FieldType.DATE ? (raw as Date) : null,
        valueBoolean:
          field.type === FieldType.BOOLEAN ? Boolean(raw) : null,
      }
    })
  }

  const statusCycle: RecordStatus[] = [
    RecordStatus.APPROVED,
    RecordStatus.SUBMITTED,
    RecordStatus.DRAFT,
    RecordStatus.RETURNED,
    RecordStatus.REJECTED,
  ]
  const sequenceByBranch = new Map<string, number>()
  const plans: RecordPlan[] = []

  for (let index = 0; index < 30; index += 1) {
    const branchDefinition = seedBranches[index % seedBranches.length]
    const categoryDefinition = seedCategories[index % seedCategories.length]
    const branch = branchByCode.get(branchDefinition.code)
    const category = categoryByCode.get(categoryDefinition.code)
    if (!branch || !category) throw new Error("Seed lookup failed.")

    const sequence = (sequenceByBranch.get(branch.code) ?? 0) + 1
    sequenceByBranch.set(branch.code, sequence)

    const status = statusCycle[index % statusCycle.length]
    const recordDate = utcDateDaysAgo(3 + ((index * 11) % 87))
    const createdAt = atUtcHour(recordDate, 8 + (index % 6))
    const submittedAt =
      status === RecordStatus.DRAFT ? null : addHours(createdAt, 2)
    const isReviewed =
      status === RecordStatus.APPROVED ||
      status === RecordStatus.REJECTED ||
      status === RecordStatus.RETURNED
    const reviewedAt =
      submittedAt && isReviewed ? addHours(submittedAt, 20) : null
    const creator = creatorFor(branchDefinition)
    const reviewer =
      status === RecordStatus.DRAFT
        ? null
        : reviewerFor(branchDefinition, creator)

    plans.push({
      index,
      recordNumber: `seed-${branch.code}-${SEED_YEAR}-${String(
        sequence
      ).padStart(4, "0")}`,
      referenceNumber: `seed-ref-${branch.code}-${SEED_YEAR}-${String(
        sequence
      ).padStart(4, "0")}`,
      title: `${category.name} - ${branch.city} #${sequence}`,
      branchId: branch.id,
      branchCode: branch.code,
      categoryId: category.id,
      categoryCode: category.code,
      categoryName: category.name,
      recordDate,
      status,
      createdAt,
      updatedAt: reviewedAt ?? submittedAt ?? createdAt,
      submittedAt,
      approvedAt: status === RecordStatus.APPROVED ? reviewedAt : null,
      creator,
      reviewer,
      values: buildValues(category.code, index, branch.code, recordDate),
    })
  }

  const existingRecords = await prisma.dataRecord.findMany({
    where: { recordNumber: { in: plans.map((plan) => plan.recordNumber) } },
    select: { recordNumber: true },
  })
  const existingNumbers = new Set(
    existingRecords.map((record) => record.recordNumber)
  )

  const notificationRows: Prisma.NotificationCreateManyInput[] = []
  const auditRows: Prisma.AuditLogCreateManyInput[] = []
  let createdCount = 0

  for (const plan of plans) {
    if (existingNumbers.has(plan.recordNumber)) continue

    const approvals: Prisma.ApprovalHistoryUncheckedCreateWithoutRecordInput[] = []

    if (plan.submittedAt) {
      const action = ApprovalAction.SUBMITTED
      approvals.push({
        actorId: plan.creator.id,
        action,
        fromStatus: RecordStatus.DRAFT,
        toStatus: RecordStatus.SUBMITTED,
        comment: "Submitted for review.",
        createdAt: plan.submittedAt,
      })
    }
    if (plan.submittedAt && plan.reviewer) {
      const hasReview =
        plan.status === RecordStatus.APPROVED ||
        plan.status === RecordStatus.REJECTED ||
        plan.status === RecordStatus.RETURNED
      if (hasReview) {
        approvals.push({
          actorId: plan.reviewer.id,
          action:
            plan.status === RecordStatus.APPROVED
              ? ApprovalAction.APPROVED
              : plan.status === RecordStatus.REJECTED
                ? ApprovalAction.REJECTED
                : ApprovalAction.RETURNED,
          fromStatus: RecordStatus.SUBMITTED,
          toStatus: plan.status,
          comment:
            plan.status === RecordStatus.APPROVED
              ? "Approved in the seeded sample workflow."
              : plan.status === RecordStatus.REJECTED
                ? "The reported values do not reconcile with the source report."
                : "Please correct the reported values and resubmit.",
          createdAt: plan.updatedAt,
        })
      }
    }

    const record = await prisma.dataRecord.create({
      data: {
        recordNumber: plan.recordNumber,
        referenceNumber: plan.referenceNumber,
        branchId: plan.branchId,
        categoryId: plan.categoryId,
        recordDate: plan.recordDate,
        title: plan.title,
        remarks:
          plan.status === RecordStatus.RETURNED
            ? "Seed example awaiting correction."
            : plan.status === RecordStatus.REJECTED
              ? "Seed example rejected during review."
              : null,
        status: plan.status,
        createdById: plan.creator.id,
        updatedById:
          plan.status === RecordStatus.DRAFT ||
          plan.status === RecordStatus.SUBMITTED
            ? plan.creator.id
            : plan.reviewer?.id ?? plan.creator.id,
        submittedById: plan.submittedAt ? plan.creator.id : null,
        submittedAt: plan.submittedAt,
        approvedById:
          plan.status === RecordStatus.APPROVED && plan.reviewer
            ? plan.reviewer.id
            : null,
        approvedAt: plan.approvedAt,
        createdAt: plan.createdAt,
        updatedAt: plan.updatedAt,
        values: { create: plan.values },
        approvals: { create: approvals },
      },
      select: { id: true },
    })
    createdCount += 1

    if (plan.status === RecordStatus.SUBMITTED && plan.reviewer && plan.submittedAt) {
      notificationRows.push({
        userId: plan.reviewer.id,
        type: NotificationType.RECORD_SUBMITTED,
        title: "Record submitted for review",
        message: `${plan.creator.name} submitted ${plan.recordNumber} (${plan.categoryName}) for review.`,
        link: `/records/${record.id}`,
        readAt: null,
        createdAt: plan.submittedAt,
      })
    }

    if (
      plan.reviewer &&
      (plan.status === RecordStatus.APPROVED ||
        plan.status === RecordStatus.REJECTED ||
        plan.status === RecordStatus.RETURNED)
    ) {
      notificationRows.push({
        userId: plan.creator.id,
        type:
          plan.status === RecordStatus.APPROVED
            ? NotificationType.RECORD_APPROVED
            : plan.status === RecordStatus.REJECTED
              ? NotificationType.RECORD_REJECTED
              : NotificationType.RECORD_RETURNED,
        title:
          plan.status === RecordStatus.APPROVED
            ? "Record approved"
            : plan.status === RecordStatus.REJECTED
              ? "Record rejected"
              : "Record returned",
        message: `${plan.recordNumber} was ${
          plan.status === RecordStatus.APPROVED
            ? "approved"
            : plan.status === RecordStatus.REJECTED
              ? "rejected"
              : "returned"
        } by ${plan.reviewer.name}.`,
        link: `/records/${record.id}`,
        readAt: plan.index % 2 === 0 ? plan.updatedAt : null,
        createdAt: plan.updatedAt,
      })
    }

    auditRows.push({
      actorId: plan.creator.id,
      action: AuditAction.CREATE,
      entityType: "DataRecord",
      entityId: record.id,
      summary: `Seeded record ${plan.recordNumber}`,
      metadata: {
        recordNumber: plan.recordNumber,
        branch: plan.branchCode,
        category: plan.categoryCode,
        status: plan.status,
        seed: true,
      },
      createdAt: plan.createdAt,
    })

    if (plan.submittedAt) {
      auditRows.push({
        actorId: plan.creator.id,
        action: AuditAction.SUBMIT,
        entityType: "DataRecord",
        entityId: record.id,
        summary: `Submitted seeded record ${plan.recordNumber}`,
        metadata: { recordNumber: plan.recordNumber, seed: true },
        createdAt: plan.submittedAt,
      })
    }

    if (
      plan.reviewer &&
      (plan.status === RecordStatus.APPROVED ||
        plan.status === RecordStatus.REJECTED ||
        plan.status === RecordStatus.RETURNED)
    ) {
      auditRows.push({
        actorId: plan.reviewer.id,
        action:
          plan.status === RecordStatus.APPROVED
            ? AuditAction.APPROVE
            : plan.status === RecordStatus.REJECTED
              ? AuditAction.REJECT
              : AuditAction.RETURN,
        entityType: "DataRecord",
        entityId: record.id,
        summary: `Reviewed seeded record ${plan.recordNumber} (${plan.status})`,
        metadata: {
          recordNumber: plan.recordNumber,
          status: plan.status,
          seed: true,
        },
        createdAt: plan.updatedAt,
      })
    }
  }

  if (notificationRows.length > 0) {
    await prisma.notification.createMany({ data: notificationRows })
  }
  if (auditRows.length > 0) {
    await prisma.auditLog.createMany({ data: auditRows })
  }

  const settingsRows: Array<{
    key: string
    value: Prisma.InputJsonValue
    description: string
  }> = [
    {
      key: "company.name",
      value: "Dana Company",
      description: "Company name shown throughout the application.",
    },
    {
      key: "company.timezone",
      value: process.env.COMPANY_TIMEZONE ?? "Asia/Kolkata",
      description: "Timezone used for business dates and reporting.",
    },
    {
      key: "workflow.allowSelfApproval",
      value: false,
      description: "Whether a user may approve a record they submitted.",
    },
    {
      key: "workflow.overdueDays",
      value: 7,
      description: "Days after submission before a record is overdue.",
    },
  ]

  for (const setting of settingsRows) {
    await prisma.systemSetting.upsert({
      where: { key: setting.key },
      update: {},
      create: {
        key: setting.key,
        value: setting.value,
        description: setting.description,
        updatedById: superAdmin.id,
      },
    })
  }

  console.log("")
  console.log("Dana Company seed complete.")
  console.log(
    `Regions: ${regionRows.length} | Branches: ${branchRows.length} | Users: ${seededUsers.length} | Categories: ${categoryRows.length}`
  )
  console.log(
    `Data records: ${createdCount} created, ${
      plans.length - createdCount
    } already present and skipped.`
  )
  console.log("")
  console.log("Sample credentials (password: the SEED_PASSWORD value)")
  for (const definition of seedUsers) {
    console.log(`  ${definition.role.padEnd(18)} ${definition.email}`)
  }
  console.log("")
}

main()
  .catch((error) => {
    console.error("[seed] failed", error)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
