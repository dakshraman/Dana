"use client"

import Link from "next/link"
import { Bell } from "lucide-react"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

export function NotificationBell({ unreadCount }: { unreadCount: number }) {
  return (
    <Button
      variant="ghost"
      size="icon-sm"
      className="relative"
      render={<Link href="/notifications" />}
      aria-label={
        unreadCount > 0
          ? `Notifications, ${unreadCount} unread`
          : "Notifications"
      }
      title="Notifications"
    >
      <Bell className="size-4" />
      {unreadCount > 0 && (
        <span
          className={cn(
            "absolute -top-0.5 -right-0.5 grid min-w-4 place-items-center bg-primary px-1 text-[9px] leading-4 font-bold text-primary-foreground"
          )}
        >
          {unreadCount > 99 ? "99+" : unreadCount}
        </span>
      )}
    </Button>
  )
}
