"use client"

import { useRouter } from "next/navigation"

import { ConfirmDialog } from "@/components/shared/confirm-dialog"
import { Button } from "@/components/ui/button"
import { patchJson } from "@/lib/client-api"

export function BranchStatusButton({
  branchId,
  branchName,
  isActive,
}: {
  branchId: string
  branchName: string
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
      title={isActive ? "Deactivate branch" : "Activate branch"}
      description={
        isActive
          ? `${branchName} will be hidden from new record entry. Existing records and history are preserved.`
          : `${branchName} will become available for new record entry.`
      }
      confirmLabel={isActive ? "Deactivate" : "Activate"}
      destructive={isActive}
      successMessage={isActive ? "Branch deactivated." : "Branch activated."}
      onConfirm={async () => {
        await patchJson(`/api/branches/${branchId}`, { isActive: !isActive })
        router.refresh()
      }}
    />
  )
}
