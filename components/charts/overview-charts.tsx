"use client"

import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"

import { formatNumber } from "@/lib/format"

export type TrendPoint = {
  label: string
  total: number
  approved: number
}

export function TrendChart({ data }: { data: TrendPoint[] }) {
  if (data.length === 0) {
    return (
      <div className="grid h-64 place-items-center text-sm text-muted-foreground">
        No activity in this period.
      </div>
    )
  }

  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
          <defs>
            <linearGradient id="fillTotal" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--chart-2)" stopOpacity={0.35} />
              <stop offset="100%" stopColor="var(--chart-2)" stopOpacity={0.02} />
            </linearGradient>
            <linearGradient id="fillApproved" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--chart-4)" stopOpacity={0.32} />
              <stop offset="100%" stopColor="var(--chart-4)" stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke="var(--border)" strokeDasharray="2 4" vertical={false} />
          <XAxis
            dataKey="label"
            tickLine={false}
            axisLine={false}
            tick={{ fill: "var(--muted-foreground)", fontSize: 10 }}
            minTickGap={24}
          />
          <YAxis
            tickLine={false}
            axisLine={false}
            tick={{ fill: "var(--muted-foreground)", fontSize: 10 }}
            width={44}
            allowDecimals={false}
          />
          <Tooltip
            cursor={{ stroke: "var(--border)" }}
            contentStyle={{
              background: "var(--popover)",
              border: "1px solid var(--border)",
              borderRadius: 0,
              fontSize: 12,
              color: "var(--popover-foreground)",
            }}
            formatter={(value, name) => [
              formatNumber(Number(value)),
              name === "total" ? "All records" : "Approved",
            ]}
          />
          <Area
            type="monotone"
            dataKey="total"
            stroke="var(--chart-2)"
            strokeWidth={1.5}
            fill="url(#fillTotal)"
          />
          <Area
            type="monotone"
            dataKey="approved"
            stroke="var(--chart-4)"
            strokeWidth={1.5}
            fill="url(#fillApproved)"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}

export type BreakdownItem = { name: string; value: number }

export function BreakdownBars({ data }: { data: BreakdownItem[] }) {
  if (data.length === 0) {
    return (
      <div className="grid h-48 place-items-center text-sm text-muted-foreground">
        No records in this period.
      </div>
    )
  }

  const max = Math.max(...data.map((item) => item.value), 1)

  return (
    <ul className="flex flex-col gap-3">
      {data.slice(0, 8).map((item, index) => (
        <li key={`${item.name}-${index}`} className="flex flex-col gap-1">
          <div className="flex items-baseline justify-between gap-3 text-xs">
            <span className="truncate font-medium">{item.name}</span>
            <span className="shrink-0 font-mono text-muted-foreground">
              {formatNumber(item.value)}
            </span>
          </div>
          <div className="h-1.5 w-full bg-muted">
            <div
              className="h-full bg-primary"
              style={{ width: `${Math.max(3, (item.value / max) * 100)}%` }}
            />
          </div>
        </li>
      ))}
    </ul>
  )
}
