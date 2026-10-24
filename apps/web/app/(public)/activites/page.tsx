import type { Metadata } from 'next'
import Link from 'next/link'
import { lirePublic } from '@/lib/api-public'
import { EnTetePage } from '@/components/public/EnTetePage'
import { CarteActivite, LienSuite, PaginationLiens } from '@/components/public/Cartes'
import { EtatVidePublic } from '@/components/public/EtatVidePublic'
import type { ListeActivites } from '@/components/public/contrats'
import type { ActivitePublique } from '@/components/public/types'
import { chaineRequete, numeroPage, parametre } from '@/components/public/outils'

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> }

export const metadata: Metadata = {
  title: 'Agenda',
  description: 'L’agenda public du groupe scout : réunions, sorties, camps, services et célébrations à venir ou passés.',
  alternates: { canonical: '/activites' },
}

const ONGLETS = [
  { cle: 'a-venir', libelle: 'À venir' },
  { cle: 'passees', libelle: 'Passées' },
] as const

const FORMAT_MOIS = new Intl.DateTimeFormat('fr-FR', { month: 'long', year: 'numeric', timeZone: 'UTC' })

/** Regroupe les activités (déjà triées par l'API) par mois de début. */
function parMois(activites: ActivitePublique[]) {
  const groupes: { cle: string; libelle: string; activites: ActivitePublique[] }[] = []
  for (const a of activites) {
    const date = new Date(a.dateDebut)
    const cle = `${date.getUTCFullYear()}-${date.getUTCMonth()}`
    const dernier = groupes.at(-1)
    if (dernier?.cle === cle) dernier.activites.push(a)
    else groupes.push({ cle, libelle: FORMAT_MOIS.format(date), activites: [a] })
  }
  return groupes
}

export default async function PageActivites({ searchParams }: Props) {
  const sp = await searchParams
  const periode = parametre(sp.periode) === 'passees' ? 'passees' : 'a-venir'
  const page = numeroPage(sp.page)
  const liste = await lirePublic<ListeActivites>(`/activites${chaineRequete({ periode: periode === 'passees' ? 'passees' : null, page })}`)
  const activites = liste?.activites ?? []
  const lien = (p: number, per: string = periode) => `/activites${chaineRequete({ periode: per === 'passees' ? 'passees' : null, page: p > 1 ? p : null })}`

  return (
    <>
      <EnTetePage
        surtitre="Agenda"
        titre="Les rendez-vous du groupe"
        description="Réunions, sorties, camps, services et célébrations ouverts au public."
        complement={<LienSuite href="/actualites">Lire les actualités</LienSuite>}
      >
        <nav aria-label="Période" className="mt-8">
          <ul className="inline-flex gap-1 rounded-full border border-ligne bg-white p-1">
            {ONGLETS.map((o) => {
              const actif = o.cle === periode
              return (
                <li key={o.cle}>
                  <Link
                    href={lien(1, o.cle)}
                    aria-current={actif ? 'page' : undefined}
                    className={`inline-flex rounded-full px-5 py-2 text-sm font-semibold transition ${actif ? 'bg-encre text-white' : 'text-encre-douce hover:text-encre'}`}
                  >
                    {o.libelle}
                  </Link>
                </li>
              )
            })}
          </ul>
        </nav>
      </EnTetePage>

      <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6 sm:py-14">
        <h2 className="sr-only">{periode === 'passees' ? 'Activités passées' : 'Activités à venir'}</h2>
        {liste === null ? (
          <EtatVidePublic titre="L’agenda est momentanément indisponible." texte="Réessayez dans quelques instants." liens={[{ libelle: 'Retour à l’accueil', href: '/' }]} />
        ) : activites.length === 0 ? (
          <EtatVidePublic
            titre={periode === 'passees' ? 'Aucune activité passée n’est publiée.' : 'Aucun rendez-vous public n’est annoncé pour le moment.'}
            texte={
              periode === 'passees'
                ? 'Les comptes rendus des activités sont publiés dans les actualités.'
                : 'Les prochains rendez-vous seront annoncés ici dès leur publication.'
            }
            liens={[
              periode === 'passees' ? { libelle: 'Voir les rendez-vous à venir', href: lien(1, 'a-venir') } : { libelle: 'Voir les activités passées', href: lien(1, 'passees') },
              { libelle: 'Lire les actualités', href: '/actualites' },
            ]}
          />
        ) : (
          <div className="space-y-12">
            {parMois(activites).map((g) => (
              <section key={g.cle} aria-labelledby={`mois-${g.cle}`}>
                <h3 id={`mois-${g.cle}`} className="signal sticky top-(--hauteur-entete) z-10 -mx-4 border-b border-ligne bg-papier/95 px-4 py-3 text-base text-accent backdrop-blur sm:mx-0 sm:px-0">
                  {g.libelle}
                </h3>
                <ul className="divide-y divide-ligne">
                  {g.activites.map((a) => (
                    <li key={a.id} className="py-7">
                      <CarteActivite activite={a} passee={periode === 'passees'} />
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
        )}
        {liste && <PaginationLiens page={liste.pagination.page} totalPages={liste.pagination.totalPages} lien={(p) => lien(p)} />}
      </div>
    </>
  )
}
