"use client"

import * as React from "react"
import { Loader2 } from "lucide-react"
import { toast } from "sonner"

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"

function isComposableTrigger(node: React.ReactNode): node is React.ReactElement {
  return React.isValidElement(node) && node.type !== React.Fragment
}

export type ConfirmDialogProps = {
  /** Trigger contents, or a complete button element to compose with. */
  trigger: React.ReactNode
  title: string
  description: string
  confirmLabel?: string
  cancelLabel?: string
  pendingLabel?: string
  onConfirm: () => void | Promise<void>
  destructive?: boolean
  successMessage?: string
  className?: string
}

export function ConfirmDialog({
  trigger,
  title,
  description,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  pendingLabel = "Working...",
  onConfirm,
  destructive = false,
  successMessage = "Completed successfully.",
  className,
}: ConfirmDialogProps) {
  const [open, setOpen] = React.useState(false)
  const [pending, setPending] = React.useState(false)

  async function handleConfirm() {
    if (pending) return

    setPending(true)
    try {
      await onConfirm()
      setOpen(false)
      toast.success(successMessage)
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Something went wrong. Please try again."
      )
    } finally {
      setPending(false)
    }
  }

  // Base UI's render prop lets us compose with an existing button. Plain
  // content falls back to a trigger styled with the shared button variants.
  return (
    <AlertDialog
      open={open}
      onOpenChange={(nextOpen, details) => {
        if (pending && !nextOpen) {
          details.cancel()
          return
        }
        setOpen(nextOpen)
      }}
    >
      {isComposableTrigger(trigger) ? (
        <AlertDialogTrigger render={trigger} />
      ) : (
        <AlertDialogTrigger
          className={cn(
            buttonVariants({
              variant: destructive ? "destructive" : "outline",
            })
          )}
        >
          {trigger}
        </AlertDialogTrigger>
      )}

      <AlertDialogContent className={className}>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>

        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>
            {cancelLabel}
          </AlertDialogCancel>
          <AlertDialogAction
            variant={destructive ? "destructive" : "default"}
            disabled={pending}
            aria-busy={pending || undefined}
            onClick={handleConfirm}
          >
            {pending ? (
              <Loader2
                data-icon="inline-start"
                className="animate-spin"
                aria-hidden="true"
              />
            ) : null}
            {pending ? pendingLabel : confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
