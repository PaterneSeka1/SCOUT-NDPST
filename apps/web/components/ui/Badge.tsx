export type Ton = 'neutre' | 'succes' | 'attention' | 'danger' | 'info' | 'primaire' | 'accent'

const TONS: Record<Ton, string> = {
  neutre: 'bg-stone-100 text-stone-700 ring-stone-200',
  succes: 'bg-green-50 text-green-800 ring-green-200',
  attention: 'bg-amber-50 text-amber-900 ring-amber-200',
  danger: 'bg-red-50 text-red-800 ring-red-200',
  info: 'bg-sky-50 text-sky-800 ring-sky-200',
  primaire: 'bg-foret-50 text-foret-700 ring-foret-100',
  accent: 'bg-terracotta-50 text-terracotta-700 ring-terracotta-100',
}

/** Pastille de statut : couleur ET texte (jamais la couleur seule). */
export function Badge({ ton = 'neutre', children, className = '' }: { ton?: Ton; children: React.ReactNode; className?: string }) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap ring-1 ring-inset ${TONS[ton]} ${className}`}
    >
      {children}
    </span>
  )
}

/** Badge dont le ton dépend d'une valeur d'énumération. */
export function StatusBadge({
  valeur,
  libelles,
  tons,
}: {
  valeur: string
  libelles: Record<string, string>
  tons: Record<string, Ton>
}) {
  return <Badge ton={tons[valeur] ?? 'neutre'}>{libelles[valeur] ?? valeur}</Badge>
}
