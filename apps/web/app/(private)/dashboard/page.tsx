'use client'

import { useSession } from '@/lib/session-client'
import { useDashboard } from '@/hooks/useDashboard'
import Link from 'next/link'
import { ICONES_KPI, ICONE_KPI_DEFAUT, ICONES_TYPE_ACTIVITE, ClipboardList } from '@/lib/icons'
import { StatCard, StatCardSkeleton } from '@/components/ui/StatCard'
import { pageHorsPerimetreV1 } from '@scout/shared'

const TONS_KPI: Array<'primary' | 'accent' | 'warning' | 'info'> = ['primary', 'accent', 'warning', 'info']

const LIBELLES_TYPE: Record<string, string> = {
  REUNION: 'Réunion',
  SORTIE: 'Sortie',
  CAMP: 'Camp',
  SERVICE: 'Service',
  CELEBRATION: 'Célébration',
  FORMATION: 'Formation',
  AUTRE: 'Autre',
}

const LIBELLES_BRANCHE: Record<string, string> = {
  OISILLONS: 'Oisillons',
  LOUVETEAUX: 'Louveteaux',
  ECLAIREURS: 'Éclaireurs',
  CHEMINOTS: 'Cheminots',
  COMPAGNONS: 'Compagnons',
  RESSOURCES_ADULTES: 'Ressources Adultes',
}

function libelleRole(role: string): string {
  const libelles: Record<string, string> = {
    CHEF_GROUPE: 'Chef de groupe',
    ADJOINT_GROUPE: 'Adjoint de groupe',
    ASSISTANT_GROUPE: 'Assistant de groupe',
    RESPONSABLE_BRANCHE: 'Responsable de branche',
    ADJOINT_BRANCHE: 'Adjoint de branche',
    ASSISTANT_BRANCHE: 'Assistant de branche',
    PARENT: 'Parent',
    SCOUT: 'Scout',
  }
  return libelles[role] ?? role
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr)
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })
}

export default function DashboardPage() {
  const { data: session } = useSession()
  const role = session?.user?.role ?? ''

  const dashboard = useDashboard()
  const chargement = !dashboard.hydrate || dashboard.isPending
  const erreur = dashboard.hydrate && dashboard.isError
  // Un échec de rafraîchissement ne doit pas présenter des données anciennes comme actuelles.
  const data = !dashboard.hydrate || erreur ? undefined : dashboard.data

  const entrees = data?.kpis ? Object.entries(data.kpis) : []

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* En-tête */}
      <div className="rounded-xl border border-gray-100 bg-white px-4 py-4 shadow-sm sm:p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-base leading-snug font-bold sm:text-xl" style={{ color: 'var(--cp)' }}>
              Bienvenue, {session?.user?.prenom} {session?.user?.nom}
            </h1>
            <p className="mt-0.5 text-xs text-gray-500 sm:text-sm">
              Profil :{' '}
              <span className="font-medium" style={{ color: 'var(--ca)' }}>
                {libelleRole(role)}
              </span>
            </p>
          </div>

          {role === 'CHEF_GROUPE' && (
            <div className="flex shrink-0 flex-wrap gap-2">
              <Link
                href="/dashboard/utilisateurs/nouveau"
                className="inline-flex items-center justify-center rounded-lg bg-(--cp) px-4 py-2 text-sm font-medium text-white transition-all hover:brightness-110"
              >
                + Nouveau membre
              </Link>
              <Link
                href="/dashboard/paroisse"
                className="inline-flex items-center justify-center rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
              >
                Personnaliser ma paroisse
              </Link>
              {!pageHorsPerimetreV1('/dashboard/rapports') && (
                <Link
                  href="/dashboard/rapports"
                  className="inline-flex items-center justify-center rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
                >
                  Voir les rapports
                </Link>
              )}
            </div>
          )}
        </div>
      </div>

      {erreur && (
        <section className="space-y-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <p role="alert">{dashboard.error?.message ?? 'Impossible de charger le tableau de bord. Vérifiez votre connexion.'}</p>
          <button type="button" disabled={dashboard.isFetching} onClick={() => void dashboard.refetch()}
            className="rounded-lg border border-red-300 px-4 py-2 font-medium disabled:opacity-60">Réessayer</button>
        </section>
      )}

      {/* KPIs */}
      {!erreur && <>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {chargement
          ? Array.from({ length: 4 }).map((_, i) => <StatCardSkeleton key={i} />)
          : entrees.map(([titre, valeur], i) => (
              <StatCard
                key={titre}
                label={titre}
                value={valeur}
                icon={ICONES_KPI[titre] ?? ICONE_KPI_DEFAUT}
                tone={TONS_KPI[i % TONS_KPI.length]}
              />
            ))}
      </div>

      {/* Activités récentes */}
      <div className="rounded-xl border border-gray-100 bg-white p-6 shadow-sm">
        <h2 className="mb-4 text-sm font-semibold text-gray-700">
          {role === 'PARENT' ? 'Prochaines activités' : 'Activités récentes'}
        </h2>

        {chargement ? (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-12 animate-pulse rounded-lg bg-gray-100" />
            ))}
          </div>
        ) : !data?.activitesRecentes?.length ? (
          <p className="py-8 text-center text-sm text-gray-400">Aucune activité récente pour le moment.</p>
        ) : (
          <div className="divide-y divide-gray-50">
            {data.activitesRecentes.map((a) => {
              const IconeActivite = ICONES_TYPE_ACTIVITE[a.type] ?? ClipboardList
              return (
                <div
                  key={a.id}
                  className="flex flex-col gap-2 py-3 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <div
                      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg"
                      style={{ backgroundColor: 'rgba(var(--cp-rgb), 0.1)', color: 'var(--cp)' }}
                    >
                      <IconeActivite className="h-4 w-4" strokeWidth={2} />
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-gray-800">{a.titre}</p>
                      <p className="truncate text-xs text-gray-400">
                        {formatDate(a.dateDebut)}
                        {a.lieu && ` · ${a.lieu}`}
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 pl-11 sm:ml-4 sm:shrink-0 sm:pl-0">
                    {a.brancheType && (
                      <span
                        className="rounded-full px-2 py-0.5 text-xs font-medium"
                        style={{ backgroundColor: 'rgba(var(--cp-rgb), 0.1)', color: 'var(--cp)' }}
                      >
                        {LIBELLES_BRANCHE[a.brancheType] ?? a.brancheType}
                      </span>
                    )}
                    <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-500">
                      {LIBELLES_TYPE[a.type] ?? a.type}
                    </span>
                    <span className="text-xs text-gray-400">
                      {a._count.presences} présence{a._count.presences !== 1 ? 's' : ''}
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
      </>}
    </div>
  )
}
