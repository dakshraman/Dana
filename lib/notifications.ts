import "server-only"

import { prisma } from "@/lib/db"
import type { NotificationType } from "@/lib/generated/prisma/enums"

type NotificationInput = {
  type: NotificationType
  title: string
  message: string
  link?: string
}

export async function notifyUsers(
  userIds: string[],
  input: NotificationInput
): Promise<void> {
  const uniqueIds = [...new Set(userIds)].filter(Boolean)
  if (uniqueIds.length === 0) return

  try {
    await prisma.notification.createMany({
      data: uniqueIds.map((userId) => ({
        userId,
        type: input.type,
        title: input.title,
        message: input.message,
        link: input.link,
      })),
    })
  } catch (error) {
    console.error("[notifications] failed to create notifications", error)
  }
}

/** Users who can review records for a branch: branch managers, the regional
 * manager(s) for the branch's region, and active super admins. */
export async function reviewerIdsForBranch(
  branchId: string,
  excludeUserId?: string
): Promise<string[]> {
  const branch = await prisma.branch.findUnique({
    where: { id: branchId },
    select: { regionId: true },
  })
  if (!branch) return []

  const users = await prisma.user.findMany({
    where: {
      isActive: true,
      id: excludeUserId ? { not: excludeUserId } : undefined,
      OR: [
        { role: "SUPER_ADMIN" },
        {
          role: "BRANCH_MANAGER",
          OR: [
            { managedBranches: { some: { id: branchId } } },
            { branchAssignments: { some: { branchId } } },
          ],
        },
        {
          role: "REGIONAL_MANAGER",
          regionAssignments: { some: { regionId: branch.regionId } },
        },
      ],
    },
    select: { id: true },
  })

  return users.map((user) => user.id)
}
