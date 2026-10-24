import "server-only"

import { cache } from "react"

import { prisma } from "@/lib/db"

export const SETTING_KEYS = {
  companyName: "company.name",
  timezone: "company.timezone",
  allowSelfApproval: "workflow.allowSelfApproval",
  overdueDays: "workflow.overdueDays",
} as const

export type SystemSettings = {
  companyName: string
  timezone: string
  allowSelfApproval: boolean
  overdueDays: number
}

export const DEFAULT_SETTINGS: SystemSettings = {
  companyName: "Dana Company",
  timezone: process.env.COMPANY_TIMEZONE ?? "Asia/Kolkata",
  allowSelfApproval: false,
  overdueDays: 7,
}

export const getSystemSettings = cache(
  async (): Promise<SystemSettings> => {
    const rows = await prisma.systemSetting.findMany({
      where: { key: { in: Object.values(SETTING_KEYS) } },
    })

    const map = new Map(rows.map((row) => [row.key, row.value]))
    const value = (key: string) => map.get(key)

    return {
      companyName: asString(
        value(SETTING_KEYS.companyName),
        DEFAULT_SETTINGS.companyName
      ),
      timezone: asString(value(SETTING_KEYS.timezone), DEFAULT_SETTINGS.timezone),
      allowSelfApproval: asBoolean(
        value(SETTING_KEYS.allowSelfApproval),
        DEFAULT_SETTINGS.allowSelfApproval
      ),
      overdueDays: asNumber(
        value(SETTING_KEYS.overdueDays),
        DEFAULT_SETTINGS.overdueDays
      ),
    }
  }
)

function asString(value: unknown, fallback: string): string {
  return typeof value === "string" && value.length > 0 ? value : fallback
}

function asBoolean(value: unknown, fallback: boolean): boolean {
  return typeof value === "boolean" ? value : fallback
}

function asNumber(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback
}
