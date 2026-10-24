import type { NextRequest } from "next/server"

import { enforceRateLimit } from "@/lib/api"
import { writeAudit } from "@/lib/audit"
import { canEditRecord, canReviewRecord } from "@/lib/permissions"
import { prisma } from "@/lib/db"
import {
  assertSameOrigin,
  badRequest,
  created,
  errorResponse,
  forbidden,
  notFound,
  ok,
} from "@/lib/http"
import { getRecord } from "@/lib/services/records"
import { requireApiScope } from "@/lib/session"
import {
  deleteAttachmentFile,
  saveAttachment,
} from "@/lib/storage"
import { getSystemSettings } from "@/lib/settings"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

type Context = { params: Promise<{ id: string }> }

export async function GET(_request: NextRequest, context: Context) {
  try {
    const { scope } = await requireApiScope()
    const { id } = await context.params
    const record = await getRecord(scope, id)

    return ok(
      record.attachments.map((attachment) => ({
        id: attachment.id,
        fileName: attachment.fileName,
        mimeType: attachment.mimeType,
        size: attachment.size,
        createdAt: attachment.createdAt,
        uploadedBy: attachment.uploadedBy,
      }))
    )
  } catch (error) {
    return errorResponse(error)
  }
}

export async function POST(request: NextRequest, context: Context) {
  try {
    assertSameOrigin(request)
    const { user, scope } = await requireApiScope()
    const { id } = await context.params
    const record = await getRecord(scope, id)

    const settings = await getSystemSettings()
    const review = canReviewRecord(scope, record, {
      allowSelfApproval: settings.allowSelfApproval,
    })

    if (record.status === "ARCHIVED") {
      throw forbidden("Archived records cannot accept new attachments.")
    }
    if (!canEditRecord(scope, record) && !review.allowed) {
      throw forbidden("You do not have permission to attach files to this record.")
    }

    enforceRateLimit(request, `attachments:upload:${user.id}`, {
      limit: 30,
      windowMs: 60_000,
    })

    const formData = await request.formData()
    const file = formData.get("file")
    if (!(file instanceof File)) {
      throw badRequest("Choose a file to upload.")
    }

    const stored = await saveAttachment(file, record.id)
    const attachment = await prisma.attachment.create({
      data: {
        recordId: record.id,
        fileName: stored.fileName,
        storageKey: stored.storageKey,
        mimeType: stored.mimeType,
        size: stored.size,
        data: stored.data,
        uploadedById: user.id,
      },
      select: {
        id: true,
        fileName: true,
        mimeType: true,
        size: true,
        createdAt: true,
      },
    })

    await writeAudit({
      actorId: user.id,
      action: "UPDATE",
      entityType: "DataRecord",
      entityId: record.id,
      summary: `Attached ${stored.fileName} to ${record.recordNumber}`,
      metadata: { attachmentId: attachment.id, size: stored.size },
    })

    return created(attachment)
  } catch (error) {
    return errorResponse(error)
  }
}

export async function DELETE(request: NextRequest, context: Context) {
  try {
    assertSameOrigin(request)
    const { user, scope } = await requireApiScope()
    const { id } = await context.params
    const attachmentId = request.nextUrl.searchParams.get("attachmentId")
    if (!attachmentId) throw notFound("Attachment not found.")

    const attachment = await prisma.attachment.findFirst({
      where: { id: attachmentId, recordId: id },
      include: {
        record: {
          select: {
            id: true,
            recordNumber: true,
            branchId: true,
            createdById: true,
            status: true,
          },
        },
      },
    })
    if (!attachment) throw notFound("Attachment not found.")

    const record = attachment.record

    if (
      !canEditRecord(scope, record) &&
      attachment.uploadedById !== user.id
    ) {
      throw forbidden("You do not have permission to remove this attachment.")
    }

    await prisma.attachment.delete({ where: { id: attachment.id } })
    await deleteAttachmentFile(attachment)

    await writeAudit({
      actorId: user.id,
      action: "UPDATE",
      entityType: "DataRecord",
      entityId: record.id,
      summary: `Removed attachment ${attachment.fileName} from ${record.recordNumber}`,
      metadata: { attachmentId },
    })

    return ok({ id: attachment.id })
  } catch (error) {
    return errorResponse(error)
  }
}
