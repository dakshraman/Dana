"use client"

import { useRouter } from "next/navigation"

import { ConfirmDialog } from "@/components/shared/confirm-dialog"
import { Button } from "@/components/ui/button"
import { patchJson } from "@/lib/client-api"

export function UserStatusButton({
  userId,
  userName,
  isActive,
}: {
  userId: string
  userName: string
  isActive: boolean
}) {
  const router = useRouter()

  return (
    <ConfirmDialog
      trigger={
        <Button variant={isActive ? "outline" : "default"} size="sm">
          {isActive ? "Deactivate" : "Activate"}
        </Button>
      }
      title={isActive ? "Deactivate user" : "Activate user"}
      description={
        isActive
          ? `${userName} will no longer be able to sign in. Existing records, assignments and audit history are preserved.`
          : `${userName} will regain access to the account and its assigned scope.`
      }
      confirmLabel={isActive ? "Deactivate" : "Activate"}
      destructive={isActive}
      successMessage={isActive ? "User deactivated." : "User activated."}
      onConfirm={async () => {
        await patchJson(`/api/users/${userId}`, { isActive: !isActive })
        router.refresh()
      }}
    />
  )
}
