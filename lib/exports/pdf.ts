import "server-only"

import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib"

import { formatIsoDate } from "@/lib/format"
import type {
  ExportCellValue,
  ExportColumn,
  ExportRow,
} from "@/lib/exports/csv"
import type { ReportExportRow } from "@/lib/services/reports"

export type PdfMeta = {
  title: string
  subtitle?: string
  generatedBy: string
  generatedAt: Date
  filters?: Record<string, string | undefined>
}

const PAGE_WIDTH = 792
const PAGE_HEIGHT = 612
const MARGIN = 32
const BOTTOM_LIMIT = 40
const BODY_SIZE = 7
const BODY_LINE_HEIGHT = 8.6
const ROW_PADDING = 4
const HEADER_SIZE = 7

type Column = {
  header: string
  width: number
  value: (row: ReportExportRow) => string
  wrap?: boolean
}

const COLUMNS: Column[] = [
  { header: "RECORD NO.", width: 80, value: (row) => row.recordNumber },
  {
    header: "DATE",
    width: 55,
    value: (row) => formatIsoDate(row.recordDate),
  },
  {
    header: "BRANCH",
    width: 105,
    value: (row) => `${row.branch.name} (${row.branch.code})`,
    wrap: true,
  },
  {
    header: "CATEGORY",
    width: 80,
    value: (row) => row.category.name,
    wrap: true,
  },
  { header: "TITLE", width: 168, value: (row) => row.title, wrap: true },
  { header: "STATUS", width: 55, value: (row) => row.status },
  {
    header: "SUBMITTED",
    width: 55,
    value: (row) => formatIsoDate(row.submittedAt),
  },
  {
    header: "APPROVED",
    width: 55,
    value: (row) => formatIsoDate(row.approvedAt),
  },
  {
    header: "CREATED BY",
    width: 75,
    value: (row) => row.createdBy.name,
    wrap: true,
  },
]

const INK = rgb(0.12, 0.16, 0.18)
const MUTED = rgb(0.42, 0.47, 0.49)
const RULE = rgb(0.78, 0.82, 0.83)
const BAND = rgb(0.965, 0.972, 0.973)
const BRAND = rgb(0.12, 0.29, 0.35)
const WHITE = rgb(1, 1, 1)

const STATUS_COLORS: Record<string, ReturnType<typeof rgb>> = {
  APPROVED: rgb(0.1, 0.45, 0.35),
  REJECTED: rgb(0.7, 0.2, 0.2),
  SUBMITTED: rgb(0.15, 0.4, 0.62),
  RETURNED: rgb(0.65, 0.45, 0.1),
  DRAFT: rgb(0.42, 0.47, 0.49),
  ARCHIVED: rgb(0.5, 0.5, 0.5),
}

function widthOf(font: PDFFont, text: string, size: number): number {
  return font.widthOfTextAtSize(text, size)
}

function wrapLines(
  font: PDFFont,
  text: string,
  size: number,
  maxWidth: number,
  maxLines = 2
): string[] {
  const normalized = sanitizePdfText(text).replace(/\s+/g, " ").trim()
  if (!normalized) return [""]

  const words = normalized.split(" ")
  const lines: string[] = []
  let current = ""

  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word
    if (widthOf(font, candidate, size) <= maxWidth) {
      current = candidate
      continue
    }

    if (current) {
      lines.push(current)
      current = word
    } else {
      // A single word longer than the cell: hard split it.
      let remainder = word
      while (remainder.length > 0) {
        let slice = remainder
        while (slice.length > 1 && widthOf(font, slice, size) > maxWidth) {
          slice = slice.slice(0, -1)
        }
        lines.push(slice)
        remainder = remainder.slice(slice.length)
        if (lines.length >= maxLines) break
      }
      current = ""
    }

    if (lines.length >= maxLines) break
  }

  if (lines.length < maxLines && current) lines.push(current)
  if (lines.length === 0) lines.push("")

  if (lines.length > maxLines) lines.length = maxLines

  // Add an ellipsis when content was dropped.
  const consumed = lines.join(" ")
  if (consumed.length < normalized.length) {
    const lastIndex = lines.length - 1
    let last = lines[lastIndex] ?? ""
    while (last.length > 0 && widthOf(font, `${last}…`, size) > maxWidth) {
      last = last.slice(0, -1)
    }
    lines[lastIndex] = `${last}…`
  }

  return lines
}

export async function buildReportPdf(
  rows: ReportExportRow[],
  meta: PdfMeta
): Promise<Uint8Array> {
  const document = await PDFDocument.create()
  document.setTitle(sanitizePdfText(meta.title))
  document.setAuthor("Dana Company")
  document.setCreator("Dana Company Operations Data")
  document.setProducer("Dana Company Operations Data")
  document.setCreationDate(meta.generatedAt)

  const regular = await document.embedFont(StandardFonts.Helvetica)
  const bold = await document.embedFont(StandardFonts.HelveticaBold)
  const pages: PDFPage[] = []

  const tableWidth = COLUMNS.reduce((sum, column) => sum + column.width, 0)
  const left = Math.max(MARGIN, (PAGE_WIDTH - tableWidth) / 2)

  function newPage(withIntro: boolean): { page: PDFPage; y: number } {
    const page = document.addPage([PAGE_WIDTH, PAGE_HEIGHT])
    pages.push(page)

    page.drawRectangle({
      x: 0,
      y: PAGE_HEIGHT - 4,
      width: PAGE_WIDTH,
      height: 4,
      color: BRAND,
    })

    page.drawText("DANA COMPANY", {
      x: left,
      y: PAGE_HEIGHT - 40,
      size: 9,
      font: bold,
      color: BRAND,
    })
    page.drawText(withIntro ? sanitizePdfText(meta.title) : `${sanitizePdfText(meta.title)} (continued)`, {
      x: left,
      y: PAGE_HEIGHT - 56,
      size: 16,
      font: bold,
      color: INK,
    })

    const generated = `${sanitizePdfText(meta.generatedBy)} · ${meta.generatedAt
      .toISOString()
      .replace("T", " ")
      .slice(0, 16)} UTC · ${rows.length} record${rows.length === 1 ? "" : "s"}`
    page.drawText(generated, {
      x: left,
      y: PAGE_HEIGHT - 70,
      size: 7,
      font: regular,
      color: MUTED,
    })

    let y = PAGE_HEIGHT - 86

    if (withIntro && meta.filters) {
      const filterText = Object.entries(meta.filters)
        .filter(([, value]) => Boolean(value))
        .map(([key, value]) => `${key}: ${value}`)
        .join("   ")
      if (filterText) {
        page.drawText(sanitizePdfText(filterText).slice(0, 180), {
          x: left,
          y,
          size: 7,
          font: regular,
          color: MUTED,
        })
        y -= 10
      }
    }

    if (meta.subtitle && withIntro) {
      page.drawText(sanitizePdfText(meta.subtitle).slice(0, 180), {
        x: left,
        y,
        size: 7,
        font: regular,
        color: MUTED,
      })
      y -= 10
    }

    y -= 4

    // Table header band
    page.drawRectangle({
      x: left,
      y: y - 16,
      width: tableWidth,
      height: 16,
      color: BRAND,
    })

    let x = left
    for (const column of COLUMNS) {
      page.drawText(column.header, {
        x: x + 3,
        y: y - 11,
        size: HEADER_SIZE,
        font: bold,
        color: WHITE,
      })
      x += column.width
    }

    y -= 16

    return { page, y }
  }

  let { page, y } = newPage(true)

  if (rows.length === 0) {
    page.drawText("No records matched the selected filters.", {
      x: left,
      y: y - 24,
      size: 10,
      font: regular,
      color: MUTED,
    })
  }

  for (const [index, row] of rows.entries()) {
    const cellLines = COLUMNS.map((column) =>
      wrapLines(regular, column.value(row), BODY_SIZE, column.width - 6, 2)
    )
    const lines = Math.max(1, ...cellLines.map((cell) => cell.length))
    const rowHeight = lines * BODY_LINE_HEIGHT + ROW_PADDING * 2

    if (y - rowHeight < BOTTOM_LIMIT) {
      const next = newPage(false)
      page = next.page
      y = next.y
    }

    if (index % 2 === 1) {
      page.drawRectangle({
        x: left,
        y: y - rowHeight,
        width: tableWidth,
        height: rowHeight,
        color: BAND,
      })
    }

    let x = left
    for (const [columnIndex, column] of COLUMNS.entries()) {
      const cell = cellLines[columnIndex] ?? [""]
      const color =
        column.header === "STATUS"
          ? STATUS_COLORS[row.status] ?? INK
          : INK
      const font = column.header === "RECORD NO." ? bold : regular

      cell.forEach((line, lineIndex) => {
        page.drawText(line, {
          x: x + 3,
          y: y - ROW_PADDING - BODY_SIZE - lineIndex * BODY_LINE_HEIGHT,
          size: BODY_SIZE,
          font,
          color,
        })
      })
      x += column.width
    }

    y -= rowHeight
    page.drawLine({
      start: { x: left, y },
      end: { x: left + tableWidth, y },
      thickness: 0.4,
      color: RULE,
    })
  }

  const pageCount = pages.length
  pages.forEach((current, index) => {
    current.drawLine({
      start: { x: left, y: 30 },
      end: { x: left + tableWidth, y: 30 },
      thickness: 0.4,
      color: RULE,
    })
    current.drawText("Confidential — internal use only", {
      x: left,
      y: 18,
      size: 7,
      font: regular,
      color: MUTED,
    })
    const pageLabel = `Page ${index + 1} of ${pageCount}`
    current.drawText(pageLabel, {
      x: left + tableWidth - widthOf(regular, pageLabel, 7),
      y: 18,
      size: 7,
      font: regular,
      color: MUTED,
    })
  })

  return document.save()
}

export type PdfOptions = {
  /** Defaults to the current time. */
  generatedAt?: Date
  /** Human-readable summary of the applied filters. */
  filtersSummary?: string
  /** Optional second line under the title. */
  subtitle?: string
  /** Optional operator name shown next to the generated timestamp. */
  generatedBy?: string
}

const EXPORT_PAGE_WIDTH = 841.89
const EXPORT_PAGE_HEIGHT = 595.28
const EXPORT_MARGIN = 36
const EXPORT_TITLE_SIZE = 18
const EXPORT_BODY_SIZE = 8
const EXPORT_ROW_HEIGHT = 15
const EXPORT_CELL_PADDING = 4
const EXPORT_FOOTER_SPACE = 30
const EXPORT_USABLE_WIDTH = EXPORT_PAGE_WIDTH - EXPORT_MARGIN * 2

const EXPORT_HEADER_BG = rgb(0.12, 0.16, 0.22)
const EXPORT_TEXT_COLOR = rgb(0.1, 0.11, 0.13)
const EXPORT_MUTED = rgb(0.42, 0.45, 0.5)
const EXPORT_BORDER = rgb(0.82, 0.84, 0.87)
const EXPORT_ZEBRA = rgb(0.96, 0.97, 0.98)

/**
 * Generic A4-landscape table PDF. Long values are truncated to their column,
 * the header row repeats on every page, and text is reduced to characters
 * supported by the built-in WinAnsi fonts.
 */
export async function toPdf(
  title: string,
  columns: readonly ExportColumn[],
  rows: readonly ExportRow[],
  meta: PdfOptions = {}
): Promise<Uint8Array> {
  const document = await PDFDocument.create()
  const font = await document.embedFont(StandardFonts.Helvetica)
  const bold = await document.embedFont(StandardFonts.HelveticaBold)

  const safeTitle = sanitizePdfText(title) || "Export"
  document.setTitle(safeTitle)
  document.setCreator("Records export")
  document.setProducer("pdf-lib")

  const generatedAt = meta.generatedAt ?? new Date()
  const labels = columns.map((column) => sanitizePdfText(column.label))
  const cells = rows.map((row) =>
    columns.map((column) => sanitizePdfText(exportCellText(row[column.key])))
  )
  const widths = computeExportWidths(labels, cells, font, bold)
  const filterLines = meta.filtersSummary
    ? wrapExportText(
        sanitizePdfText(meta.filtersSummary),
        font,
        EXPORT_BODY_SIZE,
        EXPORT_USABLE_WIDTH,
        2
      )
    : []

  let page = document.addPage([EXPORT_PAGE_WIDTH, EXPORT_PAGE_HEIGHT])
  let y = EXPORT_PAGE_HEIGHT - EXPORT_MARGIN

  page.drawText(clipExportText(safeTitle, bold, EXPORT_TITLE_SIZE, EXPORT_USABLE_WIDTH), {
    x: EXPORT_MARGIN,
    y: y - EXPORT_TITLE_SIZE,
    size: EXPORT_TITLE_SIZE,
    font: bold,
    color: EXPORT_TEXT_COLOR,
  })
  y -= EXPORT_TITLE_SIZE + 6

  if (meta.subtitle) {
    const subtitle = sanitizePdfText(meta.subtitle)
    if (subtitle) {
      page.drawText(clipExportText(subtitle, font, 9.5, EXPORT_USABLE_WIDTH), {
        x: EXPORT_MARGIN,
        y: y - 9.5,
        size: 9.5,
        font,
        color: EXPORT_MUTED,
      })
      y -= 14
    }
  }

  const generatedLabel = `Generated ${formatExportTimestamp(generatedAt)}${
    meta.generatedBy ? ` by ${sanitizePdfText(meta.generatedBy)}` : ""
  }`
  page.drawText(
    clipExportText(generatedLabel, font, EXPORT_BODY_SIZE, EXPORT_USABLE_WIDTH),
    {
      x: EXPORT_MARGIN,
      y: y - EXPORT_BODY_SIZE,
      size: EXPORT_BODY_SIZE,
      font,
      color: EXPORT_MUTED,
    }
  )
  y -= 14

  for (const line of filterLines) {
    page.drawText(line, {
      x: EXPORT_MARGIN,
      y: y - EXPORT_BODY_SIZE,
      size: EXPORT_BODY_SIZE,
      font,
      color: EXPORT_MUTED,
    })
    y -= 10
  }

  y -= 8

  const drawTableHeader = () => {
    page.drawRectangle({
      x: EXPORT_MARGIN,
      y: y - EXPORT_ROW_HEIGHT,
      width: EXPORT_USABLE_WIDTH,
      height: EXPORT_ROW_HEIGHT,
      color: EXPORT_HEADER_BG,
    })

    let x = EXPORT_MARGIN
    for (let index = 0; index < labels.length; index += 1) {
      const text = clipExportText(
        labels[index],
        bold,
        EXPORT_BODY_SIZE,
        Math.max(0, widths[index] - EXPORT_CELL_PADDING * 2)
      )
      if (text) {
        page.drawText(text, {
          x: x + EXPORT_CELL_PADDING,
          y: y - EXPORT_ROW_HEIGHT + 4.5,
          size: EXPORT_BODY_SIZE,
          font: bold,
          color: rgb(1, 1, 1),
        })
      }
      x += widths[index]
    }

    y -= EXPORT_ROW_HEIGHT
  }

  if (y - EXPORT_ROW_HEIGHT < EXPORT_MARGIN + EXPORT_FOOTER_SPACE) {
    page = document.addPage([EXPORT_PAGE_WIDTH, EXPORT_PAGE_HEIGHT])
    y = EXPORT_PAGE_HEIGHT - EXPORT_MARGIN
  }
  drawTableHeader()

  if (cells.length === 0) {
    page.drawText("No rows match the selected filters.", {
      x: EXPORT_MARGIN,
      y: y - 12,
      size: 9,
      font,
      color: EXPORT_MUTED,
    })
  } else {
    for (let rowIndex = 0; rowIndex < cells.length; rowIndex += 1) {
      if (y - EXPORT_ROW_HEIGHT < EXPORT_MARGIN + EXPORT_FOOTER_SPACE) {
        page = document.addPage([EXPORT_PAGE_WIDTH, EXPORT_PAGE_HEIGHT])
        y = EXPORT_PAGE_HEIGHT - EXPORT_MARGIN
        drawTableHeader()
      }

      if (rowIndex % 2 === 1) {
        page.drawRectangle({
          x: EXPORT_MARGIN,
          y: y - EXPORT_ROW_HEIGHT,
          width: EXPORT_USABLE_WIDTH,
          height: EXPORT_ROW_HEIGHT,
          color: EXPORT_ZEBRA,
        })
      }

      let x = EXPORT_MARGIN
      for (
        let columnIndex = 0;
        columnIndex < cells[rowIndex].length;
        columnIndex += 1
      ) {
        const text = clipExportText(
          cells[rowIndex][columnIndex],
          font,
          EXPORT_BODY_SIZE,
          Math.max(0, widths[columnIndex] - EXPORT_CELL_PADDING * 2)
        )

        if (text) {
          const rawValue = rows[rowIndex]?.[columns[columnIndex].key]
          const textWidth = font.widthOfTextAtSize(text, EXPORT_BODY_SIZE)
          const textX =
            typeof rawValue === "number"
              ? x + widths[columnIndex] - EXPORT_CELL_PADDING - textWidth
              : x + EXPORT_CELL_PADDING

          page.drawText(text, {
            x: textX,
            y: y - EXPORT_ROW_HEIGHT + 4.5,
            size: EXPORT_BODY_SIZE,
            font,
            color: EXPORT_TEXT_COLOR,
          })
        }

        x += widths[columnIndex]
      }

      page.drawLine({
        start: { x: EXPORT_MARGIN, y: y - EXPORT_ROW_HEIGHT },
        end: { x: EXPORT_MARGIN + EXPORT_USABLE_WIDTH, y: y - EXPORT_ROW_HEIGHT },
        thickness: 0.25,
        color: EXPORT_BORDER,
      })
      y -= EXPORT_ROW_HEIGHT
    }
  }

  const pages = document.getPages()
  pages.forEach((currentPage, index) => {
    currentPage.drawLine({
      start: { x: EXPORT_MARGIN, y: 24 },
      end: { x: EXPORT_PAGE_WIDTH - EXPORT_MARGIN, y: 24 },
      thickness: 0.5,
      color: EXPORT_BORDER,
    })

    currentPage.drawText(
      clipExportText(safeTitle, font, EXPORT_BODY_SIZE, EXPORT_USABLE_WIDTH / 2),
      {
        x: EXPORT_MARGIN,
        y: 14,
        size: EXPORT_BODY_SIZE,
        font,
        color: EXPORT_MUTED,
      }
    )

    const pageLabel = `Page ${index + 1} of ${pages.length}`
    currentPage.drawText(pageLabel, {
      x:
        EXPORT_PAGE_WIDTH -
        EXPORT_MARGIN -
        font.widthOfTextAtSize(pageLabel, EXPORT_BODY_SIZE),
      y: 14,
      size: EXPORT_BODY_SIZE,
      font,
      color: EXPORT_MUTED,
    })
  })

  return document.save()
}

function computeExportWidths(
  labels: string[],
  cells: string[][],
  font: PDFFont,
  bold: PDFFont
): number[] {
  const desired = labels.map((label, columnIndex) => {
    let widest = bold.widthOfTextAtSize(label, EXPORT_BODY_SIZE)
    const sampleSize = Math.min(cells.length, 100)

    for (let rowIndex = 0; rowIndex < sampleSize; rowIndex += 1) {
      widest = Math.max(
        widest,
        font.widthOfTextAtSize(
          cells[rowIndex][columnIndex] ?? "",
          EXPORT_BODY_SIZE
        )
      )
    }

    return clampExportWidth(
      widest + EXPORT_CELL_PADDING * 2,
      32,
      220
    )
  })

  const total = desired.reduce((sum, width) => sum + width, 0)
  if (total === 0 || EXPORT_USABLE_WIDTH <= 0) return desired

  const scale = EXPORT_USABLE_WIDTH / total
  return desired.map((width) => width * scale)
}

function clipExportText(
  text: string,
  font: PDFFont,
  size: number,
  maxWidth: number
): string {
  if (!text) return ""
  if (font.widthOfTextAtSize(text, size) <= maxWidth) return text

  const suffix = "..."
  const suffixWidth = font.widthOfTextAtSize(suffix, size)
  if (maxWidth <= suffixWidth) return ""

  let result = ""
  let width = 0

  for (const character of text) {
    const characterWidth = font.widthOfTextAtSize(character, size)
    if (width + characterWidth + suffixWidth > maxWidth) break
    result += character
    width += characterWidth
  }

  return `${result.trimEnd()}${suffix}`
}

function wrapExportText(
  text: string,
  font: PDFFont,
  size: number,
  maxWidth: number,
  maxLines: number
): string[] {
  const words = text.split(/\s+/).filter(Boolean)
  const lines: string[] = []
  let current = ""

  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word

    if (font.widthOfTextAtSize(candidate, size) <= maxWidth) {
      current = candidate
      continue
    }

    if (current) lines.push(current)
    current = word

    if (lines.length >= maxLines) {
      current = ""
      break
    }
  }

  if (current && lines.length < maxLines) lines.push(current)

  return lines
    .slice(0, maxLines)
    .map((line) => clipExportText(line, font, size, maxWidth))
}

const EXPORT_WIN_ANSI_DISALLOWED =
  /[^\x20-\x7E\xA0-\xFF€‚ƒ„…†‡ˆ‰Š‹ŒŽ‘’“”•–—˜™š›œžŸ]/gu

/** Replace characters the built-in WinAnsi fonts cannot encode with "-". */
function sanitizePdfText(value: string): string {
  return value
    .replace(/[\r\n\t]+/g, " ")
    .replace(EXPORT_WIN_ANSI_DISALLOWED, "-")
}

function exportCellText(value: ExportCellValue | undefined): string {
  if (value === null || value === undefined) return ""
  return String(value)
}

function formatExportTimestamp(value: Date): string {
  const iso = value.toISOString()
  return `${iso.slice(0, 10)} ${iso.slice(11, 16)} UTC`
}

function clampExportWidth(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}
