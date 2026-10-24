import * as React from "react"
import { CircleAlert } from "lucide-react"

import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"

export type FormFieldProps = {
  label: React.ReactNode
  htmlFor: string
  error?: string
  description?: string
  required?: boolean
  children: React.ReactNode
  className?: string
}

/**
 * Label + control + description + validation message. When a single control is
 * provided it receives the matching `aria-describedby`, `aria-invalid`, and
 * `aria-required` attributes automatically.
 */
export function FormField({
  label,
  htmlFor,
  error,
  description,
  required = false,
  children,
  className,
}: FormFieldProps) {
  const descriptionId = description ? `${htmlFor}-description` : undefined
  const errorId = error ? `${htmlFor}-error` : undefined
  const describedBy =
    [descriptionId, errorId].filter(Boolean).join(" ") || undefined

  let control = children

  if (
    React.Children.count(children) === 1 &&
    React.isValidElement<Record<string, unknown>>(children)
  ) {
    const element = children
    const existingDescribedBy = element.props["aria-describedby"]
    const mergedDescribedBy =
      [existingDescribedBy, describedBy].filter(Boolean).join(" ") || undefined

    control = React.cloneElement(element, {
      "aria-describedby": mergedDescribedBy,
      "aria-invalid": error ? true : element.props["aria-invalid"],
      "aria-required": required ? true : element.props["aria-required"],
    })
  }

  return (
    <div
      data-slot="form-field"
      data-invalid={error ? true : undefined}
      className={cn("flex flex-col gap-1.5", className)}
    >
      <Label htmlFor={htmlFor}>
        {label}
        {required ? (
          <span aria-hidden="true" className="text-destructive">
            *
          </span>
        ) : null}
      </Label>

      {description ? (
        <p
          id={descriptionId}
          className="text-xs leading-relaxed text-muted-foreground"
        >
          {description}
        </p>
      ) : null}

      {control}

      {error ? (
        <p
          id={errorId}
          role="alert"
          className="flex items-start gap-1.5 text-xs leading-relaxed text-destructive"
        >
          <CircleAlert
            className="mt-px size-3.5 shrink-0"
            aria-hidden="true"
          />
          <span>{error}</span>
        </p>
      ) : null}
    </div>
  )
}
