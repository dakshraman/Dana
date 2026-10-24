import type { NextRequest } from "next/server"

import { writeAudit } from "@/lib/audit"
import { prisma } from "@/lib/db"
import {
  assertSameOrigin,
  errorResponse,
  forbidden,
  notFound,
  ok,
} from "@/lib/http"
import { canEditRecord, canViewRecord } from "@/lib/permissions"
import { requireApiScope } from "@/lib/session"
import {
  contentDisposition,
  deleteAttachmentFile,
  readAttachment,
} from "@/lib/storage"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

type Context = { params: Promise<{ id: string }> }

async function loadAttachment(id: string) {
  const attachment = await prisma.attachment.findUnique({
    where: { id },
    include: {
      uploadedBy: { select: { id: true, name: true } },
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
  return attachment
}

export async function GET(_request: NextRequest, context: Context) {
  try {
    const { scope } = await requireApiScope()
    const { id } = await context.params
    const attachment = await loadAttachment(id)

    if (!canViewRecord(scope, attachment.record)) {
      throw forbidden("You do not have access to this attachment.")
    }

    const bytes = await readAttachment(attachment)

    return new Response(new Uint8Array(bytes), {
      headers: {
        "Content-Type": attachment.mimeType,
        "Content-Length": String(bytes.byteLength),
        "Content-Disposition": contentDisposition(attachment.fileName),
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
        "Content-Security-Policy": "default-src 'none'; sandbox",
      },
    })
  } catch (error) {
    return errorResponse(error)
  }
}

export async function DELETE(request: NextRequest, context: Context) {
  try {
    assertSameOrigin(request)
    const { user, scope } = await requireApiScope()
    const { id } = await context.params
    const attachment = await loadAttachment(id)

    if (
      !canEditRecord(scope, attachment.record) &&
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
      entityId: attachment.record.id,
      summary: `Removed attachment ${attachment.fileName} from ${attachment.record.recordNumber}`,
      metadata: { attachmentId: id },
    })

    return ok({ id })
  } catch (error) {
    return errorResponse(error)
  }
}
