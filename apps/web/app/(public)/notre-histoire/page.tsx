import type { Metadata } from 'next'
import Link from 'next/link'
import { LABELS_TYPE_EVENEMENT_HISTORIQUE } from '@scout/shared'
import { lirePublic } from '@/lib/api-public'
import { getIdentite } from '@/lib/identite-serveur'
import { dateLongue } from '@/lib/format'
import { ExternalLink, FileText, Quote, ScrollText } from '@/lib/icons'
import { EmptyState } from '@/components/ui'
import { ContenuRiche } from '@/components/contenu/ContenuRiche'
import { EnTetePage, Section } from '@/components/public/EnTetePage'
import { ImagePublique } from '@/components/public/Cartes'
import type { EvenementHistoriquePublic } from '@/components/public/types'

export async function generateMetadata(): Promise<Metadata> {
  const identite = await getIdentite()
  return {
    title: 'Notre histoire',
    description: identite.anneeHistorique
      ? `L’histoire du scoutisme à ${identite.nomParoisse || 'la paroisse'} depuis ${identite.anneeHistorique} : dates, figures, camps et témoignages.`
      : `L’histoire du scoutisme à ${identite.nomParoisse || 'la paroisse'} : dates, figures, camps et témoignages.`,
    alternates: { canonical: '/notre-histoire' },
  }
}

function MentionAVerifier() {
  return (
    <p className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-2.5 py-0.5 text-xs text-amber-900 ring-1 ring-amber-200 ring-inset">
      À confirmer par les archives
    </p>
  )
}

function Temoignage({ e }: { e: EvenementHistoriquePublic }) {
  return (
    <figure className="relative rounded-2xl bg-profond p-6 text-white sm:p-8">
      <Quote className="h-8 w-8 text-or-300" strokeWidth={1.5} aria-hidden />
      <h3 className="sr-only">{e.titre}</h3>
      <blockquote className="titre-display mt-3 text-lg leading-relaxed text-white/95 sm:text-xl">
        {e.description ? <ContenuRiche texte={e.description} className="[&_*]:text-white/95" /> : <p>{e.titre}</p>}
      </blockquote>
      <figcaption className="mt-5 text-sm text-or-300">
        {e.auteurTemoignage ? `— ${e.auteurTemoignage}` : e.titre}
        {e.source && <span className="block text-xs text-white/60">Source : {e.source}</span>}
      </figcaption>
      {e.statutValidation === 'A_VERIFIER' && <MentionAVerifier />}
    </figure>
  )
}

export default async function PageHistoire() {
  const [identite, evenements] = await Promise.all([getIdentite(), lirePublic<EvenementHistoriquePublic[]>('/histoire')])
  const liste = evenements ?? []

  return (
    <>
      <EnTetePage
        surtitre="Notre histoire"
        titre={identite.anneeHistorique ? `Depuis ${identite.anneeHistorique}` : 'Notre histoire'}
        description="Les grandes étapes du scoutisme dans la paroisse, telles que conservées par les archives et la mémoire de ceux qui les ont vécues."
      />

      {(identite.anneeHistorique || identite.rangHistorique) && (
        <Section className="pb-0 sm:pb-0">
          <div className="grid items-center gap-8 rounded-3xl bg-white p-8 shadow-carte ring-1 ring-stone-200/70 sm:p-12 md:grid-cols-[auto_1fr]">
            {identite.anneeHistorique && (
              <p className="titre-display text-center text-7xl leading-none font-semibold text-accent sm:text-8xl" aria-hidden>
                {identite.anneeHistorique}
              </p>
            )}
            <div>
              <h2 className="titre-display text-2xl font-semibold text-stone-900 sm:text-3xl">
                {identite.anneeHistorique
                  ? `La paroisse accueille le scoutisme en ${identite.anneeHistorique}`
                  : 'Une place dans l’histoire du scoutisme'}
              </h2>
              {identite.rangHistorique && <p className="mt-3 text-lg leading-relaxed text-stone-700">{identite.rangHistorique}</p>}
              {identite.sourceHistorique && <p className="mt-2 text-sm text-stone-500">Source : {identite.sourceHistorique}</p>}
            </div>
          </div>
        </Section>
      )}

      <Section>
        {liste.length === 0 ? (
          <EmptyState
            icon={ScrollText}
            title="La chronologie sera bientôt publiée."
            description="Les dates et les témoignages sont en cours de rassemblement et de vérification auprès des archives."
          />
        ) : (
          <>
            <h2 className="sr-only">Chronologie</h2>
            <ol className="relative mx-auto max-w-4xl">
              <span className="absolute top-2 bottom-2 left-[1.15rem] w-px bg-gradient-to-b from-or-500/70 via-sable-300 to-transparent sm:left-1/2" aria-hidden />
              {liste.map((e, i) => {
                const droite = i % 2 === 1
                return (
                  <li key={e.id} className="relative pb-12 pl-12 last:pb-0 sm:grid sm:grid-cols-2 sm:gap-12 sm:pl-0">
                    <span
                      className="absolute top-2 left-[0.65rem] h-4 w-4 rounded-full border-4 border-creme bg-accent shadow sm:left-1/2 sm:-translate-x-1/2"
                      aria-hidden
                    />
                    <div className={droite ? 'sm:col-start-2' : 'sm:text-right'}>
                      <p className="titre-display text-3xl font-semibold text-accent">
                        <time dateTime={e.date ?? String(e.annee)}>{e.annee}</time>
                      </p>
                      <p className="mt-1 text-xs font-semibold tracking-[0.15em] text-stone-500 uppercase">
                        {LABELS_TYPE_EVENEMENT_HISTORIQUE[e.type] ?? e.type}
                        {e.date && <span className="font-normal tracking-normal normal-case"> · {dateLongue(e.date)}</span>}
                      </p>
                    </div>
                    <div className={`mt-3 sm:mt-0 ${droite ? 'sm:col-start-1 sm:row-start-1' : ''}`}>
                      {e.type === 'TEMOIGNAGE' ? (
                        <Temoignage e={e} />
                      ) : (
                        <article className="overflow-hidden rounded-2xl bg-white shadow-carte ring-1 ring-stone-200/70">
                          {e.imageUrl && (
                            <div className="aspect-[16/10] bg-sable-100">
                              <ImagePublique src={e.imageUrl} alt={e.imageAlt ?? ''} />
                            </div>
                          )}
                          <div className="p-5 sm:p-6">
                            <h3 className="titre-display text-xl font-semibold text-stone-900">{e.titre}</h3>
                            <ContenuRiche texte={e.description} className="mt-3 text-sm" />
                            {(e.documentUrl || e.source) && (
                              <div className="mt-4 space-y-1 border-t border-stone-100 pt-3 text-xs text-stone-500">
                                {e.source && <p>Source : {e.source}</p>}
                                {e.documentUrl && (
                                  <Link
                                    href={e.documentUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-1 font-medium text-primaire hover:underline"
                                  >
                                    <FileText className="h-3.5 w-3.5" aria-hidden />
                                    Consulter le document
                                    <ExternalLink className="h-3 w-3" aria-hidden />
                                    <span className="sr-only">(nouvel onglet)</span>
                                  </Link>
                                )}
                              </div>
                            )}
                            {e.statutValidation === 'A_VERIFIER' && <MentionAVerifier />}
                          </div>
                        </article>
                      )}
                    </div>
                  </li>
                )
              })}
            </ol>
          </>
        )}
      </Section>
    </>
  )
}
