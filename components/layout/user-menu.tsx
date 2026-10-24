"use client"

import Link from "next/link"
import { signOut } from "next-auth/react"
import { Bell, LogOut, Settings, UserRound } from "lucide-react"

import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { ROLE_LABELS, type AppRole } from "@/lib/permissions"

type UserMenuProps = {
  name: string
  email: string
  role: AppRole
}

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("")
}

export function UserMenu({ name, email, role }: UserMenuProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            variant="ghost"
            className="h-9 gap-2 px-2 normal-case tracking-normal"
            aria-label="Open user menu"
          />
        }
      >
        <Avatar size="sm">
          <AvatarFallback className="bg-primary/10 text-[10px] font-bold text-primary">
            {initials(name)}
          </AvatarFallback>
        </Avatar>
        <span className="hidden text-left md:block">
          <span className="block max-w-36 truncate text-xs font-semibold">
            {name}
          </span>
          <span className="block text-[10px] font-normal tracking-wider text-muted-foreground uppercase">
            {ROLE_LABELS[role]}
          </span>
        </span>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-60">
        <DropdownMenuLabel>
          <span className="block truncate text-xs font-semibold tracking-normal text-foreground normal-case">
            {name}
          </span>
          <span className="mt-0.5 block truncate text-[11px] font-normal tracking-normal text-muted-foreground normal-case">
            {email}
          </span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem render={<Link href="/account" />}>
          <UserRound className="size-4" />
          Profile &amp; settings
        </DropdownMenuItem>
        <DropdownMenuItem render={<Link href="/notifications" />}>
          <Bell className="size-4" />
          Notifications
        </DropdownMenuItem>
        <DropdownMenuItem render={<Link href="/account#security" />}>
          <Settings className="size-4" />
          Security
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          variant="destructive"
          onClick={() => {
            void signOut({ redirectTo: "/login" })
          }}
        >
          <LogOut className="size-4" />
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
