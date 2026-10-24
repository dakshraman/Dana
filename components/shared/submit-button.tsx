"use client"

import * as React from "react"
import { useFormStatus } from "react-dom"
import { Loader2 } from "lucide-react"

import { Button } from "@/components/ui/button"

export type SubmitButtonProps = Omit<
  React.ComponentProps<typeof Button>,
  "children" | "type"
> & {
  label?: React.ReactNode
  pendingLabel?: React.ReactNode
}

/**
 * Submit button that reads the surrounding `<form>` status. Must be rendered
 * inside the form it submits for `useFormStatus` to see the pending state.
 */
export function SubmitButton({
  label = "Save",
  pendingLabel = "Saving...",
  disabled,
  ...props
}: SubmitButtonProps) {
  const { pending } = useFormStatus()

  return (
    <Button
      {...props}
      type="submit"
      disabled={pending || disabled}
      aria-busy={pending || undefined}
    >
      {pending ? (
        <Loader2
          data-icon="inline-start"
          className="animate-spin"
          aria-hidden="true"
        />
      ) : null}
      {pending ? pendingLabel : label}
    </Button>
  )
}
