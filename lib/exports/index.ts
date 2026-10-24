import "server-only"

import { buildReportCsv } from "@/lib/exports/csv"
import { buildReportPdf } from "@/lib/exports/pdf"
import { buildReportXlsx, defaultExportFilename } from "@/lib/exports/xlsx"
import type { ReportExportRow } from "@/lib/services/reports"

export { buildReportCsv, reportColumns, toCsv } from "@/lib/exports/csv"
export type {
  CsvOptions,
  ExportCellValue,
  ExportColumn,
  ExportRow,
  ReportColumn,
} from "@/lib/exports/csv"
export { buildReportXlsx, defaultExportFilename, toXlsx } from "@/lib/exports/xlsx"
export { buildReportPdf, toPdf } from "@/lib/exports/pdf"
export type { PdfMeta, PdfOptions } from "@/lib/exports/pdf"
export type { WorkbookMeta } from "@/lib/exports/xlsx"

export type ExportFormat = "csv" | "xlsx" | "pdf"

export type ExportMeta = {
  title: string
  subtitle?: string
  generatedBy: string
  generatedAt: Date
  filters?: Record<string, string | undefined>
}

export type ExportResult = {
  bytes: Uint8Array
  filename: string
  contentType: string
  format: ExportFormat
}

const CONTENT_TYPES: Record<ExportFormat, string> = {
  csv: "text/csv; charset=utf-8",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  pdf: "application/pdf",
}

export async function buildExport(
  format: ExportFormat,
  rows: ReportExportRow[],
  meta: ExportMeta
): Promise<ExportResult> {
  const generatedAt = meta.generatedAt

  switch (format) {
    case "csv":
      return {
        bytes: buildReportCsv(rows),
        filename: defaultExportFilename("csv", generatedAt),
        contentType: CONTENT_TYPES.csv,
        format,
      }
    case "xlsx":
      return {
        bytes: await buildReportXlsx(rows, meta),
        filename: defaultExportFilename("xlsx", generatedAt),
        contentType: CONTENT_TYPES.xlsx,
        format,
      }
    case "pdf":
      return {
        bytes: await buildReportPdf(rows, meta),
        filename: defaultExportFilename("pdf", generatedAt),
        contentType: CONTENT_TYPES.pdf,
        format,
      }
  }
}
