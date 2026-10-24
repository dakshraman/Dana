"use client"

import { useEffect } from "react"
import { AlertTriangle } from "lucide-react"

import { Button } from "@/components/ui/button"

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error("[app] route error", error)
  }, [error])

  return (
    <div className="flex min-h-[60svh] items-center justify-center">
      <div className="max-w-md border border-border bg-background p-8">
        <AlertTriangle className="size-6 text-destructive" />
        <h1 className="mt-4 font-heading text-xl font-semibold tracking-wide uppercase">
          Something went wrong
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          The requested view could not be loaded. The incident has been logged.
          Try again, or contact your system administrator if it persists.
        </p>
        {error.digest && (
          <p className="mt-3 font-mono text-[11px] text-muted-foreground">
            Reference: {error.digest}
          </p>
        )}
        <Button className="mt-6" onClick={reset}>
          Try again
        </Button>
      </div>
    </div>
  )
}
