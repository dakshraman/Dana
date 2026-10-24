import {
  BarChart3,
  Building2,
  ClipboardList,
  LayoutDashboard,
  ScrollText,
  Settings,
  ShieldCheck,
  Users,
  type LucideIcon,
} from "lucide-react"

import type { AccessScope, AppRole } from "@/lib/permissions"

export type NavItem = {
  label: string
  href: string
  icon: LucideIcon
  allowed: (scope: AccessScope) => boolean
}

export type NavSection = {
  label: string
  items: NavItem[]
}

const everyone = () => true

export const NAV_SECTIONS: NavSection[] = [
  {
    label: "Overview",
    items: [
      {
        label: "Dashboard",
        href: "/dashboard",
        icon: LayoutDashboard,
        allowed: everyone,
      },
    ],
  },
  {
    label: "Operations",
    items: [
      {
        label: "Branches",
        href: "/branches",
        icon: Building2,
        allowed: everyone,
      },
      {
        label: "Records",
        href: "/records",
        icon: ClipboardList,
        allowed: everyone,
      },
      {
        label: "Approvals",
        href: "/approvals",
        icon: ShieldCheck,
        allowed: (scope) => scope.canApproveRecords,
      },
    ],
  },
  {
    label: "Insights",
    items: [
      {
        label: "Reports",
        href: "/reports",
        icon: BarChart3,
        allowed: everyone,
      },
    ],
  },
  {
    label: "Administration",
    items: [
      {
        label: "Users",
        href: "/users",
        icon: Users,
        allowed: (scope) => scope.canManageUsers,
      },
      {
        label: "Audit logs",
        href: "/audit-logs",
        icon: ScrollText,
        allowed: (scope) => scope.canViewAuditLogs,
      },
      {
        label: "Settings",
        href: "/settings",
        icon: Settings,
        allowed: (scope) => scope.canManageSettings,
      },
    ],
  },
]

export function visibleNavSections(scope: AccessScope): NavSection[] {
  return NAV_SECTIONS.map((section) => ({
    ...section,
    items: section.items.filter((item) => item.allowed(scope)),
  })).filter((section) => section.items.length > 0)
}

const SEGMENT_LABELS: Record<string, string> = {
  dashboard: "Dashboard",
  branches: "Branches",
  records: "Records",
  approvals: "Approvals",
  reports: "Reports",
  users: "Users",
  notifications: "Notifications",
  "audit-logs": "Audit logs",
  settings: "Settings",
  new: "New",
  edit: "Edit",
}

export function breadcrumbLabel(
  segment: string,
  index: number,
  segments: string[]
): string {
  if (SEGMENT_LABELS[segment]) return SEGMENT_LABELS[segment]
  if (index > 0 && /^c[a-z0-9]{10,}$/i.test(segment)) {
    const parent = segments[index - 1]
    if (parent) {
      const label = SEGMENT_LABELS[parent] ?? "Record"
      return `${label.replace(/s$/, "")} details`
    }
    return "Details"
  }
  return segment
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ")
}

export function roleHome(role: AppRole): string {
  return role === "SUPER_ADMIN" ? "/dashboard" : "/dashboard"
}
