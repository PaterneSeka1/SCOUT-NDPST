import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { lirePublic } from '@/lib/api-public'
import { styleAccent } from '@/lib/branches-visuel'
import { ContenuRiche } from '@/components/contenu/ContenuRiche'
import { CarteActivite, ImagePublique, LienRetour, LienSuite, Portrait } from '@/components/public/Cartes'
import type { BrancheDetail } from '@/components/public/contrats'
import { extrait } from '@/components/public/outils'

type Props = { params: Promise<{ slug: string }> }

const lireBranche = (slug: string) => lirePublic<BrancheDetail>(`/branches/${encodeURIComponent(slug)}`)

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const branche = await lireBranche(slug)
  if (!branche) return { title: 'Branche introuvable' }
  return {
    title: branche.nom,
    description: extrait(branche.presentation || `La branche ${branche.nom}${branche.trancheAge ? ` (${branche.trancheAge})` : ''} du groupe scout.`),
    alternates: { canonical: `/nos-branches/${branche.slug}` },
    openGraph: branche.imageUrl ? { images: [{ url: branche.imageUrl, alt: branche.imageAlt ?? '' }] } : undefined,
  }
}

export default async function PageBranche({ params }: Props) {
  const { slug } = await params
  const branche = await lireBranche(slug)
  if (!branche) notFound()

  const blocs = [
    { titre: 'Identité', texte: branche.identite },
    { titre: 'Objectifs', texte: branche.objectifs },
    { titre: 'Pédagogie', texte: branche.pedagogie },
    { titre: 'Activités types', texte: branche.activitesTypes },
  ].filter((b) => b.texte?.trim())

  return (
    <div style={styleAccent(branche.type)}>
      <section className="relative isolate overflow-hidden bg-profond text-white">
        {branche.imageUrl && (
          <div className="absolute inset-0 -z-20 opacity-40">
            <ImagePublique src={branche.imageUrl} alt="" prioritaire />
          </div>
        )}
        <div className="absolute inset-0 -z-10 bg-gradient-to-r from-profond via-profond/85 to-profond/40" aria-hidden />
        <div className="motif-topo-clair absolute inset-0 -z-10 opacity-[0.07]" aria-hidden />
        <span className="absolute inset-x-0 bottom-0 h-1.5 bg-(--accent-branche)" aria-hidden />
        <div className="mx-auto max-w-7xl px-4 pt-10 pb-12 sm:px-6 sm:pt-14 sm:pb-16 lg:px-8">
          <LienRetour href="/nos-branches" clair>
            Toutes les branches
          </LienRetour>
          <p className="signal mt-8 text-sm text-or-300">Branche</p>
          <h1 className="titre-display mt-2 text-5xl font-semibold sm:text-6xl">{branche.nom}</h1>
          {branche.trancheAge && (
            <p className="chiffre-signal mt-3 text-2xl text-white/90">
              <span className="sr-only">Tranche d’âge : </span>
              {branche.trancheAge}
            </p>
          )}
          {branche.presentation && <p className="titre-display mt-6 max-w-3xl text-xl leading-relaxed text-white/90 sm:text-2xl">{branche.presentation}</p>}
        </div>
      </section>

      <div className="mx-auto grid max-w-7xl gap-12 px-4 py-12 sm:px-6 sm:py-16 lg:grid-cols-12 lg:px-8">
        <div className="lg:col-span-8">
          {blocs.length > 0 ? (
            <div className="divide-y divide-ligne">
              {blocs.map((b) => (
                <section key={b.titre} className="grid gap-3 py-8 first:pt-0 sm:grid-cols-[11rem_1fr] sm:gap-8">
                  <h2 className="signal pt-1 text-sm text-(--encre-branche)">{b.titre}</h2>
                  <ContenuRiche texte={b.texte} className="text-lg" />
                </section>
              ))}
            </div>
          ) : (
            <p className="rounded-lg border border-ligne bg-white p-8 text-encre-douce">
              La présentation détaillée de cette branche sera bientôt publiée. La direction du groupe peut d’ici là répondre à vos questions.
            </p>
          )}
          {branche.imageUrl && branche.imageAlt && (
            <figure className="mt-10 overflow-hidden rounded-lg">
              <div className="aspect-[16/9]">
                <ImagePublique src={branche.imageUrl} alt={branche.imageAlt} />
              </div>
            </figure>
          )}
        </div>

        <aside className="space-y-10 lg:col-span-4" aria-label="En pratique">
          <section aria-labelledby="titre-encadrement" className="rounded-lg border border-ligne bg-white p-6">
            <h2 id="titre-encadrement" className="signal text-sm text-encre-pale">
              L’encadrement
            </h2>
            {branche.responsables.length > 0 ? (
              <ul className="mt-4 space-y-4">
                {branche.responsables.map((m) => (
                  <li key={m.id} className="flex items-center gap-3">
                    <Portrait membre={{ ...m, brancheType: branche.type }} className="w-14 text-[0.55rem]" />
                    <div className="min-w-0">
                      <p className="font-semibold text-encre">
                        {m.prenom} {m.nom}
                      </p>
                      <p className="text-sm text-encre-pale">{m.fonction}</p>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-3 text-encre-douce">La présentation de l’équipe d’encadrement sera bientôt publiée.</p>
            )}
            <div className="mt-6">
              <LienSuite href="/notre-equipe">Toute la maîtrise</LienSuite>
            </div>
          </section>
          <section className="rounded-lg bg-primaire p-6 text-white">
            <h2 className="titre-display text-xl font-semibold">Inscrire un jeune dans cette branche</h2>
            <p className="mt-2 text-white/85">La direction confirme la branche selon l’âge de l’enfant.</p>
            <div className="mt-5">
              <LienSuite href="/nous-rejoindre?objet=inscription#formulaire" clair>
                Nous rejoindre
              </LienSuite>
            </div>
          </section>
        </aside>
      </div>

      {branche.activites.length > 0 && (
        <section aria-labelledby="titre-agenda-branche" className="border-t border-ligne bg-papier-fonce/50">
          <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 sm:py-16 lg:px-8">
            <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
              <h2 id="titre-agenda-branche" className="titre-display text-3xl font-semibold text-encre">
                Prochains rendez-vous
              </h2>
              <LienSuite href="/activites">Tout l’agenda</LienSuite>
            </div>
            <ul className="grid gap-x-12 divide-y divide-ligne md:grid-cols-2 md:divide-y-0">
              {branche.activites.map((a) => (
                <li key={a.id} className="py-6">
                  <CarteActivite activite={a} />
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}
    </div>
  )
}
