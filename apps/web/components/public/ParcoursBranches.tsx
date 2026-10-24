import Link from 'next/link'
import { ArrowUpRight } from '@/lib/icons'
import { styleAccent } from '@/lib/branches-visuel'
import type { BranchePublique } from './types'

/**
 * Les branches comme un parcours : une étape par tranche d'âge, de la plus
 * jeune à la plus âgée. Horizontal sur grand écran, vertical sur mobile.
 */
export function ParcoursBranches({ branches, clair = false }: { branches: BranchePublique[]; clair?: boolean }) {
  return (
    <ol className="grid gap-px overflow-hidden rounded-lg sm:grid-cols-2 lg:grid-flow-col lg:auto-cols-fr lg:grid-cols-none">
      {branches.map((b, i) => (
        <li key={b.slug} style={styleAccent(b.type)} className="group relative">
          <Link
            href={`/nos-branches/${b.slug}`}
            className={`flex h-full flex-col border-t-4 border-(--accent-branche) p-5 transition lg:min-h-[13rem] ${
              clair ? 'bg-white/[0.06] text-white hover:bg-white/[0.12] focus-visible:outline-white' : 'bg-white text-encre hover:bg-papier'
            }`}
          >
            <span className={`signal text-xs ${clair ? 'text-white/60' : 'text-encre-pale'}`}>Étape {i + 1}</span>
            <span className="titre-display mt-2 text-xl leading-tight font-semibold">{b.nom}</span>
            {b.trancheAge && (
              <span className="chiffre-signal mt-1 text-lg" style={{ color: clair ? undefined : 'var(--encre-branche)' }}>
                {b.trancheAge}
              </span>
            )}
            <span className="mt-auto flex items-center gap-1 pt-6 text-sm font-semibold">
              Découvrir
              <ArrowUpRight className="h-4 w-4 transition group-hover:translate-x-0.5 group-hover:-translate-y-0.5" aria-hidden />
            </span>
          </Link>
        </li>
      ))}
    </ol>
  )
}
