'use client'

import { useSession } from 'next-auth/react'
import { useEffect, useState } from 'react'
import Link from 'next/link'

type ActiviteRecente = {
  id: string
  titre: string
  dateDebut: string
  type: string
  brancheType: string | null
  lieu: string | null
  _count: { presences: number }
}

type KpisData = {
  kpis: Record<string, number | string>
  activitesRecentes: ActiviteRecente[]
}

const ICONES_KPI: Record<string, string> = {
  'Scouts actifs': '⚜️',
  'Activités ce mois': '📅',
  'Taux de présence': '✅',
  'Branches actives': '🌿',
  'Branches': '🌿',
  'Scouts dans la branche': '⚜️',
  'Présences ce mois': '✅',
  'Mes enfants': '👨‍👧‍👦',
  'Prochaines activités': '📅',
  'Badges obtenus': '🏅',
  'Activités participées': '📅',
}

const COULEURS_KPI = [
  'bg-[#1a4731]',
  'bg-[#27ae60]',
  'bg-[#f39c12]',
  'bg-blue-600',
]

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

  const [data, setData] = useState<KpisData | null>(null)
  const [chargement, setChargement] = useState(true)
  const [erreur, setErreur] = useState('')

  useEffect(() => {
    if (!session?.user) return
    setErreur('')
    fetch('/api/dashboard/kpis')
      .then((r) => r.json())
      .then((d) => {
        if (!d?.kpis) { setErreur("Impossible de charger le tableau de bord."); return }
        setData(d)
      })
      .catch(() => setErreur('Impossible de charger le tableau de bord. Vérifiez votre connexion.'))
      .finally(() => setChargement(false))
  }, [session])

  const entrees = data?.kpis ? Object.entries(data.kpis) : []

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* En-tête */}
      <div className="bg-white rounded-xl px-4 py-4 sm:p-6 shadow-sm border border-gray-100">
        <h1 className="text-base sm:text-xl font-bold text-[#1a4731] leading-snug">
          Bienvenue, {session?.user?.prenom} {session?.user?.nom} 👋
        </h1>
        <p className="text-gray-500 mt-0.5 text-xs sm:text-sm">
          Profil : <span className="font-medium text-[#27ae60]">{libelleRole(role)}</span>
        </p>
      </div>

      {erreur && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">{erreur}</div>
      )}

      {/* Actions rapides */}
      {role === 'CHEF_GROUPE' && (
        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
          <h2 className="text-sm font-semibold text-gray-700 mb-4">Actions rapides</h2>
          <div className="flex flex-wrap gap-3">
            <Link
              href="/dashboard/utilisateurs/nouveau"
              className="inline-flex items-center justify-center bg-[#1a4731] text-white px-4 py-2 rounded-lg hover:bg-[#163d29] transition-colors text-sm font-medium"
            >
              + Nouveau membre
            </Link>
            <Link
              href="/dashboard/paroisse"
              className="inline-flex items-center justify-center border border-gray-300 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-50 transition-colors text-sm font-medium"
            >
              Personnaliser ma paroisse
            </Link>
            <Link
              href="/dashboard/rapports"
              className="inline-flex items-center justify-center border border-gray-300 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-50 transition-colors text-sm font-medium"
            >
              Voir les rapports
            </Link>
          </div>
        </div>
      )}

      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {chargement
          ? Array.from({ length: 4 }).map((_, i) => (
              <div
                key={i}
                className="bg-white rounded-xl p-4 sm:p-6 shadow-sm border border-gray-100 animate-pulse"
              >
                <div className="w-10 h-10 bg-gray-200 rounded-lg mb-4" />
                <div className="h-7 bg-gray-200 rounded w-16 mb-2" />
                <div className="h-3 bg-gray-100 rounded w-24" />
              </div>
            ))
          : entrees.map(([titre, valeur], i) => (
              <div
                key={titre}
                className="bg-white rounded-xl p-4 sm:p-6 shadow-sm border border-gray-100"
              >
                <div
                  className={`w-10 h-10 sm:w-12 sm:h-12 ${COULEURS_KPI[i % COULEURS_KPI.length]} rounded-xl flex items-center justify-center text-xl sm:text-2xl mb-4`}
                >
                  {ICONES_KPI[titre] ?? '📊'}
                </div>
                <p className="text-2xl sm:text-3xl font-bold text-gray-800 leading-none">{valeur}</p>
                <p className="text-sm text-gray-500 mt-1.5 leading-tight">{titre}</p>
              </div>
            ))}
      </div>

      {/* Activités récentes */}
      <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
        <h2 className="text-sm font-semibold text-gray-700 mb-4">
          {role === 'PARENT' ? 'Prochaines activités' : 'Activités récentes'}
        </h2>

        {chargement ? (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-12 bg-gray-100 rounded-lg animate-pulse" />
            ))}
          </div>
        ) : !data?.activitesRecentes?.length ? (
          <p className="text-sm text-gray-400 text-center py-8">
            Aucune activité récente pour le moment.
          </p>
        ) : (
          <div className="divide-y divide-gray-50">
            {data.activitesRecentes.map((a) => (
              <div key={a.id} className="flex flex-col sm:flex-row sm:items-center sm:justify-between py-3 first:pt-0 last:pb-0 gap-2">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-8 h-8 bg-[#1a4731]/10 rounded-lg flex items-center justify-center text-sm flex-shrink-0">
                    {a.type === 'CAMP' ? '⛺' : a.type === 'SORTIE' ? '🥾' : a.type === 'SERVICE' ? '🤝' : a.type === 'CELEBRATION' ? '🎉' : a.type === 'FORMATION' ? '📚' : '📋'}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-800 truncate">{a.titre}</p>
                    <p className="text-xs text-gray-400 truncate">
                      {formatDate(a.dateDebut)}
                      {a.lieu && ` · ${a.lieu}`}
                    </p>
                  </div>
                </div>
                <div className="flex items-center flex-wrap gap-2 sm:flex-shrink-0 sm:ml-4 pl-11 sm:pl-0">
                  {a.brancheType && (
                    <span className="text-xs bg-[#1a4731]/10 text-[#1a4731] font-medium px-2 py-0.5 rounded-full">
                      {LIBELLES_BRANCHE[a.brancheType] ?? a.brancheType}
                    </span>
                  )}
                  <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">
                    {LIBELLES_TYPE[a.type] ?? a.type}
                  </span>
                  <span className="text-xs text-gray-400">
                    {a._count.presences} présence{a._count.presences !== 1 ? 's' : ''}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
