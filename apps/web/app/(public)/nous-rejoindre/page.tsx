import type { Metadata } from 'next'
import Link from 'next/link'
import { getIdentite } from '@/lib/identite-serveur'
import { ArrowRight, Check, Clock, HelpCircle, Mail, MapPin, MessageCircle, Phone, UserPlus, UsersRound } from '@/lib/icons'
import type { LucideIcon } from '@/lib/icons'
import { EnTetePage } from '@/components/public/EnTetePage'
import { FormulaireDemande } from '@/components/public/FormulaireDemande'
import { PARCOURS_REJOINDRE, parcoursDepuis, type ObjetParcours } from '@/components/public/parcours'
import { parametre } from '@/components/public/outils'

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> }

export const metadata: Metadata = {
  title: 'Nous rejoindre',
  description: 'Inscrire un jeune, devenir chef ou cheftaine, demander une information ou contacter le groupe scout.',
  alternates: { canonical: '/nous-rejoindre' },
}

const ICONES: Record<ObjetParcours, LucideIcon> = {
  inscription: UserPlus,
  chef: UsersRound,
  information: HelpCircle,
  contact: MessageCircle,
}

// Étapes réelles du traitement (module adhesions de l'API) : la demande est
// reçue, examinée par la direction, puis la famille est recontactée.
const ETAPES = [
  'Vous envoyez votre demande : aucun compte n’est créé.',
  'La direction du groupe l’examine.',
  'Elle vous recontacte pour la suite (rencontre, dossier, cotisation).',
]

export default async function PageNousRejoindre({ searchParams }: Props) {
  const identite = await getIdentite()
  const objet = parametre((await searchParams).objet)
  const ouvertes = identite.inscriptionsOuvertes
  const parcours = parcoursDepuis(objet, ouvertes)
  const coordonnees = !!(identite.adresse || identite.telephone || identite.email || identite.horaires)

  return (
    <>
      <EnTetePage
        surtitre="Nous rejoindre"
        titre="Rejoindre l’aventure"
        description={
          ouvertes
            ? 'Choisissez votre démarche : le formulaire s’adapte et ne vous demande que l’essentiel.'
            : 'Les inscriptions sont fermées pour le moment. Vous pouvez toujours nous écrire pour être informé de leur réouverture.'
        }
      />

      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 sm:py-14 lg:px-8">
        {/* Choix du parcours : de simples liens, utilisables sans JavaScript. */}
        <nav aria-label="Votre démarche">
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {PARCOURS_REJOINDRE.map((p) => {
              const indisponible = p.soumisAuxInscriptions && !ouvertes
              const actif = p.objet === parcours.objet
              const Icone = ICONES[p.objet]
              const contenu = (
                <>
                  <span className="flex items-center justify-between gap-3">
                    <Icone className={`h-5 w-5 ${actif ? 'text-white' : 'text-primaire'}`} aria-hidden />
                    {actif && <Check className="h-5 w-5" aria-hidden />}
                  </span>
                  <span className="mt-4 block text-lg leading-snug font-semibold">{p.titre}</span>
                  <span className={`mt-1 block text-[0.95rem] leading-relaxed ${actif ? 'text-white/85' : 'text-encre-douce'}`}>
                    {indisponible ? 'Inscriptions fermées pour le moment.' : p.texte}
                  </span>
                </>
              )
              return (
                <li key={p.objet}>
                  {indisponible ? (
                    <div className="h-full rounded-lg border border-dashed border-ligne-forte p-5 text-encre-pale opacity-75">{contenu}</div>
                  ) : (
                    <Link
                      href={`/nous-rejoindre?objet=${p.objet}#formulaire`}
                      aria-current={actif ? 'true' : undefined}
                      scroll={false}
                      className={`block h-full rounded-lg border p-5 transition ${
                        actif ? 'border-primaire bg-primaire text-white' : 'border-ligne bg-white text-encre hover:border-ligne-forte hover:shadow-carte'
                      }`}
                    >
                      {contenu}
                    </Link>
                  )}
                </li>
              )
            })}
          </ul>
        </nav>

        <div className="mt-12 grid gap-12 lg:grid-cols-12">
          <section id="formulaire" aria-labelledby="titre-formulaire" className="lg:col-span-8">
            <h2 id="titre-formulaire" className="titre-display mb-5 text-3xl font-semibold text-encre">
              {parcours.titre}
            </h2>
            <FormulaireDemande key={parcours.objet} parcours={parcours} />
          </section>

          <aside className="space-y-10 lg:col-span-4" aria-label="Informations pratiques">
            <section aria-labelledby="titre-etapes">
              <h2 id="titre-etapes" className="signal text-sm text-accent">
                Et ensuite ?
              </h2>
              <ol className="mt-4 space-y-4">
                {ETAPES.map((e, i) => (
                  <li key={e} className="flex gap-4">
                    <span className="chiffre-signal flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-foret-50 text-lg text-primaire" aria-hidden>
                      {i + 1}
                    </span>
                    <p className="pt-1 leading-relaxed text-encre-douce">{e}</p>
                  </li>
                ))}
              </ol>
            </section>

            <section id="contact" aria-labelledby="titre-contact" className="rounded-lg bg-profond p-6 text-white">
              <h2 id="titre-contact" className="signal text-sm text-or-300">
                Contacter le groupe
              </h2>
              {coordonnees ? (
                <ul className="mt-4 space-y-3">
                  {identite.adresse && (
                    <li className="flex gap-3">
                      <MapPin className="mt-0.5 h-5 w-5 shrink-0 text-or-300" aria-hidden />
                      <span>{identite.adresse}</span>
                    </li>
                  )}
                  {identite.horaires && (
                    <li className="flex gap-3">
                      <Clock className="mt-0.5 h-5 w-5 shrink-0 text-or-300" aria-hidden />
                      <span>{identite.horaires}</span>
                    </li>
                  )}
                  {identite.telephone && (
                    <li className="flex gap-3">
                      <Phone className="mt-0.5 h-5 w-5 shrink-0 text-or-300" aria-hidden />
                      <a href={`tel:${identite.telephone.replace(/\s/g, '')}`} className="underline-offset-4 hover:underline">
                        {identite.telephone}
                      </a>
                    </li>
                  )}
                  {identite.email && (
                    <li className="flex gap-3">
                      <Mail className="mt-0.5 h-5 w-5 shrink-0 text-or-300" aria-hidden />
                      <a href={`mailto:${identite.email}`} className="break-all underline-offset-4 hover:underline">
                        {identite.email}
                      </a>
                    </li>
                  )}
                </ul>
              ) : (
                <p className="mt-4 leading-relaxed text-white/85">
                  Les coordonnées du groupe ne sont pas encore publiées : utilisez le formulaire, la direction vous répondra.
                </p>
              )}
              {parcours.objet !== 'contact' && (
                <Link
                  href="/nous-rejoindre?objet=contact#formulaire"
                  scroll={false}
                  className="group mt-6 inline-flex items-center gap-1.5 border-b-2 border-or-300 pb-0.5 font-semibold focus-visible:outline-white"
                >
                  Écrire un message
                  <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" aria-hidden />
                </Link>
              )}
            </section>
          </aside>
        </div>
      </div>
    </>
  )
}
