export function Skeleton({ className = '' }: { className?: string }) {
  return <div aria-hidden className={`animate-pulse rounded-md bg-stone-200/70 ${className}`} />
}

export function KpiSkeleton() {
  return (
    <div className="rounded-xl border border-stone-200/80 bg-white p-5 shadow-carte" aria-hidden>
      <Skeleton className="h-4 w-28" />
      <Skeleton className="mt-3 h-8 w-16" />
    </div>
  )
}

export function ChargementPage({ libelle = 'Chargement…' }: { libelle?: string }) {
  return (
    <div role="status" aria-live="polite" className="space-y-4">
      <span className="sr-only">{libelle}</span>
      <Skeleton className="h-8 w-56" />
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <KpiSkeleton key={i} />
        ))}
      </div>
      <Skeleton className="h-64 w-full" />
    </div>
  )
}
