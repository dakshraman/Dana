import "server-only"

import { randomUUID } from "node:crypto"
import { mkdir, readFile, rm, writeFile } from "node:fs/promises"
import path from "node:path"

import { badRequest, notFound } from "@/lib/http"

const DEFAULT_UPLOAD_DIR = "./storage/attachments"
const DEFAULT_MAX_MB = 10

export const ATTACHMENT_MIME_TYPES = new Map<string, string>([
  ["application/pdf", "pdf"],
  ["image/png", "png"],
  ["image/jpeg", "jpg"],
  ["image/webp", "webp"],
  ["text/plain", "txt"],
  ["text/csv", "csv"],
  [
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "xlsx",
  ],
  ["application/vnd.ms-excel", "xls"],
])

export type StoredFile = {
  storageKey: string
  fileName: string
  mimeType: string
  size: number
  /** Present only when the database driver is active. */
  data: Uint8Array<ArrayBuffer> | null
}

export type StoredAttachment = {
  storageKey: string
  data?: Uint8Array<ArrayBuffer> | null
}

/**
 * Serverless platforms (Netlify, Vercel, Lambda) have an ephemeral and often
 * read-only filesystem. Set `ATTACHMENT_STORAGE=database` there to keep
 * attachment bytes in PostgreSQL. Self-hosted deployments should leave it
 * unset and persist `UPLOAD_DIR` on a volume.
 */
export function attachmentStorageDriver(): "filesystem" | "database" {
  return process.env.ATTACHMENT_STORAGE === "database"
    ? "database"
    : "filesystem"
}

export function uploadRoot(): string {
  // Resolve relative to the project root so the tracer can scope filesystem
  // access to a known subdirectory. An absolute UPLOAD_DIR is treated as
  // relative for the same reason; use a bind mount at ./storage instead.
  const configured = (process.env.UPLOAD_DIR ?? DEFAULT_UPLOAD_DIR).replace(
    /^[/\\]+/,
    ""
  )
  // Runtime data is not a build input; opt out of full-project tracing.
  return path.join(/* turbopackIgnore: true */ process.cwd(), configured)
}

export function maxUploadBytes(): number {
  const mb = Number(process.env.MAX_UPLOAD_MB ?? DEFAULT_MAX_MB)
  return (Number.isFinite(mb) && mb > 0 ? mb : DEFAULT_MAX_MB) * 1024 * 1024
}

function safeFileName(name: string): string {
  const base = path.basename(name).replace(/[^\w.\- ()]+/g, "_")
  const trimmed = base.trim().slice(0, 180)
  return trimmed.length > 0 ? trimmed : "attachment"
}

/** Keep every write inside the configured upload directory. */
function resolveStorageKey(storageKey: string): string {
  const root = uploadRoot()
  const resolved = path.resolve(
    /* turbopackIgnore: true */ root,
    storageKey
  )
  if (resolved !== root && !resolved.startsWith(`${root}${path.sep}`)) {
    throw badRequest("Invalid attachment path.")
  }
  return resolved
}

export async function saveAttachment(
  file: File,
  recordId: string
): Promise<StoredFile> {
  if (!file || file.size === 0) {
    throw badRequest("Choose a file to upload.")
  }

  const limit = maxUploadBytes()
  if (file.size > limit) {
    throw badRequest(
      `The file is larger than the ${Math.round(limit / (1024 * 1024))} MB limit.`
    )
  }

  const extension = ATTACHMENT_MIME_TYPES.get(file.type)
  if (!extension) {
    throw badRequest(
      "Unsupported file type. Upload a PDF, image, CSV, text file or spreadsheet."
    )
  }

  const fileName = safeFileName(file.name)
  const storageKey = path.posix.join(recordId, `${randomUUID()}.${extension}`)
  const bytes = new Uint8Array(await file.arrayBuffer())

  if (attachmentStorageDriver() === "database") {
    return {
      storageKey,
      fileName,
      mimeType: file.type,
      size: file.size,
      data: bytes,
    }
  }

  const destination = resolveStorageKey(storageKey)
  await mkdir(path.dirname(destination), { recursive: true })
  await writeFile(destination, bytes, { flag: "wx", mode: 0o600 })

  return {
    storageKey,
    fileName,
    mimeType: file.type,
    size: file.size,
    data: null,
  }
}

export async function readAttachment(
  attachment: StoredAttachment
): Promise<Uint8Array> {
  if (attachment.data) {
    return new Uint8Array(attachment.data)
  }

  if (attachmentStorageDriver() === "database") {
    throw notFound("The attachment file is no longer available.")
  }

  try {
    return await readFile(resolveStorageKey(attachment.storageKey))
  } catch {
    throw notFound("The attachment file is no longer available.")
  }
}

export async function deleteAttachmentFile(
  attachment: StoredAttachment
): Promise<void> {
  if (attachment.data) return
  if (attachmentStorageDriver() === "database") return

  await rm(resolveStorageKey(attachment.storageKey), { force: true })
}

export function contentDisposition(fileName: string): string {
  const fallback = fileName.replace(/[^\x20-\x7E]/g, "_").replace(/"/g, "")
  const encoded = encodeURIComponent(fileName)
  return `attachment; filename="${fallback}"; filename*=UTF-8''${encoded}`
}
