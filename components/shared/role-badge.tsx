import { ROLE_LABELS, type AppRole } from "@/lib/permissions"
import { cn } from "@/lib/utils"

export type RoleBadgeProps = {
  role: AppRole
  label?: string
  className?: string
}

const ROLE_STYLES: Record<AppRole, string> = {
  SUPER_ADMIN: "border-primary/30 bg-primary/10 text-primary",
  REGIONAL_MANAGER: "border-border bg-muted/60 text-foreground",
  BRANCH_MANAGER: "border-border bg-transparent text-foreground",
  BRANCH_EMPLOYEE: "border-border bg-transparent text-muted-foreground",
}

export function RoleBadge({ role, label, className }: RoleBadgeProps) {
  return (
    <span
      data-slot="role-badge"
      data-role={role}
      className={cn(
        "inline-flex w-fit shrink-0 items-center rounded-none border px-2 py-0.5 text-[0.625rem] font-semibold tracking-widest whitespace-nowrap uppercase",
        ROLE_STYLES[role],
        className
      )}
    >
      {label ?? ROLE_LABELS[role]}
    </span>
  )
}
