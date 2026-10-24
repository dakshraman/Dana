"use client"

import { Search } from "lucide-react"

import { SidebarTrigger } from "@/components/ui/sidebar"
import { Breadcrumbs } from "@/components/layout/breadcrumbs"
import { NotificationBell } from "@/components/layout/notification-bell"
import { ThemeToggle } from "@/components/layout/theme-toggle"
import { UserMenu } from "@/components/layout/user-menu"
import type { AppRole } from "@/lib/permissions"

type TopbarProps = {
  user: { name: string; email: string; role: AppRole }
  unreadCount: number
}

export function Topbar({ user, unreadCount }: TopbarProps) {
  return (
    <header className="sticky top-0 z-30 flex h-16 shrink-0 items-center gap-2 border-b bg-background/95 px-4 backdrop-blur supports-[backdrop-filter]:bg-background/85 md:px-6">
      <SidebarTrigger className="-ml-1" />
      <Breadcrumbs />

      <div className="ml-auto flex items-center gap-1">
        <form
          action="/records"
          className="relative mr-2 hidden w-64 xl:block"
          role="search"
        >
          <Search className="pointer-events-none absolute top-1/2 left-0 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <input
            type="search"
            name="q"
            placeholder="Search records…"
            aria-label="Search records"
            className="h-8 w-full border-b border-input bg-transparent pr-2 pl-5 text-xs outline-none placeholder:text-muted-foreground/70 focus:border-b-ring"
          />
        </form>

        <ThemeToggle />
        <NotificationBell unreadCount={unreadCount} />
        <div className="mx-1.5 h-6 w-px bg-border" aria-hidden />
        <UserMenu name={user.name} email={user.email} role={user.role} />
      </div>
    </header>
  )
}
