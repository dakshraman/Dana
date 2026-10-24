-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('SUPER_ADMIN', 'REGIONAL_MANAGER', 'BRANCH_MANAGER', 'BRANCH_EMPLOYEE');

-- CreateEnum
CREATE TYPE "RecordStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'APPROVED', 'REJECTED', 'RETURNED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "ApprovalAction" AS ENUM ('SUBMITTED', 'RESUBMITTED', 'APPROVED', 'REJECTED', 'RETURNED', 'ARCHIVED', 'RESTORED');

-- CreateEnum
CREATE TYPE "FieldType" AS ENUM ('TEXT', 'TEXTAREA', 'NUMBER', 'DECIMAL', 'DATE', 'BOOLEAN', 'SELECT');

-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('RECORD_SUBMITTED', 'RECORD_APPROVED', 'RECORD_REJECTED', 'RECORD_RETURNED', 'USER_ASSIGNED', 'SYSTEM');

-- CreateEnum
CREATE TYPE "AuditAction" AS ENUM ('CREATE', 'UPDATE', 'DELETE', 'DEACTIVATE', 'ACTIVATE', 'LOGIN', 'LOGIN_FAILED', 'LOGOUT', 'SUBMIT', 'APPROVE', 'REJECT', 'RETURN', 'ARCHIVE', 'RESTORE', 'EXPORT', 'SETTINGS_CHANGE');

-- CreateTable
CREATE TABLE "Region" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Region_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Branch" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "country" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "contactPerson" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "regionId" TEXT NOT NULL,
    "managerId" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Branch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" "UserRole" NOT NULL DEFAULT 'BRANCH_EMPLOYEE',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastLoginAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserBranchAssignment" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "jobTitle" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserBranchAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserRegionAssignment" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "regionId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserRegionAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RecordCategory" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RecordCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CustomFieldDefinition" (
    "id" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "type" "FieldType" NOT NULL,
    "required" BOOLEAN NOT NULL DEFAULT false,
    "options" JSONB,
    "placeholder" TEXT,
    "helpText" TEXT,
    "minValue" DECIMAL(18,4),
    "maxValue" DECIMAL(18,4),
    "maxLength" INTEGER,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CustomFieldDefinition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DataRecord" (
    "id" TEXT NOT NULL,
    "recordNumber" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "recordDate" DATE NOT NULL,
    "title" TEXT NOT NULL,
    "referenceNumber" TEXT,
    "remarks" TEXT,
    "status" "RecordStatus" NOT NULL DEFAULT 'DRAFT',
    "createdById" TEXT NOT NULL,
    "updatedById" TEXT NOT NULL,
    "submittedById" TEXT,
    "submittedAt" TIMESTAMP(3),
    "approvedById" TEXT,
    "approvedAt" TIMESTAMP(3),
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DataRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RecordValue" (
    "id" TEXT NOT NULL,
    "recordId" TEXT NOT NULL,
    "fieldDefinitionId" TEXT NOT NULL,
    "valueText" TEXT,
    "valueNumber" DECIMAL(18,4),
    "valueDate" DATE,
    "valueBoolean" BOOLEAN,
    "valueJson" JSONB,

    CONSTRAINT "RecordValue_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RecordCounter" (
    "branchId" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "lastNumber" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RecordCounter_pkey" PRIMARY KEY ("branchId","year")
);

-- CreateTable
CREATE TABLE "ApprovalHistory" (
    "id" TEXT NOT NULL,
    "recordId" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "action" "ApprovalAction" NOT NULL,
    "fromStatus" "RecordStatus",
    "toStatus" "RecordStatus" NOT NULL,
    "comment" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ApprovalHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "NotificationType" NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "link" TEXT,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Attachment" (
    "id" TEXT NOT NULL,
    "recordId" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "uploadedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Attachment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "actorId" TEXT,
    "action" "AuditAction" NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT,
    "summary" TEXT NOT NULL,
    "metadata" JSONB,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SystemSetting" (
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "description" TEXT,
    "updatedById" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SystemSetting_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "LoginAttempt" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "ipAddress" TEXT,
    "success" BOOLEAN NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LoginAttempt_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Region_code_key" ON "Region"("code");

-- CreateIndex
CREATE INDEX "Region_name_idx" ON "Region"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Branch_code_key" ON "Branch"("code");

-- CreateIndex
CREATE INDEX "Branch_regionId_idx" ON "Branch"("regionId");

-- CreateIndex
CREATE INDEX "Branch_country_state_city_idx" ON "Branch"("country", "state", "city");

-- CreateIndex
CREATE INDEX "Branch_isActive_idx" ON "Branch"("isActive");

-- CreateIndex
CREATE INDEX "Branch_name_idx" ON "Branch"("name");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_role_isActive_idx" ON "User"("role", "isActive");

-- CreateIndex
CREATE INDEX "User_name_idx" ON "User"("name");

-- CreateIndex
CREATE INDEX "UserBranchAssignment_branchId_idx" ON "UserBranchAssignment"("branchId");

-- CreateIndex
CREATE INDEX "UserBranchAssignment_userId_idx" ON "UserBranchAssignment"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "UserBranchAssignment_userId_branchId_key" ON "UserBranchAssignment"("userId", "branchId");

-- CreateIndex
CREATE INDEX "UserRegionAssignment_regionId_idx" ON "UserRegionAssignment"("regionId");

-- CreateIndex
CREATE INDEX "UserRegionAssignment_userId_idx" ON "UserRegionAssignment"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "UserRegionAssignment_userId_regionId_key" ON "UserRegionAssignment"("userId", "regionId");

-- CreateIndex
CREATE UNIQUE INDEX "RecordCategory_code_key" ON "RecordCategory"("code");

-- CreateIndex
CREATE INDEX "RecordCategory_isActive_sortOrder_idx" ON "RecordCategory"("isActive", "sortOrder");

-- CreateIndex
CREATE INDEX "CustomFieldDefinition_categoryId_sortOrder_idx" ON "CustomFieldDefinition"("categoryId", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "CustomFieldDefinition_categoryId_key_key" ON "CustomFieldDefinition"("categoryId", "key");

-- CreateIndex
CREATE UNIQUE INDEX "DataRecord_recordNumber_key" ON "DataRecord"("recordNumber");

-- CreateIndex
CREATE INDEX "DataRecord_branchId_status_recordDate_idx" ON "DataRecord"("branchId", "status", "recordDate");

-- CreateIndex
CREATE INDEX "DataRecord_categoryId_recordDate_idx" ON "DataRecord"("categoryId", "recordDate");

-- CreateIndex
CREATE INDEX "DataRecord_status_submittedAt_idx" ON "DataRecord"("status", "submittedAt");

-- CreateIndex
CREATE INDEX "DataRecord_recordDate_idx" ON "DataRecord"("recordDate");

-- CreateIndex
CREATE INDEX "DataRecord_createdById_idx" ON "DataRecord"("createdById");

-- CreateIndex
CREATE INDEX "DataRecord_archivedAt_idx" ON "DataRecord"("archivedAt");

-- CreateIndex
CREATE INDEX "DataRecord_referenceNumber_idx" ON "DataRecord"("referenceNumber");

-- CreateIndex
CREATE INDEX "RecordValue_fieldDefinitionId_idx" ON "RecordValue"("fieldDefinitionId");

-- CreateIndex
CREATE UNIQUE INDEX "RecordValue_recordId_fieldDefinitionId_key" ON "RecordValue"("recordId", "fieldDefinitionId");

-- CreateIndex
CREATE INDEX "ApprovalHistory_recordId_createdAt_idx" ON "ApprovalHistory"("recordId", "createdAt");

-- CreateIndex
CREATE INDEX "ApprovalHistory_actorId_idx" ON "ApprovalHistory"("actorId");

-- CreateIndex
CREATE INDEX "Notification_userId_readAt_createdAt_idx" ON "Notification"("userId", "readAt", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Attachment_storageKey_key" ON "Attachment"("storageKey");

-- CreateIndex
CREATE INDEX "Attachment_recordId_idx" ON "Attachment"("recordId");

-- CreateIndex
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_actorId_createdAt_idx" ON "AuditLog"("actorId", "createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_entityType_entityId_idx" ON "AuditLog"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "AuditLog_action_createdAt_idx" ON "AuditLog"("action", "createdAt");

-- CreateIndex
CREATE INDEX "LoginAttempt_email_createdAt_idx" ON "LoginAttempt"("email", "createdAt");

-- CreateIndex
CREATE INDEX "LoginAttempt_ipAddress_createdAt_idx" ON "LoginAttempt"("ipAddress", "createdAt");

-- AddForeignKey
ALTER TABLE "Branch" ADD CONSTRAINT "Branch_regionId_fkey" FOREIGN KEY ("regionId") REFERENCES "Region"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Branch" ADD CONSTRAINT "Branch_managerId_fkey" FOREIGN KEY ("managerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserBranchAssignment" ADD CONSTRAINT "UserBranchAssignment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserBranchAssignment" ADD CONSTRAINT "UserBranchAssignment_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserRegionAssignment" ADD CONSTRAINT "UserRegionAssignment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserRegionAssignment" ADD CONSTRAINT "UserRegionAssignment_regionId_fkey" FOREIGN KEY ("regionId") REFERENCES "Region"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomFieldDefinition" ADD CONSTRAINT "CustomFieldDefinition_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "RecordCategory"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DataRecord" ADD CONSTRAINT "DataRecord_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DataRecord" ADD CONSTRAINT "DataRecord_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "RecordCategory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DataRecord" ADD CONSTRAINT "DataRecord_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DataRecord" ADD CONSTRAINT "DataRecord_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DataRecord" ADD CONSTRAINT "DataRecord_submittedById_fkey" FOREIGN KEY ("submittedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DataRecord" ADD CONSTRAINT "DataRecord_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecordValue" ADD CONSTRAINT "RecordValue_recordId_fkey" FOREIGN KEY ("recordId") REFERENCES "DataRecord"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecordValue" ADD CONSTRAINT "RecordValue_fieldDefinitionId_fkey" FOREIGN KEY ("fieldDefinitionId") REFERENCES "CustomFieldDefinition"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecordCounter" ADD CONSTRAINT "RecordCounter_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApprovalHistory" ADD CONSTRAINT "ApprovalHistory_recordId_fkey" FOREIGN KEY ("recordId") REFERENCES "DataRecord"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApprovalHistory" ADD CONSTRAINT "ApprovalHistory_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Attachment" ADD CONSTRAINT "Attachment_recordId_fkey" FOREIGN KEY ("recordId") REFERENCES "DataRecord"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Attachment" ADD CONSTRAINT "Attachment_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SystemSetting" ADD CONSTRAINT "SystemSetting_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
