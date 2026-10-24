import type { Metadata } from "next"
import Link from "next/link"
import { redirect } from "next/navigation"
import {
  Building2,
  Globe2,
  Layers,
  Pencil,
  Plus,
  Settings2,
  Tag,
} from "lucide-react"

import { PageHeader } from "@/components/shared/page-header"
import { EmptyState } from "@/components/shared/empty-state"
import { GeneralSettingsForm } from "@/components/settings/general-settings-form"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { formatDate, formatNumber } from "@/lib/format"
import { listRegions } from "@/lib/services/branches"
import { listCategories } from "@/lib/services/settings"
import { requirePageScope } from "@/lib/session"
import { getSystemSettings } from "@/lib/settings"
import { cn } from "@/lib/utils"

export const metadata: Metadata = { title: "Settings" }

const TABS = [
  { value: "general", label: "General", icon: Settings2 },
  { value: "categories", label: "Record categories", icon: Layers },
  { value: "regions", label: "Regions", icon: Globe2 },
] as const

type TabValue = (typeof TABS)[number]["value"]

function resolveTab(value: string | string[] | undefined): TabValue {
  const first = Array.isArray(value) ? value[0] : value
  return TABS.some((tab) => tab.value === first)
    ? (first as TabValue)
    : "general"
}

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const scope = await requirePageScope()
  if (!scope.canManageSettings) redirect("/dashboard")

  const params = await searchParams
  const tab = resolveTab(params.tab)

  const [settings, categories, regions] = await Promise.all([
    getSystemSettings(),
    listCategories(scope),
    listRegions(scope),
  ])

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Settings"
        description="Configure company defaults, the record catalogue and the regional structure."
        breadcrumbs={[{ label: "Settings" }]}
      />

      <nav
        aria-label="Settings sections"
        className="flex flex-wrap gap-1 border-b border-border"
      >
        {TABS.map((item) => {
          const Icon = item.icon
          const active = item.value === tab
          return (
            <Link
              key={item.value}
              href={`/settings?tab=${item.value}`}
              aria-current={active ? "page" : undefined}
              className={cn(
                "-mb-px inline-flex items-center gap-2 border-b-2 px-3 py-2.5 text-xs font-semibold tracking-wider uppercase transition-colors",
                active
                  ? "border-primary text-foreground"
                  : "border-transparent text-muted-foreground hover:border-border hover:text-foreground"
              )}
            >
              <Icon className="size-3.5" />
              {item.label}
            </Link>
          )
        })}
      </nav>

      {tab === "general" ? (
        <Card>
          <CardHeader>
            <CardTitle>Company & workflow</CardTitle>
            <CardDescription>
              These values are used across dashboards, exports and approval
              rules.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <GeneralSettingsForm settings={settings} />
          </CardContent>
        </Card>
      ) : null}

      {tab === "categories" ? (
        <Card>
          <CardHeader className="flex flex-row items-start justify-between gap-4">
            <div>
              <CardTitle>Record categories</CardTitle>
              <CardDescription>
                Categories define the custom fields captured for every record.
                Removing a field with existing data deactivates it so history is
                preserved.
              </CardDescription>
            </div>
            <Button size="sm" render={<Link href="/settings/categories/new" />}>
              <Plus className="size-4" /> New category
            </Button>
          </CardHeader>
          <CardContent className="px-0">
            {categories.length === 0 ? (
              <EmptyState
                icon={Tag}
                title="No categories yet"
                description="Create a category to start capturing structured operations data."
                action={
                  <Button size="sm" render={<Link href="/settings/categories/new" />}>
                    Create category
                  </Button>
                }
                className="mx-4 border-0 bg-transparent"
              />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Category</TableHead>
                    <TableHead>Fields</TableHead>
                    <TableHead className="text-right">Records</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Updated</TableHead>
                    <TableHead className="w-24" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {categories.map((category) => {
                    const activeFields = category.fields.filter(
                      (field) => field.isActive
                    ).length
                    return (
                      <TableRow key={category.id}>
                        <TableCell>
                          <p className="font-medium">{category.name}</p>
                          <p className="font-mono text-[10px] tracking-wider text-muted-foreground uppercase">
                            {category.code}
                          </p>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {formatNumber(activeFields)} active
                          {category.fields.length !== activeFields
                            ? ` · ${formatNumber(
                                category.fields.length - activeFields
                              )} inactive`
                            : ""}
                        </TableCell>
                        <TableCell className="text-right font-mono text-xs">
                          {formatNumber(category._count.records)}
                        </TableCell>
                        <TableCell>
                          <Badge variant={category.isActive ? "default" : "secondary"}>
                            {category.isActive ? "Active" : "Inactive"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {formatDate(category.updatedAt)}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="xs"
                            render={
                              <Link
                                href={`/settings/categories/${category.id}/edit`}
                              />
                            }
                          >
                            <Pencil className="size-3" /> Edit
                          </Button>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      ) : null}

      {tab === "regions" ? (
        <Card>
          <CardHeader className="flex flex-row items-start justify-between gap-4">
            <div>
              <CardTitle>Regions</CardTitle>
              <CardDescription>
                Regions group branches and define regional manager access.
              </CardDescription>
            </div>
            <Button size="sm" render={<Link href="/settings/regions/new" />}>
              <Plus className="size-4" /> New region
            </Button>
          </CardHeader>
          <CardContent className="px-0">
            {regions.length === 0 ? (
              <EmptyState
                icon={Globe2}
                title="No regions yet"
                description="Create a region before assigning branches and regional managers."
                action={
                  <Button size="sm" render={<Link href="/settings/regions/new" />}>
                    Create region
                  </Button>
                }
                className="mx-4 border-0 bg-transparent"
              />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Region</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead className="text-right">Branches</TableHead>
                    <TableHead className="text-right">Managers</TableHead>
                    <TableHead className="w-24" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {regions.map((region) => (
                    <TableRow key={region.id}>
                      <TableCell>
                        <p className="font-medium">{region.name}</p>
                        <p className="font-mono text-[10px] tracking-wider text-muted-foreground uppercase">
                          {region.code}
                        </p>
                      </TableCell>
                      <TableCell className="max-w-72 truncate text-sm text-muted-foreground">
                        {region.description ?? "—"}
                      </TableCell>
                      <TableCell className="text-right">
                        <span className="inline-flex items-center gap-1.5 font-mono text-xs">
                          <Building2 className="size-3 text-muted-foreground" />
                          {formatNumber(region._count.branches)}
                        </span>
                      </TableCell>
                      <TableCell className="text-right font-mono text-xs">
                        {formatNumber(region._count.userAssignments)}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="xs"
                          render={
                            <Link href={`/settings/regions/${region.id}/edit`} />
                          }
                        >
                          <Pencil className="size-3" /> Edit
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      ) : null}
    </div>
  )
}
