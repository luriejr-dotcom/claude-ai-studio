import { Skeleton } from '@/components/ui/skeleton'

export function LoadingRows() {
  return <div role="status" aria-label="Loading" className="space-y-4 py-4">
    <Skeleton className="h-12 w-2/3" />
    {[0, 1, 2, 3].map(i => <Skeleton key={i} className="h-20 w-full" />)}
  </div>
}