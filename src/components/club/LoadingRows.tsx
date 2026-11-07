import { Skeleton } from '@/components/ui/skeleton'

export function LoadingRows() {
  return <div role="status" aria-label="Loading" className="space-y-4 border-y border-border py-6">
    <Skeleton className="h-6 w-1/3 rounded-md" />
    {[0, 1, 2, 3].map(i => <Skeleton key={i} className="h-16 w-full rounded-md" />)}
  </div>
}