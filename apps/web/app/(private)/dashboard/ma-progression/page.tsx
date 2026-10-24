'use client'

import Image from 'next/image'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { LABELS_BRANCHES, COULEURS_BRANCHES } from '@scout/shared'
import { LABELS_TYPE_ACTIVITE } from '@scout/shared'
import { Award, Check } from '@/lib/icons'

const LABELS_STATUT_REUNION: Record<string, { label: string; cls: string; dot: string }> = {
  PRESENT: { label: 'Présent', cls: 'text-green-700 bg-green-50', dot: 'bg-green-500' },
  ABSENT: { label: 'Absent', cls: 'text-red-700 bg-red-50', dot: 'bg-red-400' },
  EXCUSE: { label: 'Excusé', cls: 'text-orange-700 bg-orange-50', dot: 'bg-orange-400' },
}

interface Badge {
  id: string
  nom: string
  description: string | null
  brancheType: string
  ordre: number
}
interface Progression {
  id: string
  dateValidation: string
  commentaire: string | null
  badge: Badge
  validePar: { nom: string; prenom: string } | null
}
interface ProchaineActivite {
  id: string
  titre: string
  dateDebut: string
  lieu: string | null
  type: string
  brancheType: string | null
}
interface DerniereReunion {
  statut: string
  jourReunion: {
    id: string
    titre: string | null
    dateHeure: string
    dateReportee: string | null
    brancheType: string | null
  }
}
interface Scout {
  id: string
  nom: string
  prenom: string
  brancheType: string
  photo: string | null
  matricule: string | null
  actif: boolean
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
        if (data.erreur) {
          setErreur(data.erreur)
          return
        }
        setScout(data.scout)
        setBadgesBranche(data.badgesBranche ?? [])
        setProchainesActivites(data.prochainesActivites ?? [])
        setDernieresReunions(data.dernieresReunions ?? [])
      })
      .catch(() => setErreur('Impossible de charger votre progression'))
      .finally(() => setChargement(false))
  }, [])

  if (chargement)
    return (
      <div className="flex h-48 items-center justify-center">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-(--cp) border-t-transparent" />
      </div>
    )

  if (erreur)
    return <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{erreur}</div>
  if (!scout) return null

  const badgesObtenus = new Set(scout.progressions.map((p) => p.badge.id))
  const pct = badgesBranche.length > 0 ? Math.round((badgesObtenus.size / badgesBranche.length) * 100) : 0
  const [bgCls, textCls] = (COULEURS_BRANCHES[scout.brancheType] ?? 'bg-gray-100 text-gray-700').split(' ')

  return (
    <div className="space-y-6">
      {/* Profil */}
      <div className="rounded-xl border border-gray-200 bg-white p-5 sm:p-6">
        <div className="flex items-center gap-4">
          <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-full bg-gray-100 text-2xl font-bold text-gray-500">
            {scout.photo ? (
              <Image
                width={64}
                height={64}
                unoptimized
                src={scout.photo}
                className="h-full w-full object-cover"
                alt=""
              />
            ) : (
              `${scout.prenom[0]}${scout.nom[0]}`
            )}
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="text-xl font-bold text-gray-900">
              {scout.prenom} {scout.nom}
            </h1>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <span className={`rounded-full px-2 py-0.5 text-xs ${bgCls} ${textCls}`}>
                {LABELS_BRANCHES[scout.brancheType] ?? scout.brancheType}
              </span>
              {scout.matricule && <span className="font-mono text-xs text-gray-500">{scout.matricule}</span>}
              <span
                className={`rounded-full px-2 py-0.5 text-xs ${scout.actif ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}
              >
                {scout.actif ? 'Actif' : 'Inactif'}
              </span>
            </div>
          </div>
          <Link
            href={`/dashboard/scouts/${scout.id}/carte`}
            className="shrink-0 rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-700 transition-colors hover:bg-gray-50"
          >
            Ma carte
          </Link>
        </div>
      </div>

      {/* Statistiques */}
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-xl bg-(--cp) p-4 text-center text-white">
          <p className="text-2xl font-bold">{badgesObtenus.size}</p>
          <p className="mt-0.5 text-xs opacity-90">
            Badge{badgesObtenus.size > 1 ? 's' : ''} obtenu{badgesObtenus.size > 1 ? 's' : ''}
          </p>
        </div>
        <div className="rounded-xl bg-(--ca) p-4 text-center text-white">
          <p className="text-2xl font-bold">{scout._count.presences}</p>
          <p className="mt-0.5 text-xs opacity-90">Activité{scout._count.presences > 1 ? 's' : ''}</p>
        </div>
        <div className="rounded-xl bg-(--ca) p-4 text-center text-white">
          <p className="text-2xl font-bold">{pct}%</p>
          <p className="mt-0.5 text-xs opacity-90">Progression</p>
        </div>
      </div>

      {/* Parcours badges */}
      <div className="rounded-xl border border-gray-200 bg-white p-5 sm:p-6">
        {badgesBranche.length === 0 ? (
          <div className="py-6 text-center">
            <Award className="mx-auto mb-2 h-8 w-8 text-gray-300" strokeWidth={2} />
            <p className="text-sm text-gray-500">Aucun badge configuré pour ta branche pour le moment.</p>
            <p className="mt-1 text-xs text-gray-400">Demande à ton responsable de branche.</p>
          </div>
        ) : (
          <>
            <div className="mb-2 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-gray-800">Parcours de badges</h2>
              <span className="text-xs text-gray-400">
                {badgesObtenus.size} / {badgesBranche.length}
              </span>
            </div>
            <div className="mb-4 h-2 w-full rounded-full bg-gray-100">
              <div className="h-2 rounded-full bg-(--cp) transition-all duration-500" style={{ width: `${pct}%` }} />
            </div>
            <div className="space-y-2">
              {badgesBranche.map((badge) => {
                const obtenu = badgesObtenus.has(badge.id)
                const prog = scout.progressions.find((p) => p.badge.id === badge.id)
                return (
                  <div
                    key={badge.id}
                    className={`flex items-start gap-3 rounded-lg p-3 ${obtenu ? 'border border-green-100 bg-green-50' : 'border border-gray-100 bg-gray-50'}`}
                  >
                    <div
                      className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs ${obtenu ? 'bg-green-500 text-white' : 'bg-gray-200 text-gray-400'}`}
                    >
                      {obtenu ? <Check className="h-3.5 w-3.5" strokeWidth={2.5} /> : badge.ordre}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className={`text-sm font-medium ${obtenu ? 'text-green-800' : 'text-gray-600'}`}>
                        {badge.nom}
                      </p>
                      {badge.description && <p className="mt-0.5 text-xs text-gray-400">{badge.description}</p>}
                      {obtenu && prog && (
                        <p className="mt-1 text-xs text-green-600">
                          Obtenu le{' '}
                          {new Date(prog.dateValidation).toLocaleDateString('fr-FR', {
                            day: 'numeric',
                            month: 'long',
                            year: 'numeric',
                          })}
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
      <div className="rounded-xl border border-gray-200 bg-white p-5 sm:p-6">
        <h2 className="mb-4 text-sm font-semibold text-gray-800">Prochaines activités</h2>
        {prochainesActivites.length === 0 ? (
          <p className="py-4 text-center text-sm text-gray-400 italic">Aucune activité à venir pour le moment.</p>
        ) : (
          <div className="space-y-2">
            {prochainesActivites.map((a) => (
              <div key={a.id} className="flex items-center gap-3 py-1">
                <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-(--ca)" />
                <span className="flex-1 truncate text-sm text-gray-700">{a.titre}</span>
                <span className="shrink-0 text-xs text-gray-400">
                  {new Date(a.dateDebut).toLocaleDateString('fr-FR', {
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric',
                  })}
                </span>
                {a.lieu && <span className="text-xs text-gray-400">· {a.lieu}</span>}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Dernières participations (activités) */}
      <div className="rounded-xl border border-gray-200 bg-white p-5 sm:p-6">
        <h2 className="mb-4 text-sm font-semibold text-gray-800">Mes dernières participations</h2>
        {scout.presences.length === 0 ? (
          <p className="py-4 text-center text-sm text-gray-400 italic">Aucune participation enregistrée.</p>
        ) : (
          <div className="space-y-2">
            {scout.presences.map((p, i) => (
              <div key={i} className="flex items-center gap-3 py-1">
                <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-(--ca)" />
                <span className="flex-1 truncate text-sm text-gray-700">{p.activite.titre}</span>
                <span className="shrink-0 text-xs text-gray-400">
                  {new Date(p.activite.dateDebut).toLocaleDateString('fr-FR', {
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric',
                  })}
                </span>
                <span className="text-xs text-gray-400">
                  {LABELS_TYPE_ACTIVITE[p.activite.type] ?? p.activite.type}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Dernières réunions */}
      <div className="rounded-xl border border-gray-200 bg-white p-5 sm:p-6">
        <h2 className="mb-4 text-sm font-semibold text-gray-800">Mes dernières réunions</h2>
        {dernieresReunions.length === 0 ? (
          <p className="py-4 text-center text-sm text-gray-400 italic">Aucune participation enregistrée.</p>
        ) : (
          <div className="space-y-2">
            {dernieresReunions.map((r, i) => {
              const date = new Date(r.jourReunion.dateReportee ?? r.jourReunion.dateHeure)
              const cfg = LABELS_STATUT_REUNION[r.statut] ?? LABELS_STATUT_REUNION.ABSENT
              return (
                <div key={i} className="flex items-center gap-3 py-1">
                  <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${cfg.dot}`} />
                  <span className="flex-1 truncate text-sm text-gray-700">
                    {r.jourReunion.titre ||
                      `Réunion ${r.jourReunion.brancheType ? (LABELS_BRANCHES[r.jourReunion.brancheType] ?? r.jourReunion.brancheType) : ''}`}
                  </span>
                  <span className="shrink-0 text-xs text-gray-400">
                    {date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </span>
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${cfg.cls}`}>{cfg.label}</span>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
