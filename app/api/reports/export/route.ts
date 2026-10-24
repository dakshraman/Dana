import type { NextRequest } from "next/server"

import { enforceRateLimit, parseQuery } from "@/lib/api"
import { writeAudit } from "@/lib/audit"
import { errorResponse, forbidden } from "@/lib/http"
import {
  defaultExportFilename,
  toCsv,
  toPdf,
  toXlsx,
} from "@/lib/exports"
import { getReportExportRows } from "@/lib/services/reports"
import { requireApiScope } from "@/lib/session"
import { exportQuerySchema } from "@/lib/validations/report"

export const dynamic = "force-dynamic"

const CONTENT_TYPES = {
  csv: "text/csv; charset=utf-8",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  pdf: "application/pdf",
} as const

export async function GET(request: NextRequest) {
  try {
    const { user, scope } = await requireApiScope()
    if (!scope.canExport) {
      throw forbidden("You do not have permission to export records.")
    }

    enforceRateLimit(request, "reports:export", {
      limit: 12,
      windowMs: 60_000,
    })

    const query = parseQuery(request, exportQuerySchema)
    const report = await getReportExportRows(scope, query)
    const generatedAt = new Date()
    const title = report.title

    let bytes: Uint8Array
    if (query.format === "csv") {
      bytes = new TextEncoder().encode(
        toCsv(report.columns, report.rows, { bom: true })
      )
    } else if (query.format === "xlsx") {
      bytes = await toXlsx(title, report.columns, report.rows)
    } else {
      bytes = await toPdf(title, report.columns, report.rows, {
        generatedAt,
        generatedBy: user.name,
        filtersSummary: report.filtersSummary,
      })
    }

    await writeAudit({
      actorId: user.id,
      action: "EXPORT",
      entityType: "DataRecord",
      summary: `Exported ${report.rows.length} record(s) as ${query.format.toUpperCase()}`,
      metadata: {
        format: query.format,
        rows: report.rows.length,
        filters: report.filtersSummary,
      },
    })

    const filename = defaultExportFilename(query.format, generatedAt)

    return new Response(new Uint8Array(bytes), {
      headers: {
        "Content-Type": CONTENT_TYPES[query.format],
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    })
  } catch (error) {
    return errorResponse(error)
  }
}
