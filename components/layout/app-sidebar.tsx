"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from "@/components/ui/sidebar"
import { visibleNavSections } from "@/lib/navigation"
import type { AccessScope } from "@/lib/permissions"

export function AppSidebar({ scope }: { scope: AccessScope }) {
  const pathname = usePathname()
  const sections = visibleNavSections(scope)

  return (
    <Sidebar collapsible="icon" className="border-r border-sidebar-border">
      <SidebarHeader className="h-16 justify-center border-b border-sidebar-border px-3">
        <Link
          href="/dashboard"
          className="flex items-center gap-3 overflow-hidden"
          aria-label="Dana Company dashboard"
        >
          <span className="grid size-8 shrink-0 place-items-center bg-sidebar-primary text-sm font-black tracking-tighter text-sidebar-primary-foreground">
            D
          </span>
          <span className="min-w-0 leading-tight group-data-[collapsible=icon]:hidden">
            <span className="block text-sm font-semibold tracking-[0.22em] uppercase">
              Dana
            </span>
            <span className="block text-[10px] tracking-[0.18em] text-sidebar-foreground/50 uppercase">
              Operations Data
            </span>
          </span>
        </Link>
      </SidebarHeader>

      <SidebarContent>
        {sections.map((section) => (
          <SidebarGroup key={section.label}>
            <SidebarGroupLabel className="text-[10px] tracking-[0.2em] text-sidebar-foreground/45 uppercase">
              {section.label}
            </SidebarGroupLabel>
            <SidebarMenu>
              {section.items.map((item) => {
                const active =
                  pathname === item.href ||
                  pathname.startsWith(`${item.href}/`)
                const Icon = item.icon

                return (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton
                      render={<Link href={item.href} />}
                      isActive={active}
                      tooltip={item.label}
                      className="text-[11px] font-medium tracking-wider uppercase"
                    >
                      <Icon />
                      <span>{item.label}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                )
              })}
            </SidebarMenu>
          </SidebarGroup>
        ))}
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border">
        <p className="px-2 py-1 text-[9px] leading-relaxed tracking-[0.14em] text-sidebar-foreground/35 uppercase group-data-[collapsible=icon]:hidden">
          Internal use only
          <br />
          Authorized personnel
        </p>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}
