import { Skeleton } from '@/components/ui'

/** Squelette d'un formulaire d'administration en cours de chargement. */
export function ChargementFormulaire({ champs = 6, libelle = 'Chargement…' }: { champs?: number; libelle?: string }) {
  return (
    <div role="status" aria-live="polite" className="space-y-5 rounded-xl border border-stone-200/80 bg-white p-5 shadow-carte">
      <span className="sr-only">{libelle}</span>
      <Skeleton className="h-5 w-48" />
      {Array.from({ length: champs }, (_, i) => (
        <div key={i} className="space-y-2">
          <Skeleton className="h-3.5 w-32" />
          <Skeleton className="h-10 w-full" />
        </div>
      ))}
    </div>
  )
}
