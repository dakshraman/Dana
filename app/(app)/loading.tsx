import { Skeleton } from "@/components/ui/skeleton"

export default function AppLoading() {
  return (
    <div className="flex flex-col gap-6" aria-busy="true" aria-label="Loading page">
      <div className="flex flex-col gap-2">
        <Skeleton className="h-3 w-28" />
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-3 w-96 max-w-full" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <Skeleton key={index} className="h-28 w-full" />
        ))}
      </div>
      <Skeleton className="h-80 w-full" />
      <Skeleton className="h-64 w-full" />
    </div>
  )
}
