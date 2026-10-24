import Link from "next/link"

import { Button } from "@/components/ui/button"

export default function NotFound() {
  return (
    <div className="flex min-h-svh items-center justify-center bg-muted/30 px-6">
      <div className="w-full max-w-md border border-border bg-background p-8">
        <p className="font-mono text-xs tracking-widest text-primary uppercase">
          404 / Not found
        </p>
        <h1 className="mt-3 font-heading text-2xl font-semibold tracking-tight">
          This page does not exist
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          The page may have moved, or you may not have access to it. Return to
          the dashboard to continue.
        </p>
        <Button className="mt-6" render={<Link href="/dashboard" />}>
          Back to dashboard
        </Button>
      </div>
    </div>
  )
}
