'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { LABELS_BRANCHES, COULEURS_BRANCHES } from '@/lib/branches'
import { LABELS_TYPE_ACTIVITE } from '@/lib/activites'

const LABELS_STATUT_REUNION: Record<string, { label: string; cls: string; dot: string }> = {
  PRESENT: { label: 'Présent', cls: 'text-green-700 bg-green-50', dot: 'bg-green-500' },
  ABSENT: { label: 'Absent', cls: 'text-red-700 bg-red-50', dot: 'bg-red-400' },
  EXCUSE: { label: 'Excusé', cls: 'text-orange-700 bg-orange-50', dot: 'bg-orange-400' },
}

interface Badge { id: string; nom: string; description: string | null; brancheType: string; ordre: number }
interface Progression {
  id: string; dateValidation: string; commentaire: string | null
  badge: Badge
  validePar: { nom: string; prenom: string } | null
}
interface ProchaineActivite {
  id: string; titre: string; dateDebut: string; lieu: string | null; type: string; brancheType: string | null
}
interface DerniereReunion {
  statut: string
  jourReunion: { id: string; titre: string | null; dateHeure: string; dateReportee: string | null; brancheType: string | null }
}
interface Scout {
  id: string; nom: string; prenom: string; brancheType: string; photo: string | null; matricule: string | null; actif: boolean
  progressions: Progression[]
  presences: { activite: { id: string; titre: string; dateDebut: string; type: string } }[]
  _count: { presences: number }
}

export default function PageMaProgression() {
  const [scout, setScout] = useState<Scout | null>(null)
  const [badgesBranche, setBadgesBranche] = useState<Badge[]>([])
  const [prochainesActivites, setProchainesActivites] = useState<ProchaineActivite[]>([])
  const [dernieresReunions, setDernieresReunions] = useState<DerniereReunion[]>([])
  const [chargement, setChargement] = useState(true)
  const [erreur, setErreur] = useState('')

  useEffect(() => {
    fetch('/api/ma-progression')
      .then((r) => r.json())
      .then((data) => {
        if (data.erreur) { setErreur(data.erreur); return }
        setScout(data.scout)
        setBadgesBranche(data.badgesBranche ?? [])
        setProchainesActivites(data.prochainesActivites ?? [])
        setDernieresReunions(data.dernieresReunions ?? [])
      })
      .catch(() => setErreur('Impossible de charger votre progression'))
      .finally(() => setChargement(false))
  }, [])

  if (chargement) return (
    <div className="flex items-center justify-center h-48">
      <div className="w-6 h-6 border-2 border-[#1a4731] border-t-transparent rounded-full animate-spin" />
    </div>
  )

  if (erreur) return <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">{erreur}</div>
  if (!scout) return null

  const badgesObtenus = new Set(scout.progressions.map((p) => p.badge.id))
  const pct = badgesBranche.length > 0 ? Math.round((badgesObtenus.size / badgesBranche.length) * 100) : 0
  const [bgCls, textCls] = (COULEURS_BRANCHES[scout.brancheType] ?? 'bg-gray-100 text-gray-700').split(' ')

  return (
    <div className="space-y-6">
      {/* Profil */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 sm:p-6">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center text-2xl font-bold text-gray-500 flex-shrink-0 overflow-hidden">
            {scout.photo ? <img src={scout.photo} className="w-full h-full object-cover" alt="" /> : `${scout.prenom[0]}${scout.nom[0]}`}
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-xl font-bold text-gray-900">{scout.prenom} {scout.nom}</h1>
            <div className="flex flex-wrap items-center gap-2 mt-1">
              <span className={`text-xs px-2 py-0.5 rounded-full ${bgCls} ${textCls}`}>
                {LABELS_BRANCHES[scout.brancheType] ?? scout.brancheType}
              </span>
              {scout.matricule && <span className="text-xs text-gray-500 font-mono">{scout.matricule}</span>}
              <span className={`text-xs px-2 py-0.5 rounded-full ${scout.actif ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                {scout.actif ? 'Actif' : 'Inactif'}
              </span>
            </div>
          </div>
          <Link href={`/dashboard/scouts/${scout.id}/carte`}
            className="flex-shrink-0 border border-gray-300 text-gray-700 px-3 py-2 rounded-lg hover:bg-gray-50 transition-colors text-sm">
            Ma carte
          </Link>
        </div>
      </div>

      {/* Statistiques */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-[#1a4731] text-white rounded-xl p-4 text-center">
          <p className="text-2xl font-bold">{badgesObtenus.size}</p>
          <p className="text-xs opacity-90 mt-0.5">Badge{badgesObtenus.size > 1 ? 's' : ''} obtenu{badgesObtenus.size > 1 ? 's' : ''}</p>
        </div>
        <div className="bg-[#27ae60] text-white rounded-xl p-4 text-center">
          <p className="text-2xl font-bold">{scout._count.presences}</p>
          <p className="text-xs opacity-90 mt-0.5">Activité{scout._count.presences > 1 ? 's' : ''}</p>
        </div>
        <div className="bg-[#f39c12] text-white rounded-xl p-4 text-center">
          <p className="text-2xl font-bold">{pct}%</p>
          <p className="text-xs opacity-90 mt-0.5">Progression</p>
        </div>
      </div>

      {/* Parcours badges */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 sm:p-6">
        {badgesBranche.length === 0 ? (
          <div className="text-center py-6">
            <p className="text-3xl mb-2">🏅</p>
            <p className="text-sm text-gray-500">Aucun badge configuré pour ta branche pour le moment.</p>
            <p className="text-xs text-gray-400 mt-1">Demande à ton responsable de branche.</p>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-sm font-semibold text-gray-800">Parcours de badges</h2>
              <span className="text-xs text-gray-400">{badgesObtenus.size} / {badgesBranche.length}</span>
            </div>
            <div className="w-full bg-gray-100 rounded-full h-2 mb-4">
              <div className="bg-[#1a4731] h-2 rounded-full transition-all duration-500" style={{ width: `${pct}%` }} />
            </div>
            <div className="space-y-2">
              {badgesBranche.map((badge) => {
                const obtenu = badgesObtenus.has(badge.id)
                const prog = scout.progressions.find((p) => p.badge.id === badge.id)
                return (
                  <div key={badge.id} className={`flex items-start gap-3 p-3 rounded-lg ${obtenu ? 'bg-green-50 border border-green-100' : 'bg-gray-50 border border-gray-100'}`}>
                    <div className={`flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs mt-0.5 ${obtenu ? 'bg-green-500 text-white' : 'bg-gray-200 text-gray-400'}`}>
                      {obtenu ? '✓' : badge.ordre}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm font-medium ${obtenu ? 'text-green-800' : 'text-gray-600'}`}>{badge.nom}</p>
                      {badge.description && <p className="text-xs text-gray-400 mt-0.5">{badge.description}</p>}
                      {obtenu && prog && (
                        <p className="text-xs text-green-600 mt-1">
                          Obtenu le {new Date(prog.dateValidation).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}
                          {prog.validePar ? ` par ${prog.validePar.prenom} ${prog.validePar.nom}` : ''}
                        </p>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </>
        )}
      </div>

      {/* Prochaines activités */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 sm:p-6">
        <h2 className="text-sm font-semibold text-gray-800 mb-4">Prochaines activités</h2>
        {prochainesActivites.length === 0 ? (
          <p className="text-sm text-gray-400 italic text-center py-4">Aucune activité à venir pour le moment.</p>
        ) : (
          <div className="space-y-2">
            {prochainesActivites.map((a) => (
              <div key={a.id} className="flex items-center gap-3 py-1">
                <span className="w-1.5 h-1.5 rounded-full bg-[#f39c12] flex-shrink-0" />
                <span className="flex-1 text-sm text-gray-700 truncate">{a.titre}</span>
                <span className="text-xs text-gray-400 flex-shrink-0">
                  {new Date(a.dateDebut).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })}
                </span>
                {a.lieu && <span className="text-xs text-gray-400">· {a.lieu}</span>}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Dernières participations (activités) */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 sm:p-6">
        <h2 className="text-sm font-semibold text-gray-800 mb-4">Mes dernières participations</h2>
        {scout.presences.length === 0 ? (
          <p className="text-sm text-gray-400 italic text-center py-4">Aucune participation enregistrée.</p>
        ) : (
          <div className="space-y-2">
            {scout.presences.map((p, i) => (
              <div key={i} className="flex items-center gap-3 py-1">
                <span className="w-1.5 h-1.5 rounded-full bg-[#27ae60] flex-shrink-0" />
                <span className="flex-1 text-sm text-gray-700 truncate">{p.activite.titre}</span>
                <span className="text-xs text-gray-400 flex-shrink-0">
                  {new Date(p.activite.dateDebut).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })}
                </span>
                <span className="text-xs text-gray-400">{LABELS_TYPE_ACTIVITE[p.activite.type] ?? p.activite.type}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Dernières réunions */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 sm:p-6">
        <h2 className="text-sm font-semibold text-gray-800 mb-4">Mes dernières réunions</h2>
        {dernieresReunions.length === 0 ? (
          <p className="text-sm text-gray-400 italic text-center py-4">Aucune participation enregistrée.</p>
        ) : (
          <div className="space-y-2">
            {dernieresReunions.map((r, i) => {
              const date = new Date(r.jourReunion.dateReportee ?? r.jourReunion.dateHeure)
              const cfg = LABELS_STATUT_REUNION[r.statut] ?? LABELS_STATUT_REUNION.ABSENT
              return (
                <div key={i} className="flex items-center gap-3 py-1">
                  <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${cfg.dot}`} />
                  <span className="flex-1 text-sm text-gray-700 truncate">
                    {r.jourReunion.titre || `Réunion ${r.jourReunion.brancheType ? (LABELS_BRANCHES[r.jourReunion.brancheType] ?? r.jourReunion.brancheType) : ''}`}
                  </span>
                  <span className="text-xs text-gray-400 flex-shrink-0">
                    {date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </span>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${cfg.cls}`}>{cfg.label}</span>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
