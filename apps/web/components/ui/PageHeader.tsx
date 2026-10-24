import Link from 'next/link'
import { ChevronRight } from '@/lib/icons'

export interface Miette {
  libelle: string
  href?: string
}

export function Breadcrumbs({ miettes }: { miettes: Miette[] }) {
  if (miettes.length === 0) return null
  return (
    <nav aria-label="Fil d'Ariane" className="mb-2">
      <ol className="flex flex-wrap items-center gap-1 text-xs text-stone-500">
        {miettes.map((m, i) => (
          <li key={`${m.libelle}-${i}`} className="flex items-center gap-1">
            {i > 0 && <ChevronRight className="h-3 w-3 text-stone-400" aria-hidden />}
            {m.href && i < miettes.length - 1 ? (
              <Link href={m.href} className="hover:text-stone-800 hover:underline">
                {m.libelle}
              </Link>
            ) : (
              <span aria-current={i === miettes.length - 1 ? 'page' : undefined} className="text-stone-700">
                {m.libelle}
              </span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  )
}

/** En-tête de page de l'espace privé : fil d'Ariane, titre, description, actions. */
export function PageHeader({
  titre,
  description,
  actions,
  miettes = [],
}: {
  titre: string
  description?: React.ReactNode
  actions?: React.ReactNode
  miettes?: Miette[]
}) {
  return (
    <header className="mb-6">
      <Breadcrumbs miettes={miettes} />
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-xl font-semibold tracking-tight text-stone-900 sm:text-2xl">{titre}</h1>
          {description && <p className="mt-1 max-w-3xl text-sm text-stone-500">{description}</p>}
        </div>
        {actions && <div className="flex shrink-0 flex-wrap gap-2">{actions}</div>}
      </div>
    </header>
  )
}
