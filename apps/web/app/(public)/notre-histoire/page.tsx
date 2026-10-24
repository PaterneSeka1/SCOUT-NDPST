import type { Metadata } from 'next'
import Link from 'next/link'
import { LABELS_TYPE_EVENEMENT_HISTORIQUE } from '@scout/shared'
import { lirePublic } from '@/lib/api-public'
import { getIdentite } from '@/lib/identite-serveur'
import { dateLongue } from '@/lib/format'
import { ExternalLink, FileText, Quote } from '@/lib/icons'
import { ContenuRiche } from '@/components/contenu/ContenuRiche'
import { ImagePublique, LienSuite } from '@/components/public/Cartes'
import { EtatVidePublic } from '@/components/public/EtatVidePublic'
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

function MentionAVerifier({ clair = false }: { clair?: boolean }) {
  return (
    <p className={`mt-3 inline-flex items-center gap-1.5 text-sm italic ${clair ? 'text-white/65' : 'text-or-700'}`}>
      <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden />
      À confirmer par les archives
    </p>
  )
}

function Temoignage({ e }: { e: EvenementHistoriquePublic }) {
  return (
    <figure className="relative">
      <Quote className="h-8 w-8 text-accent" strokeWidth={1.5} aria-hidden />
      <h3 className="sr-only">{e.titre}</h3>
      <blockquote className="titre-display mt-3 text-2xl leading-relaxed text-encre sm:text-[1.7rem]">
        {e.description ? <ContenuRiche texte={e.description} className="[&_p]:text-[inherit] [&_p]:leading-[inherit]" /> : <p>{e.titre}</p>}
      </blockquote>
      <figcaption className="mt-4 text-[0.95rem] text-encre-douce">
        {e.auteurTemoignage ? `— ${e.auteurTemoignage}` : e.titre}
        {e.source && <span className="block text-sm text-encre-pale">Source : {e.source}</span>}
      </figcaption>
      {e.statutValidation === 'A_VERIFIER' && <MentionAVerifier />}
    </figure>
  )
}

function Evenement({ e }: { e: EvenementHistoriquePublic }) {
  return (
    <article className="grid gap-5 sm:grid-cols-[1fr_auto]">
      <div>
        <h3 className="titre-display text-2xl leading-snug font-semibold text-encre">{e.titre}</h3>
        <ContenuRiche texte={e.description} className="mt-3 max-w-prose" />
        {(e.documentUrl || e.source) && (
          <div className="mt-4 flex flex-wrap gap-x-5 gap-y-1 text-sm text-encre-pale">
            {e.source && <p>Source : {e.source}</p>}
            {e.documentUrl && (
              <Link href={e.documentUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 font-medium text-primaire hover:underline">
                <FileText className="h-4 w-4" aria-hidden />
                Consulter le document
                <ExternalLink className="h-3 w-3" aria-hidden />
                <span className="sr-only">(nouvel onglet)</span>
              </Link>
            )}
          </div>
        )}
        {e.statutValidation === 'A_VERIFIER' && <MentionAVerifier />}
      </div>
      {e.imageUrl && (
        <div className="aspect-[4/3] w-full overflow-hidden rounded-md bg-papier-fonce sm:w-56">
          <ImagePublique src={e.imageUrl} alt={e.imageAlt ?? ''} />
        </div>
      )}
    </article>
  )
}

/** Regroupe la chronologie par décennie (repères de lecture du sentier). */
function parDecennie(evenements: EvenementHistoriquePublic[]) {
  const groupes = new Map<number, EvenementHistoriquePublic[]>()
  for (const e of evenements) {
    const decennie = Math.floor(e.annee / 10) * 10
    groupes.set(decennie, [...(groupes.get(decennie) ?? []), e])
  }
  return [...groupes.entries()]
}

export default async function PageHistoire() {
  const [identite, evenements] = await Promise.all([getIdentite(), lirePublic<EvenementHistoriquePublic[]>('/histoire')])
  const liste = evenements ?? []
  const decennies = parDecennie(liste)

  return (
    <>
      <section className="relative isolate overflow-hidden bg-profond text-white">
        <div className="motif-topo-clair absolute inset-0 -z-10 opacity-[0.08]" aria-hidden />
        <div className="mx-auto grid max-w-7xl gap-10 px-4 pt-12 pb-14 sm:px-6 sm:pt-16 sm:pb-20 lg:grid-cols-12 lg:items-end lg:px-8">
          <div className="lg:col-span-7">
            <p className="signal text-sm text-or-300">Notre histoire</p>
            <h1 className="titre-display mt-3 text-[2.4rem] leading-[1.08] font-semibold text-balance sm:text-5xl lg:text-6xl">
              {identite.anneeHistorique
                ? `Le scoutisme dans la paroisse depuis ${identite.anneeHistorique}`
                : 'Une histoire qui se transmet'}
            </h1>
            <p className="mt-5 max-w-xl text-lg leading-relaxed text-white/80">
              Les grandes étapes du groupe, telles que conservées par les archives et la mémoire de celles et ceux qui les ont vécues.
            </p>
          </div>
          {identite.anneeHistorique && (
            <div className="lg:col-span-5 lg:text-right">
              <p className="chiffre-signal text-[6.5rem] leading-[0.85] text-or-300 sm:text-[9rem]" aria-hidden>
                {identite.anneeHistorique}
              </p>
              {identite.rangHistorique && <p className="mt-4 text-lg text-white/90 lg:ml-auto lg:max-w-sm">{identite.rangHistorique}</p>}
              {identite.sourceHistorique && <p className="mt-1 text-sm text-white/60">Source : {identite.sourceHistorique}</p>}
            </div>
          )}
        </div>
      </section>

      <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6 sm:py-16">
        {liste.length === 0 ? (
          <EtatVidePublic
            titre={evenements === null ? 'La chronologie est momentanément indisponible.' : 'La chronologie sera bientôt publiée.'}
            texte="Les dates et les témoignages sont en cours de rassemblement et de vérification auprès des archives. Vous avez des souvenirs ou des documents ? Partagez-les avec la direction du groupe."
            liens={[{ libelle: 'Partager un souvenir', href: '/nous-rejoindre?objet=contact#formulaire' }]}
          />
        ) : (
          <>
            <h2 className="sr-only">Chronologie</h2>
            <ol className="relative">
              <span className="absolute top-3 bottom-3 left-[0.45rem] w-0.5 bg-ligne sm:left-[7.45rem]" aria-hidden />
              {decennies.map(([decennie, evts]) => (
                <li key={decennie} className="relative pb-6">
                  <p className="signal relative mb-8 pl-8 text-lg text-accent sm:pl-0">
                    <span className="absolute top-1.5 left-0 h-4 w-4 rounded-full border-4 border-papier bg-accent sm:left-[7rem]" aria-hidden />
                    Années {decennie}
                  </p>
                  <ol className="space-y-12">
                    {evts.map((e) => (
                      <li key={e.id} className="relative grid gap-2 pl-8 sm:grid-cols-[6rem_1fr] sm:gap-14 sm:pl-0">
                        <span className="absolute top-2.5 left-[0.2rem] h-2.5 w-2.5 rounded-full bg-ligne-forte sm:left-[7.2rem]" aria-hidden />
                        <div className="sm:text-right">
                          <p className="chiffre-signal text-3xl leading-none text-encre">
                            <time dateTime={e.date ?? String(e.annee)}>{e.annee}</time>
                          </p>
                          <p className="signal mt-1 text-xs text-encre-pale">{LABELS_TYPE_EVENEMENT_HISTORIQUE[e.type] ?? e.type}</p>
                          {e.date && <p className="mt-0.5 text-xs text-encre-pale">{dateLongue(e.date)}</p>}
                        </div>
                        <div>{e.type === 'TEMOIGNAGE' ? <Temoignage e={e} /> : <Evenement e={e} />}</div>
                      </li>
                    ))}
                  </ol>
                </li>
              ))}
            </ol>
          </>
        )}
      </div>

      <section className="border-t border-ligne">
        <div className="mx-auto flex max-w-5xl flex-col gap-4 px-4 py-10 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <p className="titre-display text-xl text-encre">L’histoire continue avec chaque nouvelle génération.</p>
          <div className="flex flex-wrap gap-x-8 gap-y-3">
            <LienSuite href="/notre-equipe">La maîtrise aujourd’hui</LienSuite>
            <LienSuite href="/nous-rejoindre">Nous rejoindre</LienSuite>
          </div>
        </div>
      </section>
    </>
  )
}
