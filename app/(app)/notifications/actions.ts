"use server"

import { revalidatePath } from "next/cache"

import { prisma } from "@/lib/db"
import { requirePageUser } from "@/lib/session"

export async function markAllNotificationsRead() {
  const user = await requirePageUser()

  await prisma.notification.updateMany({
    where: { userId: user.id, readAt: null },
    data: { readAt: new Date() },
  })

  revalidatePath("/notifications")
  revalidatePath("/", "layout")
}

export async function markNotificationRead(formData: FormData) {
  const user = await requirePageUser()
  const id = String(formData.get("id") ?? "")
  if (!id) return

  await prisma.notification.updateMany({
    where: { id, userId: user.id, readAt: null },
    data: { readAt: new Date() },
  })

  revalidatePath("/notifications")
  revalidatePath("/", "layout")
}

export async function markNotificationUnread(formData: FormData) {
  const user = await requirePageUser()
  const id = String(formData.get("id") ?? "")
  if (!id) return

  await prisma.notification.updateMany({
    where: { id, userId: user.id },
    data: { readAt: null },
  })

  revalidatePath("/notifications")
  revalidatePath("/", "layout")
}
