import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { lirePublic } from '@/lib/api-public'
import { BookOpen, Compass, Leaf, Lightbulb, Target } from '@/lib/icons'
import type { LucideIcon } from '@/lib/icons'
import { ContenuRiche } from '@/components/contenu/ContenuRiche'
import { Section } from '@/components/public/EnTetePage'
import { CarteActivite, CarteMembre, ImagePublique, LienRetour, LienSuite, VisuelVide } from '@/components/public/Cartes'
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
    description: extrait(
      branche.presentation || `La branche ${branche.nom}${branche.trancheAge ? ` (${branche.trancheAge})` : ''} du groupe scout.`,
    ),
    alternates: { canonical: `/nos-branches/${branche.slug}` },
    openGraph: branche.imageUrl ? { images: [{ url: branche.imageUrl, alt: branche.imageAlt ?? '' }] } : undefined,
  }
}

function Bloc({ icone: Icone, titre, texte }: { icone: LucideIcon; titre: string; texte: string | null }) {
  if (!texte?.trim()) return null
  return (
    <section className="rounded-2xl bg-white p-6 shadow-carte ring-1 ring-stone-200/70 sm:p-8">
      <h2 className="titre-display flex items-center gap-3 text-2xl font-semibold text-stone-900">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-foret-50 text-primaire">
          <Icone className="h-5 w-5" aria-hidden />
        </span>
        {titre}
      </h2>
      <ContenuRiche texte={texte} className="mt-4" />
    </section>
  )
}

export default async function PageBranche({ params }: Props) {
  const { slug } = await params
  const branche = await lireBranche(slug)
  if (!branche) notFound()

  const blocs = [
    { icone: Compass, titre: 'Identité', texte: branche.identite },
    { icone: Target, titre: 'Objectifs', texte: branche.objectifs },
    { icone: Lightbulb, titre: 'Pédagogie', texte: branche.pedagogie },
    { icone: BookOpen, titre: 'Activités types', texte: branche.activitesTypes },
  ]
  const contenuDisponible = !!branche.presentation || blocs.some((b) => b.texte?.trim())

  return (
    <>
      <section className="relative isolate overflow-hidden bg-profond pt-28 pb-14 text-white sm:pt-36 sm:pb-20">
        <div className="absolute inset-0 -z-10 opacity-35">
          {branche.imageUrl ? <ImagePublique src={branche.imageUrl} alt="" prioritaire /> : <VisuelVide icone={Leaf} className="bg-profond" />}
        </div>
        <div className="absolute inset-0 -z-10 bg-gradient-to-t from-profond via-profond/70 to-profond/30" aria-hidden />
        <div className="mx-auto max-w-5xl px-4 sm:px-6">
          <LienRetour href="/nos-branches" clair>
            Toutes les branches
          </LienRetour>
          <p className="mt-6 text-xs font-semibold tracking-[0.2em] text-or-300 uppercase">Branche</p>
          <h1 className="titre-display mt-2 text-4xl font-semibold sm:text-6xl">{branche.nom}</h1>
          {branche.trancheAge && (
            <p className="mt-4 inline-flex rounded-full bg-white/15 px-4 py-1.5 text-sm font-medium backdrop-blur-sm">
              <span className="sr-only">Tranche d’âge : </span>
              {branche.trancheAge}
            </p>
          )}
        </div>
      </section>

      <Section className="max-w-5xl">
        {branche.imageUrl && (
          <div className="mb-12 aspect-[16/9] overflow-hidden rounded-3xl bg-sable-100 shadow-flottante">
            <ImagePublique src={branche.imageUrl} alt={branche.imageAlt ?? ''} />
          </div>
        )}
        {contenuDisponible ? (
          <div className="space-y-8">
            {branche.presentation && <p className="titre-display text-xl leading-relaxed text-stone-800 sm:text-2xl">{branche.presentation}</p>}
            {blocs.map((b) => (
              <Bloc key={b.titre} {...b} />
            ))}
          </div>
        ) : (
          <p className="rounded-2xl bg-sable-50 p-8 text-center text-stone-600">La présentation de cette branche sera bientôt publiée.</p>
        )}
      </Section>

      {branche.responsables.length > 0 && (
        <section className="bg-sable-50" aria-labelledby="titre-responsables">
          <div className="mx-auto max-w-5xl px-4 py-16 sm:px-6">
            <h2 id="titre-responsables" className="titre-display mb-8 text-3xl font-semibold text-stone-900">
              Les responsables
            </h2>
            <ul className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {branche.responsables.map((m) => (
                <li key={m.id}>
                  <CarteMembre membre={m} />
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}

      {branche.activites.length > 0 && (
        <Section className="max-w-5xl">
          <h2 className="titre-display mb-8 text-3xl font-semibold text-stone-900">Prochains rendez-vous</h2>
          <ul className="grid gap-5 md:grid-cols-2">
            {branche.activites.map((a) => (
              <li key={a.id}>
                <CarteActivite activite={a} />
              </li>
            ))}
          </ul>
          <div className="mt-8">
            <LienSuite href="/activites">Tout l’agenda</LienSuite>
          </div>
        </Section>
      )}
    </>
  )
}
