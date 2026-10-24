import type { Metadata } from 'next'
import Link from 'next/link'
import { lirePublic } from '@/lib/api-public'
import { CalendarRange } from '@/lib/icons'
import { EmptyState } from '@/components/ui'
import { EnTetePage, Section } from '@/components/public/EnTetePage'
import { CarteActivite, PaginationLiens } from '@/components/public/Cartes'
import type { ListeActivites } from '@/components/public/contrats'
import { chaineRequete, numeroPage, parametre } from '@/components/public/outils'

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> }

export const metadata: Metadata = {
  title: 'Activités',
  description: 'L’agenda public du groupe scout : réunions, sorties, camps, services et célébrations à venir ou passés.',
  alternates: { canonical: '/activites' },
}

const ONGLETS = [
  { cle: 'a-venir', libelle: 'À venir' },
  { cle: 'passees', libelle: 'Passées' },
] as const

export default async function PageActivites({ searchParams }: Props) {
  const sp = await searchParams
  const periode = parametre(sp.periode) === 'passees' ? 'passees' : 'a-venir'
  const page = numeroPage(sp.page)
  const liste = await lirePublic<ListeActivites>(
    `/activites${chaineRequete({ periode: periode === 'passees' ? 'passees' : null, page })}`,
  )
  const activites = liste?.activites ?? []
  const lien = (p: number, per: string = periode) =>
    `/activites${chaineRequete({ periode: per === 'passees' ? 'passees' : null, page: p > 1 ? p : null })}`

  return (
    <>
      <EnTetePage
        surtitre="Agenda"
        titre="Nos activités"
        description="Les rendez-vous ouverts au public : réunions, sorties, camps, services et célébrations."
      />
      <Section className="max-w-5xl">
        <nav aria-label="Période" className="mb-10 flex justify-center">
          <ul className="inline-flex rounded-full bg-white p-1 shadow-carte ring-1 ring-stone-200/70">
            {ONGLETS.map((o) => {
              const actif = o.cle === periode
              return (
                <li key={o.cle}>
                  <Link
                    href={lien(1, o.cle)}
                    aria-current={actif ? 'page' : undefined}
                    className={`inline-flex rounded-full px-6 py-2.5 text-sm font-semibold transition ${
                      actif ? 'bg-primaire text-white shadow-sm' : 'text-stone-600 hover:text-stone-900'
                    }`}
                  >
                    {o.libelle}
                  </Link>
                </li>
              )
            })}
          </ul>
        </nav>

        <h2 className="sr-only">{periode === 'passees' ? 'Activités passées' : 'Activités à venir'}</h2>
        {activites.length === 0 ? (
          <EmptyState
            icon={CalendarRange}
            title={periode === 'passees' ? 'Aucune activité passée n’est publiée.' : 'Aucune activité à venir n’est publiée pour le moment.'}
            description={periode === 'passees' ? undefined : 'Les prochains rendez-vous seront annoncés ici dès leur publication.'}
          />
        ) : (
          <ul className="grid gap-5 md:grid-cols-2">
            {activites.map((a) => (
              <li key={a.id}>
                <CarteActivite activite={a} />
              </li>
            ))}
          </ul>
        )}
        {liste && <PaginationLiens page={liste.pagination.page} totalPages={liste.pagination.totalPages} lien={(p) => lien(p)} />}
      </Section>
    </>
  )
}
