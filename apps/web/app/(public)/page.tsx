import type { Metadata } from 'next'
import Link from 'next/link'
import { lirePublic } from '@/lib/api-public'
import { getIdentite } from '@/lib/identite-serveur'
import { nomAffiche, sousTitreAffiche } from '@/lib/identite'
import { dateLongue } from '@/lib/format'
import { ArrowRight, Newspaper } from '@/lib/icons'
import type { Accueil } from '@/components/public/types'
import { EnTeteSection, TitreSection } from '@/components/public/EnTetePage'
import { CarteActivite, ImagePublique, LienSuite, Portrait, VisuelVide } from '@/components/public/Cartes'
import { ParcoursBranches } from '@/components/public/ParcoursBranches'
import { PARCOURS_REJOINDRE } from '@/components/public/parcours'
import { extrait } from '@/components/public/outils'

export async function generateMetadata(): Promise<Metadata> {
  const identite = await getIdentite()
  const nom = nomAffiche(identite)
  const description = extrait(
    identite.messageBienvenue ||
      identite.presentation ||
      `Le groupe scout de ${identite.nomParoisse || 'la paroisse'} : histoire, branches, actualités, activités et inscriptions.`,
  )
  return { title: { absolute: nom }, description, alternates: { canonical: '/' } }
}

// Repères généraux de la pédagogie scoute catholique (non propres au groupe).
const VALEURS = [
  {
    titre: 'Grandir dans la foi',
    texte: 'Le scoutisme catholique accompagne chaque jeune dans sa vie spirituelle, au rythme de la prière, des célébrations et de la vie paroissiale.',
  },
  {
    titre: 'Apprendre en équipe',
    texte: 'En petites équipes, les jeunes prennent des responsabilités, apprennent à décider ensemble et à compter les uns sur les autres.',
  },
  {
    titre: 'Vivre la nature',
    texte: 'Sorties, camps et jeux de plein air font découvrir la création, développent l’autonomie et le sens de la débrouillardise.',
  },
  {
    titre: 'Servir les autres',
    texte: 'Fidèle à la promesse et à la loi scoute, chacun apprend à se rendre utile et à s’engager au service de sa communauté.',
  },
]

export default async function PageAccueil() {
  const [identite, accueil] = await Promise.all([getIdentite(), lirePublic<Accueil>('/accueil')])
  const nom = nomAffiche(identite)
  const titreHero = identite.accueil.titre || nom
  const sousTitreHero = identite.accueil.sousTitre || sousTitreAffiche(identite)
  const imageConfiguree = identite.accueil.imageUrl

  const branches = accueil?.branches ?? []
  const actualites = accueil?.actualites ?? []
  const activites = accueil?.activites ?? []
  const photos = accueil?.photos ?? []
  const equipe = accueil?.equipe ?? []
  const jalons = accueil?.histoire ?? []
  const texteGroupe = identite.messageBienvenue || identite.presentation
  const afficherGroupe = !!texteGroupe || !!identite.anneeHistorique || jalons.length > 0
  const parcours = PARCOURS_REJOINDRE.filter((p) => identite.inscriptionsOuvertes || !p.soumisAuxInscriptions)

  return (
    <>
      {/* Ouverture : photo plein cadre sous l'en-tête transparent. */}
      <section className="relative isolate -mt-(--hauteur-entete) flex min-h-[min(92svh,52rem)] items-end overflow-hidden bg-profond text-white">
        <div className="absolute inset-0 -z-10">
          <ImagePublique
            src={imageConfiguree || '/scout-ascci-hero.png'}
            alt={
              imageConfiguree
                ? (identite.accueil.imageAlt ?? '')
                : 'Illustration : jeunes scouts en uniforme en plein air (image d’illustration, pas une photo du groupe)'
            }
            prioritaire
            className="object-[center_35%]"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/40 to-black/35" />
          <div className="absolute inset-0 bg-gradient-to-r from-profond/80 via-profond/20 to-transparent" />
        </div>
        <div className="mx-auto w-full max-w-7xl px-4 pt-[calc(var(--hauteur-entete)+4rem)] pb-12 sm:px-6 sm:pb-16 lg:px-8">
          <div className="max-w-3xl animate-apparition">
            {identite.anneeHistorique && (
              <p className="signal inline-flex items-center gap-3 text-sm text-or-300">
                <span className="h-px w-10 bg-or-300" aria-hidden />
                Le scoutisme dans la paroisse depuis {identite.anneeHistorique}
              </p>
            )}
            <h1 className="titre-display mt-5 text-[2.6rem] leading-[1.04] font-semibold text-balance sm:text-6xl lg:text-7xl">{titreHero}</h1>
            {sousTitreHero && <p className="mt-5 max-w-2xl text-lg leading-relaxed text-white/90 sm:text-xl">{sousTitreHero}</p>}
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link
                href="/nous-rejoindre"
                className="inline-flex items-center justify-center gap-2 rounded-full bg-accent px-7 py-3.5 font-semibold text-white transition hover:bg-terracotta-600 focus-visible:outline-white"
              >
                Nous rejoindre
                <ArrowRight className="h-4 w-4" aria-hidden />
              </Link>
              <Link
                href="/nos-branches"
                className="inline-flex items-center justify-center rounded-full border border-white/60 px-7 py-3.5 font-semibold text-white transition hover:bg-white/10 focus-visible:outline-white"
              >
                Découvrir nos branches
              </Link>
            </div>
          </div>
          {/* Repères réels (configuration et données publiées), jamais des chiffres inventés. */}
          {(identite.anneeHistorique || branches.length > 0) && (
            <dl className="mt-14 flex flex-wrap gap-x-12 gap-y-5 border-t border-white/20 pt-6">
              {identite.anneeHistorique && (
                <div>
                  <dt className="signal text-xs text-white/65">Fondation</dt>
                  <dd className="chiffre-signal text-3xl">{identite.anneeHistorique}</dd>
                </div>
              )}
              {branches.length > 0 && (
                <div>
                  <dt className="signal text-xs text-white/65">Branches</dt>
                  <dd className="chiffre-signal text-3xl">{branches.length}</dd>
                </div>
              )}
            </dl>
          )}
        </div>
      </section>

      {/* Le groupe : message, héritage et premiers jalons. */}
      {afficherGroupe && (
        <section aria-labelledby="titre-groupe" className="mx-auto grid max-w-7xl gap-12 px-4 py-16 sm:px-6 sm:py-24 lg:grid-cols-12 lg:px-8">
          <div className="lg:col-span-7">
            <p className="signal text-sm text-accent">Le groupe</p>
            <h2 id="titre-groupe" className="titre-display mt-2 text-3xl leading-tight font-semibold text-balance text-encre sm:text-4xl">
              {identite.anneeHistorique
                ? `Une aventure transmise de génération en génération depuis ${identite.anneeHistorique}`
                : 'Une aventure qui se transmet de génération en génération'}
            </h2>
            {texteGroupe && <p className="titre-display mt-6 text-xl leading-relaxed text-encre-douce sm:text-2xl">{texteGroupe}</p>}
            <div className="mt-8 flex flex-wrap gap-x-8 gap-y-3">
              <LienSuite href="/notre-histoire">Parcourir notre histoire</LienSuite>
              <LienSuite href="/notre-equipe">Rencontrer la maîtrise</LienSuite>
            </div>
          </div>
          {(identite.anneeHistorique || jalons.length > 0) && (
            <aside className="relative isolate overflow-hidden rounded-lg bg-profond p-8 text-white lg:col-span-5">
              <div className="motif-topo-clair absolute inset-0 -z-10 opacity-[0.08]" aria-hidden />
              {identite.anneeHistorique && (
                <p className="chiffre-signal text-[5.5rem] leading-none text-or-300" aria-hidden>
                  {identite.anneeHistorique}
                </p>
              )}
              {identite.rangHistorique && <p className="mt-3 text-white/85">{identite.rangHistorique}</p>}
              {jalons.length > 0 && (
                <ol className="mt-8 space-y-4 border-l border-or-300/40 pl-5">
                  {jalons.map((j, i) => (
                    <li key={`${j.annee}-${i}`} className="relative">
                      <span className="absolute top-2 -left-[1.6rem] h-2.5 w-2.5 rounded-full bg-or-300" aria-hidden />
                      <p className="chiffre-signal text-xl text-or-300">{j.annee}</p>
                      <p className="text-white/90">{j.titre}</p>
                      {j.statutValidation === 'A_VERIFIER' && <p className="text-xs text-white/60 italic">À confirmer par les archives</p>}
                    </li>
                  ))}
                </ol>
              )}
            </aside>
          )}
        </section>
      )}

      {/* Branches : un parcours par âge. */}
      {branches.length > 0 && (
        <section aria-labelledby="titre-branches" className="border-y border-ligne bg-papier-fonce/60">
          <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 sm:py-20 lg:px-8">
            <EnTeteSection lien={<LienSuite href="/nos-branches">Toutes les branches</LienSuite>}>
              <TitreSection
                id="titre-branches"
                surtitre="Nos branches"
                titre="Un chemin pour chaque âge"
                description="De l’enfance à l’âge adulte, chaque branche propose une aventure adaptée à l’âge et au rythme des jeunes."
              />
            </EnTeteSection>
            <ParcoursBranches branches={branches} />
          </div>
        </section>
      )}

      {/* Agenda et actualités côte à côte : la vie du groupe en un coup d'œil. */}
      {(activites.length > 0 || actualites.length > 0) && (
        <section aria-label="Vie du groupe" className="mx-auto grid max-w-7xl gap-14 px-4 py-16 sm:px-6 sm:py-24 lg:grid-cols-12 lg:px-8">
          {activites.length > 0 && (
            <div className={actualites.length > 0 ? 'lg:col-span-7' : 'lg:col-span-12'}>
              <EnTeteSection lien={<LienSuite href="/activites">Tout l’agenda</LienSuite>}>
                <TitreSection surtitre="Agenda" titre="Prochains rendez-vous" />
              </EnTeteSection>
              <ul className="divide-y divide-ligne border-y border-ligne">
                {activites.map((a) => (
                  <li key={a.id} className="py-6">
                    <CarteActivite activite={a} />
                  </li>
                ))}
              </ul>
            </div>
          )}
          {actualites.length > 0 && (
            <div className={activites.length > 0 ? 'lg:col-span-5' : 'lg:col-span-12'}>
              <EnTeteSection lien={<LienSuite href="/actualites">Toutes les actualités</LienSuite>}>
                <TitreSection surtitre="Actualités" titre="Dernières nouvelles" />
              </EnTeteSection>
              <ul className="space-y-6">
                {actualites.map((a) => (
                  <li key={a.id}>
                    <article className="group relative grid grid-cols-[6.5rem_1fr] gap-4 sm:grid-cols-[8rem_1fr]">
                      <div className="aspect-square overflow-hidden rounded-md bg-papier-fonce">
                        {a.imageCouverture ? <ImagePublique src={a.imageCouverture} alt={a.imageAlt ?? ''} /> : <VisuelVide icone={Newspaper} />}
                      </div>
                      <div>
                        <p className="text-sm text-encre-pale">
                          {a.categorie && <span className="signal mr-2 text-xs text-accent">{a.categorie.nom}</span>}
                          <time dateTime={a.datePublication}>{dateLongue(a.datePublication)}</time>
                        </p>
                        <h3 className="titre-display mt-1 text-lg leading-snug font-semibold text-encre">
                          <Link
                            href={`/actualites/${a.slug}`}
                            className="decoration-accent decoration-2 underline-offset-4 group-hover:underline after:absolute after:inset-0"
                          >
                            {a.titre}
                          </Link>
                        </h3>
                        {a.resume && <p className="mt-1 line-clamp-2 text-[0.95rem] text-encre-douce">{a.resume}</p>}
                      </div>
                    </article>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>
      )}

      {/* Valeurs : liste éditoriale numérotée plutôt que quatre cartes identiques. */}
      <section aria-labelledby="titre-valeurs" className="relative isolate overflow-hidden bg-profond text-white">
        <div className="motif-topo-clair absolute inset-0 -z-10 opacity-[0.06]" aria-hidden />
        <div className="mx-auto grid max-w-7xl gap-12 px-4 py-16 sm:px-6 sm:py-24 lg:grid-cols-12 lg:px-8">
          <div className="lg:col-span-4">
            <TitreSection
              id="titre-valeurs"
              clair
              surtitre="Valeurs et mission"
              titre="Le scoutisme catholique"
              description="Mouvement d’éducation, le scoutisme aide les jeunes à devenir des personnes autonomes, solidaires, responsables et engagées, à la lumière de l’Évangile."
            />
          </div>
          <ol className="grid gap-x-10 gap-y-10 sm:grid-cols-2 lg:col-span-8">
            {VALEURS.map(({ titre, texte }, i) => (
              <li key={titre} className="border-t border-white/20 pt-5">
                <p className="chiffre-signal text-2xl text-or-300" aria-hidden>
                  {String(i + 1).padStart(2, '0')}
                </p>
                <h3 className="titre-display mt-2 text-xl font-semibold">{titre}</h3>
                <p className="mt-2 leading-relaxed text-white/80">{texte}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {photos.length > 0 && (
        <section aria-labelledby="titre-photos" className="mx-auto max-w-7xl px-4 py-16 sm:px-6 sm:py-24 lg:px-8">
          <EnTeteSection lien={<LienSuite href="/galerie">Voir la galerie</LienSuite>}>
            <TitreSection id="titre-photos" surtitre="Galerie" titre="Moments partagés" />
          </EnTeteSection>
          <ul className="grid auto-rows-[9rem] grid-cols-2 gap-2 sm:auto-rows-[12rem] sm:gap-3 md:grid-cols-4">
            {photos.map((p, i) => (
              <li key={p.id} className={i === 0 ? 'col-span-2 row-span-2' : ''}>
                <Link href={p.album ? `/galerie/${p.album.slug}` : '/galerie'} className="group block h-full overflow-hidden rounded-md bg-papier-fonce">
                  <ImagePublique
                    src={p.url}
                    alt={p.texteAlt || p.legende || (p.album ? `Photo de l’album « ${p.album.titre} »` : 'Photo de la galerie')}
                    className="transition duration-700 group-hover:scale-[1.04]"
                  />
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {equipe.length > 0 && (
        <section aria-labelledby="titre-maitrise" className="border-t border-ligne">
          <div className="mx-auto grid max-w-7xl gap-10 px-4 py-16 sm:px-6 sm:py-20 lg:grid-cols-12 lg:items-center lg:px-8">
            <div className="lg:col-span-5">
              <TitreSection
                id="titre-maitrise"
                surtitre="La maîtrise"
                titre="Ceux qui accompagnent les jeunes"
                description="Chefs, cheftaines et responsables bénévoles, formés pour encadrer chaque branche."
              />
              <div className="mt-6">
                <LienSuite href="/notre-equipe">Découvrir toute la maîtrise</LienSuite>
              </div>
            </div>
            <ul className="flex flex-wrap gap-6 lg:col-span-7 lg:justify-end">
              {equipe.map((m) => (
                <li key={`${m.id}-${m.fonction}-${m.brancheType}`} className="w-32 text-center sm:w-36">
                  <Portrait membre={m} className="mx-auto w-28 text-base sm:w-32" />
                  <p className="mt-3 font-semibold leading-snug text-encre">
                    {m.prenom} {m.nom}
                  </p>
                  <p className="text-sm text-encre-pale">{m.fonction}</p>
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}

      {/* Rejoindre : les parcours sont visibles directement. */}
      <section aria-labelledby="titre-rejoindre" className="bg-primaire text-white">
        <div className="mx-auto grid max-w-7xl gap-10 px-4 py-16 sm:px-6 sm:py-20 lg:grid-cols-12 lg:px-8">
          <div className="lg:col-span-5">
            <p className="signal text-sm text-or-300">Nous rejoindre</p>
            <h2 id="titre-rejoindre" className="titre-display mt-2 text-3xl leading-tight font-semibold text-balance sm:text-4xl">
              Envie de vivre l’aventure avec nous ?
            </h2>
            <p className="mt-4 max-w-md leading-relaxed text-white/85">
              {identite.inscriptionsOuvertes
                ? 'La direction du groupe répond à chaque demande, par téléphone ou par e-mail.'
                : 'Les inscriptions sont fermées pour le moment ; écrivez-nous pour être informé de leur réouverture.'}
            </p>
          </div>
          <ul className="grid gap-px overflow-hidden rounded-lg bg-white/15 sm:grid-cols-2 lg:col-span-7">
            {parcours.map((p) => (
              <li key={p.objet}>
                <Link
                  href={`/nous-rejoindre?objet=${p.objet}#formulaire`}
                  className="group flex h-full flex-col bg-primaire p-6 transition hover:bg-white/10 focus-visible:outline-white"
                >
                  <span className="flex items-center justify-between gap-3 text-lg font-semibold">
                    {p.titre}
                    <ArrowRight className="h-5 w-5 shrink-0 transition group-hover:translate-x-1" aria-hidden />
                  </span>
                  <span className="mt-1.5 text-[0.95rem] leading-relaxed text-white/80">{p.texte}</span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </section>
    </>
  )
}
