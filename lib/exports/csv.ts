import "server-only"

import { formatIsoDate } from "@/lib/format"
import type { ReportExportRow } from "@/lib/services/reports"

export type ExportCellValue = string | number | null

export type ExportColumn = {
  key: string
  label: string
}

export type ExportRow = Record<string, ExportCellValue>

export type CsvOptions = {
  /** Prefix the output with a UTF-8 BOM so Excel detects the encoding. */
  bom?: boolean
}

/**
 * RFC 4180 CSV writer. Fields containing quotes, commas, CR or LF are quoted;
 * embedded quotes are doubled. Rows are separated by CRLF.
 */
export function toCsv(
  columns: readonly ExportColumn[],
  rows: readonly ExportRow[],
  options: CsvOptions | boolean = {}
): string {
  const lines: string[] = []

  if (columns.length > 0) {
    lines.push(columns.map((column) => escapeCsv(column.label)).join(","))
  }

  for (const row of rows) {
    lines.push(
      columns.map((column) => escapeCsv(row[column.key] ?? null)).join(",")
    )
  }

  const body = lines.join("\r\n")
  const bom = typeof options === "boolean" ? options : (options.bom ?? false)
  const prefix = bom ? "\uFEFF" : ""

  if (!body) return prefix
  return `${prefix}${body}\r\n`
}

function escapeCsv(value: ExportCellValue | undefined): string {
  const text = value === null || value === undefined ? "" : String(value)

  if (/[",\r\n]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`
  }

  return text
}

/**
 * Report-specific column definition. Kept as a thin adapter over the generic
 * `ExportColumn`/`ExportRow` API used by the export routes.
 */
export type ReportColumn<Row> = {
  header: string
  value: (row: Row) => string | number | null | undefined
}

export const reportColumns: ReportColumn<ReportExportRow>[] = [
  { header: "Record number", value: (row) => row.recordNumber },
  { header: "Date", value: (row) => formatIsoDate(row.recordDate) },
  { header: "Branch", value: (row) => row.branch.name },
  { header: "Branch code", value: (row) => row.branch.code },
  { header: "City", value: (row) => row.branch.city },
  { header: "Country", value: (row) => row.branch.country },
  { header: "Region", value: (row) => row.branch.region.name },
  { header: "Category", value: (row) => row.category.name },
  { header: "Title", value: (row) => row.title },
  { header: "Reference", value: (row) => row.referenceNumber ?? "" },
  { header: "Status", value: (row) => row.status },
  { header: "Submitted", value: (row) => formatIsoDate(row.submittedAt) },
  { header: "Approved", value: (row) => formatIsoDate(row.approvedAt) },
  { header: "Created by", value: (row) => row.createdBy.name },
  { header: "Approved by", value: (row) => row.approvedBy?.name ?? "" },
]

export function buildReportCsv(
  rows: ReportExportRow[],
  columns: ReportColumn<ReportExportRow>[] = reportColumns
): Uint8Array {
  const genericColumns: ExportColumn[] = columns.map((column, index) => ({
    key: String(index),
    label: column.header,
  }))

  const genericRows: ExportRow[] = rows.map((row) => {
    const output: ExportRow = {}

    columns.forEach((column, index) => {
      const value = column.value(row)
      output[String(index)] = value === undefined ? null : value
    })

    return output
  })

  // A UTF-8 BOM keeps Excel from mangling accented characters in branch names.
  return new TextEncoder().encode(toCsv(genericColumns, genericRows, { bom: true }))
}
