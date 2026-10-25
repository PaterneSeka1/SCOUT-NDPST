'use client'

import Link from 'next/link'
import { ResumeAdhesions } from '@/components/adhesions/ResumeAdhesions'
import { LABELS_BRANCHES, LABELS_ROLES } from '@scout/shared'
import { useSession } from '@/lib/session-client'
import { useDashboard } from '@/hooks/useDashboard'
import { ErrorState } from '@/components/ui'
import {
  ATraiter,
  Bloc,
  ComptesParRole,
  Cotisations,
  EvolutionEffectifs,
  Indicateurs,
  Journal,
  ListeActivites,
  ListeReunions,
  PresencesRecentes,
  RepartitionBranches,
  Services,
} from '@/components/dashboard/Blocs'

const FORMAT_DATE = new Intl.DateTimeFormat('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })

function Squelette() {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Chargement du tableau de bord">
      <div className="h-24 animate-pulse rounded-lg bg-white" />
      <div className="grid gap-6 lg:grid-cols-12">
        <div className="h-64 animate-pulse rounded-lg bg-white lg:col-span-7" />
        <div className="h-64 animate-pulse rounded-lg bg-white lg:col-span-5" />
      </div>
    </div>
  )
}

export default function DashboardPage() {
  const { data: session } = useSession()
  const utilisateur = session?.user
  const dashboard = useDashboard()
  const chargement = !dashboard.hydrate || dashboard.isPending
  const erreur = dashboard.hydrate && dashboard.isError
  // Un échec de rafraîchissement ne doit pas présenter des données anciennes comme actuelles.
  const data = !dashboard.hydrate || erreur ? undefined : dashboard.data

  const sousTitre =
    data?.profil === 'BRANCHE' && data.brancheType
      ? `${LABELS_ROLES[utilisateur?.role ?? ''] ?? ''} · ${LABELS_BRANCHES[data.brancheType] ?? data.brancheType}`
      : (LABELS_ROLES[utilisateur?.role ?? ''] ?? '')

  return (
    <div className="space-y-6">
      {!!utilisateur?.habilitationsAdhesion?.length && <ResumeAdhesions />}
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm text-encre-pale first-letter:uppercase" suppressHydrationWarning>
            {FORMAT_DATE.format(new Date())}
          </p>
          <h1 className="titre-display mt-1 text-2xl font-semibold text-encre sm:text-3xl">Bonjour {utilisateur?.prenom}</h1>
          {sousTitre && <p className="mt-0.5 text-[0.95rem] text-encre-douce">{sousTitre}</p>}
        </div>
        {data && data.actions.length > 0 && (
          <nav aria-label="Actions rapides">
            <ul className="flex flex-wrap gap-2">
              {data.actions.map((a, i) => (
                <li key={a.lien}>
                  <Link
                    href={a.lien}
                    className={`inline-flex h-9 items-center gap-2 rounded-md px-3.5 text-sm font-medium transition ${
                      i === 0 ? 'bg-primaire text-white hover:brightness-110' : 'border border-ligne-forte bg-white text-encre hover:bg-papier'
                    }`}
                  >
                    {a.libelle}
                    {!!a.nombre && (
                      <span className={`chiffre-signal rounded px-1.5 text-sm ${i === 0 ? 'bg-white/20' : 'bg-accent text-white'}`}>
                        {a.nombre}
                        <span className="sr-only"> en attente</span>
                      </span>
                    )}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        )}
      </header>

      {erreur ? (
        <ErrorState
          message={dashboard.error?.message ?? 'Impossible de charger le tableau de bord. Vérifiez votre connexion.'}
          onReessayer={() => void dashboard.refetch()}
          className="rounded-lg border border-ligne bg-white"
        />
      ) : chargement || !data ? (
        <Squelette />
      ) : (
        <>
          <Indicateurs indicateurs={data.indicateurs} />

          <div className="grid gap-6 lg:grid-cols-12">
            <div className="space-y-6 lg:col-span-7">
              <ATraiter alertes={data.alertes} />
              {data.activitesAVenir && (
                <Bloc titre="Prochaines activités" lien={data.profil === 'FAMILLE' ? undefined : { href: '/dashboard/activites', libelle: 'Toutes' }}>
                  <ListeActivites activites={data.activitesAVenir} />
                </Bloc>
              )}
              {data.reunionsAVenir && (
                <Bloc titre="Réunions à venir" lien={{ href: '/dashboard/reunions', libelle: 'Toutes' }}>
                  <ListeReunions reunions={data.reunionsAVenir} />
                </Bloc>
              )}
              {data.journal && (
                <Bloc titre="Dernières actions" lien={{ href: '/admin/audit', libelle: 'Journal complet' }}>
                  <Journal journal={data.journal} />
                </Bloc>
              )}
            </div>

            <div className="space-y-6 lg:col-span-5">
              {data.repartitionBranches && (
                <Bloc titre="Effectifs par branche" lien={{ href: '/dashboard/branches', libelle: 'Branches' }}>
                  <RepartitionBranches repartition={data.repartitionBranches} />
                </Bloc>
              )}
              {data.cotisations && (
                <Bloc titre="Cotisations de l’année" lien={{ href: '/dashboard/cotisations', libelle: 'Détail' }}>
                  <Cotisations c={data.cotisations} />
                </Bloc>
              )}
              {data.presencesRecentes && (
                <Bloc titre="Présences des 30 derniers jours" lien={{ href: '/dashboard/presences', libelle: 'Présences' }}>
                  <PresencesRecentes reunions={data.presencesRecentes} />
                </Bloc>
              )}
              {data.evolutionEffectifs && (
                <Bloc titre="Évolution des effectifs (12 mois)">
                  <EvolutionEffectifs points={data.evolutionEffectifs} />
                </Bloc>
              )}
              {data.comptesParRole && (
                <Bloc titre="Comptes actifs par rôle" lien={{ href: '/admin/utilisateurs', libelle: 'Gérer' }}>
                  <ComptesParRole comptes={data.comptesParRole} />
                </Bloc>
              )}
              {data.services && (
                <Bloc titre="État des services">
                  <Services services={data.services} />
                </Bloc>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
