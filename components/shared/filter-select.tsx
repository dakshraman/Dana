import { ChevronDown } from "lucide-react"

import { humanizeEnum } from "@/lib/format"
import { cn } from "@/lib/utils"

export type FilterOption = {
  value: string
  label: string
}

export type FilterSelectProps = {
  name: string
  label?: string
  options: FilterOption[]
  defaultValue?: string
  includeAll?: boolean
  allLabel?: string
  id?: string
  className?: string
}

/**
 * Native select for GET filter forms. Server compatible: no client state or
 * event handlers, so it works before hydration.
 */
export function FilterSelect({
  name,
  label,
  options,
  defaultValue,
  includeAll = false,
  allLabel = "All",
  id,
  className,
}: FilterSelectProps) {
  const selectId = id ?? `filter-${name}`

  return (
    <div className={cn("flex min-w-0 flex-col gap-1", className)}>
      {label ? (
        <label
          htmlFor={selectId}
          className="text-[0.6875rem] font-semibold tracking-widest text-muted-foreground uppercase"
        >
          {label}
        </label>
      ) : null}

      <div className="relative">
        <select
          id={selectId}
          name={name}
          defaultValue={defaultValue ?? (includeAll ? "" : undefined)}
          aria-label={label ? undefined : humanizeEnum(name)}
          className="h-10 w-full appearance-none rounded-none border border-transparent border-b-input bg-transparent pr-8 pl-0 text-sm text-foreground outline-none transition-[color,border-color] focus-visible:border-b-ring disabled:cursor-not-allowed disabled:opacity-50"
        >
          {includeAll ? <option value="">{allLabel}</option> : null}
          {options.map((option) => (
            <option
              key={option.value}
              value={option.value}
              className="bg-background text-foreground"
            >
              {option.label}
            </option>
          ))}
        </select>
        <ChevronDown
          className="pointer-events-none absolute top-1/2 right-0 size-4 -translate-y-1/2 text-muted-foreground"
          aria-hidden="true"
        />
      </div>
    </div>
  )
}
