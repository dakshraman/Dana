"use client"

import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"
import { AppSidebar } from "@/components/layout/app-sidebar"
import { Topbar } from "@/components/layout/topbar"
import type { AccessScope, AppRole } from "@/lib/permissions"

type AppShellProps = {
  user: { name: string; email: string; role: AppRole }
  scope: AccessScope
  unreadCount: number
  children: React.ReactNode
}

export function AppShell({
  user,
  scope,
  unreadCount,
  children,
}: AppShellProps) {
  return (
    <SidebarProvider>
      <AppSidebar scope={scope} />
      <SidebarInset className="min-w-0 bg-muted/30">
        <Topbar user={user} unreadCount={unreadCount} />
        <div className="flex-1 p-4 md:p-6 lg:p-8">
          <div className="mx-auto w-full max-w-[1600px]">{children}</div>
        </div>
        <footer className="mt-auto border-t px-4 py-4 text-[10px] tracking-wider text-muted-foreground uppercase md:px-6">
          Dana Company · Operations Data Management · Internal use only
        </footer>
      </SidebarInset>
    </SidebarProvider>
  )
}
