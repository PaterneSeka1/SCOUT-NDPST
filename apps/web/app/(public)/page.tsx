import type { Metadata } from 'next'
import Link from 'next/link'
import { lirePublic } from '@/lib/api-public'
import { getIdentite } from '@/lib/identite-serveur'
import { nomAffiche, sousTitreAffiche } from '@/lib/identite'
import { ArrowRight, Compass, HeartHandshake, Leaf, Sparkles, Tent, UsersRound } from '@/lib/icons'
import type { Accueil } from '@/components/public/types'
import { Section, TitreSection } from '@/components/public/EnTetePage'
import { CarteActivite, CarteArticle, CarteBranche, CarteMembre, ImagePublique, LienSuite } from '@/components/public/Cartes'
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
    icone: Sparkles,
    titre: 'Grandir dans la foi',
    texte: 'Le scoutisme catholique accompagne chaque jeune dans sa vie spirituelle, au rythme de la prière, des célébrations et de la vie paroissiale.',
  },
  {
    icone: UsersRound,
    titre: 'Apprendre en équipe',
    texte: 'En petites équipes, les jeunes prennent des responsabilités, apprennent à décider ensemble et à compter les uns sur les autres.',
  },
  {
    icone: Tent,
    titre: 'Vivre la nature',
    texte: 'Sorties, camps et jeux de plein air font découvrir la création, développent l’autonomie et le sens de la débrouillardise.',
  },
  {
    icone: HeartHandshake,
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
  const afficherHistoire = !!identite.anneeHistorique || jalons.length > 0

  return (
    <>
      {/* Hero immersif : remplit l'écran sous l'en-tête transparent. */}
      <section className="relative isolate flex min-h-[100svh] items-end overflow-hidden bg-profond text-white">
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
          <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/45 to-black/30" />
          <div className="absolute inset-0 bg-gradient-to-r from-profond/70 via-transparent to-transparent" />
        </div>
        <div className="mx-auto w-full max-w-7xl px-4 pt-32 pb-16 sm:px-6 sm:pb-24 lg:px-8">
          <div className="max-w-3xl animate-apparition">
            {identite.anneeHistorique && (
              <p className="inline-flex items-center gap-2 rounded-full border border-or-300/50 bg-black/20 px-3 py-1 text-xs font-medium tracking-wide text-or-300 backdrop-blur-sm sm:text-sm">
                <Compass className="h-4 w-4" aria-hidden />
                Le scoutisme dans la paroisse depuis {identite.anneeHistorique}
              </p>
            )}
            <h1 className="titre-display mt-5 text-4xl leading-[1.08] font-semibold text-balance sm:text-6xl lg:text-7xl">{titreHero}</h1>
            {sousTitreHero && <p className="mt-5 max-w-2xl text-lg leading-relaxed text-white/90 sm:text-xl">{sousTitreHero}</p>}
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link
                href="/nous-rejoindre"
                className="inline-flex items-center justify-center gap-2 rounded-full bg-accent px-7 py-3.5 font-semibold text-white shadow-flottante transition hover:brightness-110 focus-visible:outline-white"
              >
                Nous rejoindre
                <ArrowRight className="h-4 w-4" aria-hidden />
              </Link>
              <Link
                href="/nos-branches"
                className="inline-flex items-center justify-center rounded-full border border-white/60 bg-white/10 px-7 py-3.5 font-semibold text-white backdrop-blur-sm transition hover:bg-white/20 focus-visible:outline-white"
              >
                Découvrir nos branches
              </Link>
            </div>
          </div>
        </div>
      </section>

      {identite.messageBienvenue && (
        <Section className="text-center">
          <p className="text-xs font-semibold tracking-[0.2em] text-accent uppercase">Bienvenue</p>
          <h2 className="sr-only">Message de bienvenue</h2>
          <blockquote className="titre-display mx-auto mt-5 max-w-3xl text-2xl leading-relaxed text-stone-800 sm:text-3xl">
            {identite.messageBienvenue}
          </blockquote>
          <div className="mx-auto mt-8 h-px w-24 bg-or-500/60" aria-hidden />
        </Section>
      )}

      {afficherHistoire && (
        <section className="relative overflow-hidden bg-profond text-white" aria-labelledby="titre-histoire">
          <div className="mx-auto grid max-w-7xl items-center gap-12 px-4 py-20 sm:px-6 lg:grid-cols-2 lg:px-8 lg:py-28">
            <div>
              <p className="text-xs font-semibold tracking-[0.2em] text-or-300 uppercase">Notre histoire</p>
              {identite.anneeHistorique ? (
                <>
                  <p className="titre-display mt-4 text-[5.5rem] leading-none font-semibold text-or-300 sm:text-[8rem]" aria-hidden>
                    {identite.anneeHistorique}
                  </p>
                  <h2 id="titre-histoire" className="titre-display mt-4 text-3xl font-semibold sm:text-4xl">
                    Le scoutisme dans la paroisse depuis {identite.anneeHistorique}
                  </h2>
                </>
              ) : (
                <h2 id="titre-histoire" className="titre-display mt-4 text-3xl font-semibold sm:text-4xl">
                  Une histoire qui se transmet
                </h2>
              )}
              {identite.rangHistorique && (
                <p className="mt-4 text-lg text-white/85">
                  {identite.rangHistorique}
                  {identite.sourceHistorique && <span className="mt-1 block text-sm text-white/60">Source : {identite.sourceHistorique}</span>}
                </p>
              )}
              <div className="mt-8">
                <Link
                  href="/notre-histoire"
                  className="group inline-flex items-center gap-2 rounded-full bg-white px-6 py-3 font-semibold text-profond transition hover:bg-or-300 focus-visible:outline-white"
                >
                  Parcourir notre histoire
                  <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" aria-hidden />
                </Link>
              </div>
            </div>
            {jalons.length > 0 && (
              <ol className="relative space-y-6 border-l border-or-300/40 pl-8">
                {jalons.map((j, i) => (
                  <li key={`${j.annee}-${i}`} className="relative">
                    <span className="absolute top-1.5 -left-[2.4rem] h-3 w-3 rounded-full bg-or-300 ring-4 ring-profond" aria-hidden />
                    <p className="titre-display text-2xl font-semibold text-or-300">{j.annee}</p>
                    <p className="mt-1 text-white/90">{j.titre}</p>
                    {j.statutValidation === 'A_VERIFIER' && <p className="mt-1 text-xs text-white/60 italic">À confirmer par les archives</p>}
                  </li>
                ))}
              </ol>
            )}
          </div>
        </section>
      )}

      {branches.length > 0 && (
        <Section>
          <div className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
            <TitreSection
              surtitre="Nos branches"
              titre="Un chemin pour chaque âge"
              description="De l’enfance à l’âge adulte, chaque branche propose une aventure adaptée à l’âge et au rythme des jeunes."
            />
            <div className="mb-10 hidden sm:block">
              <LienSuite href="/nos-branches">Toutes les branches</LienSuite>
            </div>
          </div>
          <ul className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {branches.map((b) => (
              <li key={b.slug}>
                <CarteBranche branche={b} />
              </li>
            ))}
          </ul>
        </Section>
      )}

      <section className="bg-sable-50" aria-labelledby="titre-valeurs">
        <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 sm:py-20 lg:px-8">
          <div className="mx-auto mb-12 max-w-2xl text-center">
            <p className="text-xs font-semibold tracking-[0.2em] text-accent uppercase">Valeurs et mission</p>
            <h2 id="titre-valeurs" className="titre-display mt-2 text-3xl font-semibold text-stone-900 sm:text-4xl">
              Le scoutisme catholique
            </h2>
            <p className="mt-3 leading-relaxed text-stone-600">
              Mouvement d’éducation, le scoutisme aide les jeunes à devenir des personnes autonomes, solidaires, responsables et
              engagées, à la lumière de l’Évangile.
            </p>
          </div>
          <ul className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {VALEURS.map(({ icone: Icone, titre, texte }) => (
              <li key={titre} className="rounded-2xl bg-white p-6 shadow-carte ring-1 ring-stone-200/70">
                <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-foret-50 text-primaire">
                  <Icone className="h-6 w-6" strokeWidth={1.75} aria-hidden />
                </span>
                <h3 className="titre-display mt-4 text-lg font-semibold text-stone-900">{titre}</h3>
                <p className="mt-2 text-sm leading-relaxed text-stone-600">{texte}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {actualites.length > 0 && (
        <Section>
          <div className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
            <TitreSection surtitre="Actualités" titre="Les dernières nouvelles" />
            <div className="mb-10">
              <LienSuite href="/actualites">Toutes les actualités</LienSuite>
            </div>
          </div>
          <ul className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {actualites.map((a) => (
              <li key={a.id}>
                <CarteArticle article={a} />
              </li>
            ))}
          </ul>
        </Section>
      )}

      {activites.length > 0 && (
        <section className="bg-creme-fonce/60" aria-labelledby="titre-agenda">
          <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 sm:py-20 lg:px-8">
            <div className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
              <div className="mb-10 max-w-2xl">
                <p className="text-xs font-semibold tracking-[0.2em] text-accent uppercase">Agenda</p>
                <h2 id="titre-agenda" className="titre-display mt-2 text-3xl font-semibold text-stone-900 sm:text-4xl">
                  Prochains rendez-vous
                </h2>
              </div>
              <div className="mb-10">
                <LienSuite href="/activites">Tout l’agenda</LienSuite>
              </div>
            </div>
            <ul className="grid gap-5 lg:grid-cols-2">
              {activites.map((a) => (
                <li key={a.id}>
                  <CarteActivite activite={a} />
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}

      {photos.length > 0 && (
        <Section>
          <div className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
            <TitreSection surtitre="Galerie" titre="Moments partagés" />
            <div className="mb-10">
              <LienSuite href="/galerie">Voir la galerie</LienSuite>
            </div>
          </div>
          <ul className="grid auto-rows-[9rem] grid-cols-2 gap-3 sm:auto-rows-[11rem] sm:gap-4 md:grid-cols-4">
            {photos.map((p, i) => (
              <li key={p.id} className={i === 0 ? 'col-span-2 row-span-2' : ''}>
                <Link
                  href={p.album ? `/galerie/${p.album.slug}` : '/galerie'}
                  className="group block h-full overflow-hidden rounded-xl bg-sable-100 shadow-carte"
                >
                  <ImagePublique
                    src={p.url}
                    alt={p.texteAlt || p.legende || (p.album ? `Photo de l’album « ${p.album.titre} »` : 'Photo de la galerie')}
                    className="transition duration-500 group-hover:scale-[1.04]"
                  />
                </Link>
              </li>
            ))}
          </ul>
        </Section>
      )}

      {equipe.length > 0 && (
        <section className="bg-sable-50" aria-labelledby="titre-maitrise">
          <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 sm:py-20 lg:px-8">
            <div className="mx-auto mb-12 max-w-2xl text-center">
              <p className="text-xs font-semibold tracking-[0.2em] text-accent uppercase">La maîtrise</p>
              <h2 id="titre-maitrise" className="titre-display mt-2 text-3xl font-semibold text-stone-900 sm:text-4xl">
                Ceux qui accompagnent les jeunes
              </h2>
            </div>
            <ul className="flex flex-wrap justify-center gap-6">
              {equipe.map((m) => (
                <li key={m.id} className="w-full sm:w-[calc(50%-0.75rem)] lg:w-[calc(25%-1.125rem)]">
                  <CarteMembre membre={m} avecBiographie={false} />
                </li>
              ))}
            </ul>
            <div className="mt-10 text-center">
              <LienSuite href="/notre-equipe">Découvrir toute l’équipe</LienSuite>
            </div>
          </div>
        </section>
      )}

      <Section>
        <div className="relative isolate overflow-hidden rounded-3xl bg-primaire px-6 py-14 text-center text-white sm:px-12 sm:py-20">
          <div className="motif-cercles absolute inset-0 -z-10 opacity-40" aria-hidden />
          <Leaf className="mx-auto h-10 w-10 text-or-300" strokeWidth={1.5} aria-hidden />
          <h2 className="titre-display mx-auto mt-4 max-w-2xl text-3xl font-semibold sm:text-4xl">Envie de vivre l’aventure avec nous ?</h2>
          <p className="mx-auto mt-4 max-w-xl leading-relaxed text-white/90">
            {identite.inscriptionsOuvertes
              ? 'Inscription d’un jeune, engagement comme adulte ou simple question : faites-nous signe, la direction du groupe vous répondra.'
              : 'Les inscriptions ne sont pas ouvertes actuellement, mais vous pouvez nous écrire pour être informé de leur réouverture.'}
          </p>
          <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
            <Link
              href="/nous-rejoindre"
              className="inline-flex items-center justify-center gap-2 rounded-full bg-white px-7 py-3.5 font-semibold text-stone-900 transition hover:bg-or-300 focus-visible:outline-white"
            >
              Nous rejoindre
              <ArrowRight className="h-4 w-4" aria-hidden />
            </Link>
            <Link
              href="/contact"
              className="inline-flex items-center justify-center rounded-full border border-white/60 px-7 py-3.5 font-semibold text-white transition hover:bg-white/10 focus-visible:outline-white"
            >
              Nous contacter
            </Link>
          </div>
        </div>
      </Section>
    </>
  )
}
