import { AppShell } from "@/components/layout/app-shell"
import { prisma } from "@/lib/db"
import { requirePageScope, requirePageUser } from "@/lib/session"

export default async function ProtectedLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const user = await requirePageUser()
  const scope = await requirePageScope()

  const unreadCount = await prisma.notification.count({
    where: { userId: user.id, readAt: null },
  })

  return (
    <AppShell
      user={{ name: user.name, email: user.email, role: user.role }}
      scope={scope}
      unreadCount={unreadCount}
    >
      {children}
    </AppShell>
  )
}
