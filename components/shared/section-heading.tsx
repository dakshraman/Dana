import { cn } from "@/lib/utils"

export type SectionHeadingProps = {
  title: string
  description?: string
  action?: React.ReactNode
  className?: string
}

export function SectionHeading({
  title,
  description,
  action,
  className,
}: SectionHeadingProps) {
  return (
    <div
      data-slot="section-heading"
      className={cn("flex items-start justify-between gap-4", className)}
    >
      <div className="flex min-w-0 flex-col gap-1">
        <h2 className="text-[0.6875rem] font-semibold tracking-widest text-muted-foreground uppercase">
          {title}
        </h2>
        {description ? (
          <p className="text-xs leading-relaxed text-muted-foreground">
            {description}
          </p>
        ) : null}
      </div>

      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  )
}
