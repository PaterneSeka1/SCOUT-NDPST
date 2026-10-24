import type { Metadata } from 'next'
import Link from 'next/link'
import { lirePublic } from '@/lib/api-public'
import { styleAccent } from '@/lib/branches-visuel'
import { ArrowRight } from '@/lib/icons'
import { EnTetePage } from '@/components/public/EnTetePage'
import { ImagePublique } from '@/components/public/Cartes'
import { EtatVidePublic } from '@/components/public/EtatVidePublic'
import { ParcoursBranches } from '@/components/public/ParcoursBranches'
import type { BranchePublique } from '@/components/public/types'

export const metadata: Metadata = {
  title: 'Nos branches',
  description: 'Les branches du groupe scout, de l’enfance à l’âge adulte : tranches d’âge, pédagogie et activités.',
  alternates: { canonical: '/nos-branches' },
}

export default async function PageBranches() {
  const branches = await lirePublic<BranchePublique[]>('/branches')
  const liste = branches ?? []

  return (
    <>
      <EnTetePage
        surtitre="Nos branches"
        titre="Un chemin pour chaque âge"
        description="Chaque branche propose une pédagogie adaptée à l’âge des jeunes, pour grandir pas à pas, en équipe et au service des autres."
      >
        {liste.length > 0 && (
          <div className="mt-10">
            <h2 className="sr-only">Le parcours en un coup d’œil</h2>
            <ParcoursBranches branches={liste} />
          </div>
        )}
      </EnTetePage>

      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 sm:py-16 lg:px-8">
        {liste.length === 0 ? (
          <EtatVidePublic
            titre={branches === null ? 'Les branches sont momentanément indisponibles.' : 'La présentation des branches sera bientôt publiée.'}
            texte="En attendant, la direction du groupe peut vous orienter vers la branche adaptée à l’âge de votre enfant."
            liens={[{ libelle: 'Nous contacter', href: '/nous-rejoindre?objet=information#formulaire' }]}
          />
        ) : (
          <ol className="space-y-14 sm:space-y-20">
            {liste.map((b, i) => (
              <li
                key={b.slug}
                style={styleAccent(b.type)}
                className={b.imageUrl ? 'grid items-center gap-8 lg:grid-cols-12 lg:gap-14' : 'grid gap-6 border-t-4 border-(--accent-branche) pt-8 sm:grid-cols-[10rem_1fr] sm:gap-10'}
              >
                {b.imageUrl ? (
                  <div className={`overflow-hidden rounded-lg lg:col-span-6 ${i % 2 === 1 ? 'lg:order-2' : ''}`}>
                    <div className="aspect-[3/2]">
                      <ImagePublique src={b.imageUrl} alt={b.imageAlt ?? ''} />
                    </div>
                  </div>
                ) : (
                  // Sans photo publiée : repère d'âge en grand plutôt qu'un aplat vide.
                  <p className="chiffre-signal text-4xl leading-none text-(--encre-branche) sm:text-5xl" aria-hidden>
                    {b.trancheAge ? b.trancheAge.replace(' ans et +', '+').replace(' ans', '').replace('-', '–') : `0${i + 1}`}
                    {b.trancheAge && <span className="signal mt-1 block text-sm text-encre-pale">ans</span>}
                  </p>
                )}
                <article className={b.imageUrl ? 'lg:col-span-6' : ''}>
                  <p className="signal flex items-center gap-3 text-sm text-encre-pale">
                    {b.imageUrl && <span className="h-1 w-10 rounded-full bg-(--accent-branche)" aria-hidden />}
                    Étape {i + 1}
                    {b.trancheAge && b.imageUrl && (
                      <>
                        <span aria-hidden>·</span>
                        <span className="text-(--encre-branche)">{b.trancheAge}</span>
                      </>
                    )}
                  </p>
                  <h2 className="titre-display mt-3 text-4xl font-semibold text-encre sm:text-5xl">{b.nom}</h2>
                  <p className="mt-4 max-w-2xl text-lg leading-relaxed text-encre-douce">
                    {b.presentation ?? 'La présentation détaillée de cette branche sera bientôt publiée.'}
                  </p>
                  <Link
                    href={`/nos-branches/${b.slug}`}
                    className="group mt-6 inline-flex items-center gap-2 rounded-full border-2 border-(--accent-branche) px-5 py-2.5 font-semibold text-encre transition hover:border-(--encre-branche) hover:bg-(--encre-branche) hover:text-white"
                  >
                    Découvrir les {b.nom}
                    <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" aria-hidden />
                  </Link>
                </article>
              </li>
            ))}
          </ol>
        )}
      </div>
    </>
  )
}
