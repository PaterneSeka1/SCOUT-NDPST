import Link from 'next/link'
import type { LucideIcon } from '@/lib/icons'

/** Indicateur chiffré, calculé par l'API (jamais de valeur fictive). */
export function KpiCard({
  libelle,
  valeur,
  detail,
  icone: Icone,
  lien,
}: {
  libelle: string
  valeur: string | number
  detail?: string
  icone?: LucideIcon
  lien?: string
}) {
  const contenu = (
    <>
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm leading-snug text-stone-500">{libelle}</p>
        {Icone && (
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-foret-50 text-primaire">
            <Icone className="h-4.5 w-4.5" strokeWidth={2} aria-hidden />
          </span>
        )}
      </div>
      <p className="mt-2 text-2xl font-semibold tracking-tight text-stone-900 tabular-nums sm:text-3xl">{valeur}</p>
      {detail && <p className="mt-1 text-xs text-stone-500">{detail}</p>}
    </>
  )
  const classes = 'block rounded-xl border border-stone-200/80 bg-white p-4 shadow-carte sm:p-5'
  return lien ? (
    <Link href={lien} className={`${classes} transition hover:border-stone-300 hover:shadow-md`}>
      {contenu}
    </Link>
  ) : (
    <div className={classes}>{contenu}</div>
  )
}
