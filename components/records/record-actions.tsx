"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Check, RotateCcw, Send, Undo2, X } from "lucide-react"

import { ConfirmDialog } from "@/components/shared/confirm-dialog"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Textarea } from "@/components/ui/textarea"
import { errorMessage, postJson } from "@/lib/client-api"
import { cn } from "@/lib/utils"

type Decision = "APPROVE" | "RETURN" | "REJECT"

const DECISIONS: Array<{
  value: Decision
  label: string
  description: string
  icon: typeof Check
  className: string
}> = [
  {
    value: "APPROVE",
    label: "Approve",
    description: "Accept the record and lock it from further editing.",
    icon: Check,
    className:
      "border-primary/40 bg-primary/5 text-primary data-[selected=true]:border-primary data-[selected=true]:bg-primary/10",
  },
  {
    value: "RETURN",
    label: "Return for changes",
    description: "Send it back to the submitter with a required comment.",
    icon: Undo2,
    className:
      "border-amber-600/30 bg-amber-500/5 text-amber-700 data-[selected=true]:border-amber-600 data-[selected=true]:bg-amber-500/10 dark:text-amber-300",
  },
  {
    value: "REJECT",
    label: "Reject",
    description: "Reject the submission permanently with a required reason.",
    icon: X,
    className:
      "border-destructive/30 bg-destructive/5 text-destructive data-[selected=true]:border-destructive data-[selected=true]:bg-destructive/10",
  },
]

export function RecordReviewDialog({
  recordId,
  recordNumber,
}: {
  recordId: string
  recordNumber: string
}) {
  const router = useRouter()
  const [open, setOpen] = React.useState(false)
  const [decision, setDecision] = React.useState<Decision>("APPROVE")
  const [comment, setComment] = React.useState("")
  const [pending, setPending] = React.useState(false)

  async function submit() {
    if (decision !== "APPROVE" && comment.trim().length === 0) {
      toast.error("Add a comment explaining the decision.")
      return
    }

    setPending(true)
    try {
      await postJson(`/api/records/${recordId}/review`, {
        decision,
        comment: comment.trim() || undefined,
      })
      toast.success(
        decision === "APPROVE"
          ? "Record approved."
          : decision === "RETURN"
            ? "Record returned for changes."
            : "Record rejected."
      )
      setOpen(false)
      setComment("")
      setDecision("APPROVE")
      router.refresh()
    } catch (error) {
      toast.error(errorMessage(error))
    } finally {
      setPending(false)
    }
  }

  return (
    <>
      <Button size="sm" onClick={() => setOpen(true)}>
        Review submission
      </Button>

      <Dialog open={open} onOpenChange={(next) => !pending && setOpen(next)}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Review {recordNumber}</DialogTitle>
            <DialogDescription>
              Decisions are recorded in the approval history and notified to the
              submitter. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-2">
            {DECISIONS.map((item) => {
              const Icon = item.icon
              const selected = decision === item.value
              return (
                <button
                  key={item.value}
                  type="button"
                  data-selected={selected}
                  onClick={() => setDecision(item.value)}
                  className={cn(
                    "flex items-start gap-3 border px-3 py-2.5 text-left transition-colors",
                    item.className
                  )}
                >
                  <Icon className="mt-0.5 size-4 shrink-0" />
                  <span>
                    <span className="block text-xs font-semibold tracking-widest uppercase">
                      {item.label}
                    </span>
                    <span className="mt-0.5 block text-xs text-muted-foreground">
                      {item.description}
                    </span>
                  </span>
                </button>
              )
            })}
          </div>

          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="review-comment"
              className="text-[11px] font-semibold tracking-widest text-muted-foreground uppercase"
            >
              Comment {decision === "APPROVE" ? "(optional)" : "(required)"}
            </label>
            <Textarea
              id="review-comment"
              value={comment}
              onChange={(event) => setComment(event.target.value)}
              placeholder={
                decision === "APPROVE"
                  ? "Optional note for the audit trail"
                  : "Explain what must change"
              }
              maxLength={2000}
            />
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={pending}
            >
              Cancel
            </Button>
            <Button
              variant={decision === "REJECT" ? "destructive" : "default"}
              onClick={() => void submit()}
              disabled={pending}
            >
              {pending
                ? "Recording..."
                : decision === "APPROVE"
                  ? "Approve record"
                  : decision === "RETURN"
                    ? "Return record"
                    : "Reject record"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

export function SubmitRecordButton({
  recordId,
}: {
  recordId: string
}) {
  return (
    <ConfirmDialog
      trigger={
        <Button size="sm">
          <Send className="size-4" /> Submit for review
        </Button>
      }
      title="Submit for review"
      description="The record will be locked for editing until a reviewer approves, returns or rejects it."
      confirmLabel="Submit"
      successMessage="Record submitted for review."
      onConfirm={async () => {
        await postJson(`/api/records/${recordId}/submit`, {})
        window.location.reload()
      }}
    />
  )
}

export function ArchiveRecordButton({ recordId }: { recordId: string }) {
  return (
    <ConfirmDialog
      trigger={
        <Button variant="outline" size="sm">
          <RotateCcw className="size-4" /> Archive
        </Button>
      }
      title="Archive record"
      description="Archived records are removed from active lists but remain available to administrators with full history."
      confirmLabel="Archive"
      destructive
      successMessage="Record archived."
      onConfirm={async () => {
        await postJson(`/api/records/${recordId}/archive`, {})
        window.location.reload()
      }}
    />
  )
}

export function RestoreRecordButton({ recordId }: { recordId: string }) {
  return (
    <ConfirmDialog
      trigger={
        <Button variant="outline" size="sm">
          <RotateCcw className="size-4" /> Restore
        </Button>
      }
      title="Restore record"
      description="The record will return to draft status and its submission and approval metadata will be cleared."
      confirmLabel="Restore"
      successMessage="Record restored as a draft."
      onConfirm={async () => {
        await postJson(`/api/records/${recordId}/restore`, {})
        window.location.reload()
      }}
    />
  )
}
