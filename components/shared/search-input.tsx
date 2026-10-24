import { Search } from "lucide-react"

import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"

export type SearchInputProps = {
  name?: string
  defaultValue?: string
  placeholder?: string
  label?: string
  id?: string
  className?: string
}

/**
 * Search field for GET filter forms. No client JavaScript is required, so it
 * submits with the surrounding form immediately.
 */
export function SearchInput({
  name = "q",
  defaultValue,
  placeholder = "Search...",
  label = "Search",
  id,
  className,
}: SearchInputProps) {
  const inputId = id ?? `search-${name}`

  return (
    <div className={cn("relative w-full", className)}>
      <label htmlFor={inputId} className="sr-only">
        {label}
      </label>
      <Search
        className="pointer-events-none absolute top-1/2 left-0 size-4 -translate-y-1/2 text-muted-foreground"
        aria-hidden="true"
      />
      <Input
        id={inputId}
        type="search"
        name={name}
        defaultValue={defaultValue}
        placeholder={placeholder}
        className="pl-7"
      />
    </div>
  )
}
