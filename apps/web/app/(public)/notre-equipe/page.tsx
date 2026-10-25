import type { Metadata } from 'next'
import Link from 'next/link'
import { LABELS_BRANCHES, ORDRE_BRANCHES } from '@scout/shared'
import { lirePublic } from '@/lib/api-public'
import { accentBranche } from '@/lib/branches-visuel'
import { EnTetePage } from '@/components/public/EnTetePage'
import { CarteMembre } from '@/components/public/Cartes'
import { EtatVidePublic } from '@/components/public/EtatVidePublic'
import type { MembrePublic } from '@/components/public/types'
import { chaineRequete, parametre } from '@/components/public/outils'

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> }

export const metadata: Metadata = {
  title: 'La maîtrise',
  description: 'Les chefs, cheftaines et responsables qui encadrent le groupe scout et chacune de ses branches.',
  alternates: { canonical: '/notre-equipe' },
}

interface Groupe {
  cle: string
  titre: string
  description: string
  membres: MembrePublic[]
}

// Direction du groupe d'abord, puis les branches de la plus jeune à la plus
// âgée. L'ordre interne (rôle, puis ordre public, puis nom) vient de l'API.
function regrouper(membres: MembrePublic[]): Groupe[] {
  const direction = membres.filter((m) => !m.brancheType)
  const groupes: Groupe[] = []
  if (direction.length > 0) {
    groupes.push({ cle: 'direction', titre: 'Direction du groupe', description: 'Elle coordonne les branches, accompagne la maîtrise et représente le groupe.', membres: direction })
  }
  for (const type of ORDRE_BRANCHES) {
    const liste = membres.filter((m) => m.brancheType === type)
    if (liste.length > 0) {
      groupes.push({ cle: type, titre: LABELS_BRANCHES[type] ?? type, description: `Encadrement de la branche ${LABELS_BRANCHES[type] ?? type}.`, membres: liste })
    }
  }
  return groupes
}

export default async function PageMaitrise({ searchParams }: Props) {
  const filtre = parametre((await searchParams).branche)
  const membres = await lirePublic<MembrePublic[]>('/equipe')
  const groupes = regrouper(membres ?? [])
  const visibles = groupes.filter((g) => !filtre || g.cle === filtre)
  const total = new Set(membres?.map(m => m.id)).size

  return (
    <>
      <EnTetePage
        variante="foret"
        surtitre="La maîtrise"
        titre="Ceux qui accompagnent les jeunes"
        description="Chefs, cheftaines et responsables bénévoles : ils préparent les activités, encadrent les camps et veillent sur la progression de chacun."
        complement={
          total > 0 ? (
            <p className="lg:text-right">
              <span className="chiffre-signal block text-5xl leading-none text-or-300">{total}</span>
              <span className="signal text-sm text-white/70">membre{total > 1 ? 's' : ''} présenté{total > 1 ? 's' : ''}</span>
            </p>
          ) : undefined
        }
      >
        {groupes.length > 1 && (
          <nav aria-label="Filtrer par branche" className="mt-8">
            <ul className="flex flex-wrap gap-2">
              {[{ cle: '', titre: 'Toute la maîtrise' }, ...groupes].map((g) => {
                const actif = filtre === g.cle
                return (
                  <li key={g.cle || 'tous'}>
                    <Link
                      href={`/notre-equipe${chaineRequete({ branche: g.cle })}`}
                      aria-current={actif ? 'page' : undefined}
                      scroll={false}
                      className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition focus-visible:outline-white ${
                        actif ? 'bg-white text-encre' : 'bg-white/10 text-white hover:bg-white/20'
                      }`}
                    >
                      {g.cle && g.cle !== 'direction' && <span className="h-2 w-2 rounded-full" style={{ backgroundColor: accentBranche(g.cle) }} aria-hidden />}
                      {g.titre}
                    </Link>
                  </li>
                )
              })}
            </ul>
          </nav>
        )}
      </EnTetePage>

      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 sm:py-14 lg:px-8">
        {membres === null ? (
          <EtatVidePublic
            titre="La présentation de la maîtrise est momentanément indisponible."
            texte="Réessayez dans quelques instants."
            liens={[{ libelle: 'Retour à l’accueil', href: '/' }]}
          />
        ) : visibles.length === 0 ? (
          <EtatVidePublic
            titre={filtre ? 'Aucun membre présenté pour cette branche.' : 'La maîtrise sera bientôt présentée ici.'}
            texte="Les profils de la maîtrise sont publiés par la direction du groupe, avec l’accord des personnes concernées. En attendant, la direction répond à vos questions."
            liens={[
              ...(filtre ? [{ libelle: 'Voir toute la maîtrise', href: '/notre-equipe' }] : []),
              { libelle: 'Contacter le groupe', href: '/nous-rejoindre?objet=contact#formulaire' },
            ]}
          />
        ) : (
          <div className="space-y-16">
            {visibles.map((g) => (
              <section key={g.cle} aria-labelledby={`titre-${g.cle}`} className="grid gap-8 lg:grid-cols-12">
                <header className="lg:col-span-3">
                  <div className="lg:sticky lg:top-[calc(var(--hauteur-entete)+2rem)]">
                    <span className="block h-1 w-12 rounded-full" style={{ backgroundColor: g.cle === 'direction' ? 'var(--ca)' : accentBranche(g.cle) }} aria-hidden />
                    <h2 id={`titre-${g.cle}`} className="titre-display mt-4 text-2xl font-semibold text-encre">
                      {g.titre}
                    </h2>
                    <p className="mt-2 text-[0.95rem] leading-relaxed text-encre-douce">{g.description}</p>
                    {g.cle !== 'direction' && (
                      <Link href={`/nos-branches`} className="mt-3 inline-block text-sm font-semibold text-primaire underline-offset-4 hover:underline">
                        Découvrir les branches
                      </Link>
                    )}
                  </div>
                </header>
                <ul className="grid grid-cols-2 gap-x-5 gap-y-10 sm:grid-cols-3 lg:col-span-9 xl:grid-cols-4">
                  {g.membres.map((m) => (
                    <li key={`${m.id}-${m.fonction}-${m.brancheType}`}>
                      <CarteMembre membre={m} />
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
        )}
      </div>
    </>
  )
}
