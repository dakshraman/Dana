"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { Download, FileText, Loader2, Paperclip, Trash2, Upload } from "lucide-react"
import { toast } from "sonner"

import { EmptyState } from "@/components/shared/empty-state"
import { Button } from "@/components/ui/button"
import { errorMessage } from "@/lib/client-api"
import { formatDate, formatFileSize } from "@/lib/format"

export type AttachmentItem = {
  id: string
  fileName: string
  mimeType: string
  size: number
  createdAt: Date | string
  uploadedBy: { id: string; name: string }
}

function fileSizeLabel(size: number) {
  return formatFileSize(size)
}

export function RecordAttachments({
  recordId,
  attachments,
  canUpload,
  canDelete,
}: {
  recordId: string
  attachments: AttachmentItem[]
  canUpload: boolean
  canDelete: boolean
}) {
  const router = useRouter()
  const inputRef = React.useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = React.useState(false)
  const [deletingId, setDeletingId] = React.useState<string | null>(null)

  async function upload(file: File) {
    setUploading(true)
    try {
      const body = new FormData()
      body.set("file", file)
      const response = await fetch(`/api/records/${recordId}/attachments`, {
        method: "POST",
        body,
      })
      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as
          | { error?: { message?: string } }
          | null
        throw new Error(payload?.error?.message ?? "Upload failed.")
      }
      toast.success("Attachment uploaded.")
      if (inputRef.current) inputRef.current.value = ""
      router.refresh()
    } catch (error) {
      toast.error(errorMessage(error))
    } finally {
      setUploading(false)
    }
  }

  async function remove(id: string) {
    setDeletingId(id)
    try {
      const response = await fetch(`/api/attachments/${id}`, { method: "DELETE" })
      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as
          | { error?: { message?: string } }
          | null
        throw new Error(payload?.error?.message ?? "Delete failed.")
      }
      toast.success("Attachment removed.")
      router.refresh()
    } catch (error) {
      toast.error(errorMessage(error))
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {canUpload ? (
        <div className="flex flex-wrap items-center gap-3 border border-dashed p-4">
          <input
            ref={inputRef}
            type="file"
            className="hidden"
            accept=".pdf,.png,.jpg,.jpeg,.webp,.txt,.csv,.xlsx,.xls"
            onChange={(event) => {
              const file = event.target.files?.[0]
              if (file) void upload(file)
            }}
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={uploading}
            onClick={() => inputRef.current?.click()}
          >
            {uploading ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Upload className="size-4" />
            )}
            {uploading ? "Uploading..." : "Upload file"}
          </Button>
          <p className="text-xs text-muted-foreground">
            PDF, image, CSV, text or spreadsheet · up to 10 MB
          </p>
        </div>
      ) : null}

      {attachments.length === 0 ? (
        <EmptyState
          icon={Paperclip}
          title="No attachments"
          description="Supporting documents uploaded to this record will appear here."
          className="border-0 bg-transparent py-6"
        />
      ) : (
        <ul className="divide-y border">
          {attachments.map((attachment) => (
            <li
              key={attachment.id}
              className="flex flex-wrap items-center gap-3 p-3"
            >
              <FileText className="size-4 shrink-0 text-muted-foreground" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{attachment.fileName}</p>
                <p className="text-xs text-muted-foreground">
                  {fileSizeLabel(attachment.size)} · {attachment.uploadedBy.name} ·{" "}
                  {formatDate(attachment.createdAt)}
                </p>
              </div>
              <div className="flex items-center gap-1.5">
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`Download ${attachment.fileName}`}
                  render={
                    <a
                      href={`/api/attachments/${attachment.id}`}
                      download={attachment.fileName}
                    />
                  }
                >
                  <Download className="size-4" />
                </Button>
                {canDelete ? (
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label={`Delete ${attachment.fileName}`}
                    disabled={deletingId === attachment.id}
                    onClick={() => void remove(attachment.id)}
                  >
                    {deletingId === attachment.id ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <Trash2 className="size-4" />
                    )}
                  </Button>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
