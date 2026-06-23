import Image from 'next/image'
import Link from 'next/link'

const modules = [
  {
    title: 'Effectifs',
    text: 'Centralisez les fiches scouts, les contacts parents, les branches et les informations utiles de chaque jeune.',
    accent: 'bg-[#1a4731]',
  },
  {
    title: 'Activités',
    text: 'Préparez les réunions, sorties, camps et services avec une vision claire des dates, lieux et participants.',
    accent: 'bg-[#c2410c]',
  },
  {
    title: 'Présences',
    text: 'Suivez les présences par activité pour garder un historique fiable au niveau de la paroisse.',
    accent: 'bg-[#2563eb]',
  },
  {
    title: 'Progression',
    text: 'Accompagnez les badges, étapes pédagogiques et validations selon les responsabilités de chaque équipe.',
    accent: 'bg-[#b45309]',
  },
]

const audiences = [
  'Administrateurs paroissiaux',
  'Chefs de groupe',
  'Responsables de branche',
  'Parents et scouts',
]

const steps = [
  'Créer les comptes et rattacher les jeunes à leur paroisse.',
  'Organiser les activités et enregistrer les présences.',
  'Suivre les progressions et garder les informations à jour.',
]

export default function Home() {
  return (
    <main className="min-h-screen bg-[#f7faf7] text-[#15241b]">
      <section className="relative min-h-[82svh] overflow-hidden bg-[#102419] text-white">
        <Image
          src="/scout-ascci-hero.png"
          alt="Responsables et scouts réunis dans une cour de paroisse"
          fill
          priority
          sizes="100vw"
          className="object-cover object-center"
        />
        <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(9,32,22,0.92)_0%,rgba(9,32,22,0.78)_34%,rgba(9,32,22,0.2)_68%,rgba(9,32,22,0.02)_100%)]" />

        <div className="relative z-10 mx-auto flex min-h-[82svh] w-full max-w-7xl flex-col px-5 py-5 sm:px-8 lg:px-10">
          <header className="flex items-center justify-between gap-4">
            <Link href="/" className="flex items-center gap-3" aria-label="SCOUT ASCCI">
              <span className="flex h-11 w-11 items-center justify-center rounded-lg border border-white/25 bg-white/12 text-sm font-bold backdrop-blur">
                SA
              </span>
              <span>
                <span className="block text-sm font-bold tracking-[0.18em]">
                  SCOUT ASCCI
                </span>
                <span className="block text-xs text-white/72">
                  Côte d&apos;Ivoire
                </span>
              </span>
            </Link>

            <nav className="hidden items-center gap-7 text-sm font-medium text-white/78 md:flex">
              <a href="#modules" className="transition hover:text-white">
                Modules
              </a>
              <a href="#parcours" className="transition hover:text-white">
                Parcours
              </a>
              <a href="#roles" className="transition hover:text-white">
                Accès
              </a>
            </nav>

            <Link
              href="/login"
              className="rounded-lg bg-white px-4 py-2 text-sm font-semibold text-[#123421] transition hover:bg-[#edf7ef]"
            >
              Connexion
            </Link>
          </header>

          <div className="flex flex-1 items-center py-12 sm:py-16">
            <div className="max-w-2xl">
              <p className="mb-5 inline-flex rounded-lg border border-white/20 bg-white/10 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.22em] text-[#f7cf77] backdrop-blur">
                Suivi pédagogique paroissial
              </p>
              <h1 className="text-5xl font-black leading-[0.95] tracking-normal text-white sm:text-6xl lg:text-7xl">
                SCOUT ASCCI
              </h1>
              <p className="mt-6 max-w-xl text-lg leading-8 text-white/84 sm:text-xl">
                Une application claire pour gérer les scouts catholiques de Côte
                d&apos;Ivoire, suivre les activités, les présences et la
                progression pédagogique depuis un même espace.
              </p>
              <div className="mt-9 flex flex-col gap-3 sm:flex-row">
                <Link
                  href="/login"
                  className="rounded-lg bg-[#f7cf77] px-6 py-3 text-center text-sm font-bold text-[#15241b] transition hover:bg-[#ffe19a]"
                >
                  Accéder à mon espace
                </Link>
                <a
                  href="#modules"
                  className="rounded-lg border border-white/32 px-6 py-3 text-center text-sm font-bold text-white transition hover:bg-white/12"
                >
                  Découvrir les modules
                </a>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="border-b border-[#d9e5dc] bg-white">
        <div className="mx-auto grid max-w-7xl grid-cols-2 gap-px px-5 py-8 sm:px-8 lg:grid-cols-4 lg:px-10">
          {[
            ['5', 'Branches suivies'],
            ['4', 'Profils principaux'],
            ['1', 'Base paroissiale'],
            ['100%', 'Historique centralisé'],
          ].map(([value, label]) => (
            <div key={label} className="py-3">
              <p className="text-3xl font-black text-[#1a4731]">{value}</p>
              <p className="mt-1 text-sm font-medium text-[#607064]">{label}</p>
            </div>
          ))}
        </div>
      </section>

      <section id="modules" className="mx-auto max-w-7xl px-5 py-18 sm:px-8 lg:px-10">
        <div className="grid gap-10 lg:grid-cols-[0.85fr_1.15fr] lg:items-end">
          <div>
            <p className="text-sm font-bold uppercase tracking-[0.18em] text-[#c2410c]">
              Modules essentiels
            </p>
            <h2 className="mt-3 max-w-xl text-3xl font-black leading-tight text-[#15241b] sm:text-4xl">
              Une organisation plus lisible pour chaque groupe scout.
            </h2>
          </div>
          <p className="max-w-2xl text-base leading-8 text-[#5d6d62]">
            La landing mène directement vers l&apos;application, mais pose aussi
            clairement ce que SCOUT ASCCI apporte aux équipes : moins de carnets
            dispersés, plus de visibilité et des informations mieux tenues.
          </p>
        </div>

        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {modules.map((module) => (
            <article
              key={module.title}
              className="rounded-lg border border-[#dbe6df] bg-white p-5 shadow-sm"
            >
              <span className={`mb-5 block h-1.5 w-12 rounded-sm ${module.accent}`} />
              <h3 className="text-lg font-bold text-[#15241b]">{module.title}</h3>
              <p className="mt-3 text-sm leading-7 text-[#657368]">{module.text}</p>
            </article>
          ))}
        </div>
      </section>

      <section id="parcours" className="bg-[#173625] text-white">
        <div className="mx-auto grid max-w-7xl gap-10 px-5 py-18 sm:px-8 lg:grid-cols-[1fr_1fr] lg:px-10">
          <div>
            <p className="text-sm font-bold uppercase tracking-[0.18em] text-[#f7cf77]">
              Parcours terrain
            </p>
            <h2 className="mt-3 text-3xl font-black leading-tight sm:text-4xl">
              De l&apos;inscription au suivi pédagogique, sans perdre le fil.
            </h2>
          </div>

          <div className="space-y-4">
            {steps.map((step, index) => (
              <div key={step} className="grid grid-cols-[3rem_1fr] gap-4">
                <span className="flex h-12 w-12 items-center justify-center rounded-lg bg-white text-sm font-black text-[#173625]">
                  {String(index + 1).padStart(2, '0')}
                </span>
                <p className="border-b border-white/16 pb-5 text-base leading-7 text-white/84">
                  {step}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="roles" className="mx-auto max-w-7xl px-5 py-18 sm:px-8 lg:px-10">
        <div className="grid gap-10 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
          <div>
            <p className="text-sm font-bold uppercase tracking-[0.18em] text-[#2563eb]">
              Accès par responsabilité
            </p>
            <h2 className="mt-3 text-3xl font-black leading-tight text-[#15241b] sm:text-4xl">
              Chaque utilisateur retrouve les informations qui comptent pour son rôle.
            </h2>
            <p className="mt-5 text-base leading-8 text-[#5d6d62]">
              L&apos;application est pensée pour les réalités d&apos;une paroisse :
              administrer, encadrer, accompagner et garder le lien avec les familles.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            {audiences.map((audience) => (
              <div
                key={audience}
                className="rounded-lg border border-[#dbe6df] bg-white px-5 py-4 text-sm font-bold text-[#1a4731] shadow-sm"
              >
                {audience}
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-white">
        <div className="mx-auto flex max-w-7xl flex-col gap-6 px-5 py-10 sm:px-8 md:flex-row md:items-center md:justify-between lg:px-10">
          <div>
            <h2 className="text-2xl font-black text-[#15241b]">
              Prêt à gérer votre groupe scout ?
            </h2>
            <p className="mt-2 text-sm leading-6 text-[#657368]">
              Connectez-vous avec votre matricule ou votre numéro de téléphone.
            </p>
          </div>
          <Link
            href="/login"
            className="rounded-lg bg-[#1a4731] px-6 py-3 text-center text-sm font-bold text-white transition hover:bg-[#22613f]"
          >
            Aller à la connexion
          </Link>
        </div>
      </section>
    </main>
  )
}
