'use client'

import Image from 'next/image'

import { useSession } from '@/lib/session-client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { LABELS_BRANCHES, COULEURS_BRANCHES } from '@scout/shared'
import { LABELS_TYPE_ACTIVITE } from '@scout/shared'
import { anneeScolaireCourante } from '@scout/shared'
import { ArrowRight, ICONES_TYPE_ACTIVITE } from '@/lib/icons'

interface Scout {
  id: string
  prenom: string
  nom: string
  matricule: string | null
  actif: boolean
  photo: string | null
}
interface Activite {
  id: string
  titre: string
  type: string
  dateDebut: string
}
interface Reunion {
  id: string
  titre: string | null
  dateHeure: string
  dateReportee: string | null
  statut: string
}

export default function PageMaBranche() {
  const { data: session } = useSession()
  const [scouts, setScouts] = useState<Scout[]>([])
  const [activites, setActivites] = useState<Activite[]>([])
  const [prochaineReunion, setProchaineReunion] = useState<Reunion | null>(null)
  const [nonCotisants, setNonCotisants] = useState(0)
  const [brancheType, setBrancheType] = useState<string | null>(null)
  const [chargement, setChargement] = useState(true)
  const [erreur, setErreur] = useState('')

  useEffect(() => {
    // useSession() démarre en état 'loading' (session === undefined) : sans ce
    // garde, l'effet tournait une première fois sans utilisateur connu, ne
    // trouvait jamais le poste, et affichait une erreur qui restait bloquée
    // à l'écran même une fois la session résolue et les données chargées.
    if (!session?.user) return

    fetch('/api/me/branche')
      .then((r) => r.json())
      .then((data) => {
        if (data.erreur) {
          setErreur(data.erreur)
          return
        }
        if (!data.brancheType) {
          setErreur('Aucune branche assignée à votre compte')
          setChargement(false)
          return
        }
        setErreur('')
        const type = data.brancheType
        setBrancheType(type)
        return Promise.all([
          fetch(`/api/scouts?limite=100`).then((r) => r.json()),
          fetch(`/api/activites?limite=10`).then((r) => r.json()),
          fetch('/api/reunions').then((r) => r.json()),
          fetch(`/api/cotisations/statuts?anneeScolaire=${anneeScolaireCourante()}`).then((r) => r.json()),
        ])
      })
      .then((results) => {
        if (!results) return
        const [scoutsData, activitesData, reunionsData, cotisationsData] = results
        setScouts(scoutsData.scouts ?? [])
        setActivites(activitesData.activites ?? [])

        const maintenant = new Date()
        const aVenir = (reunionsData ?? [])
          .filter(
            (r: Reunion) =>
              (r.statut === 'PLANIFIEE' || r.statut === 'REPORTEE') &&
              new Date(r.dateReportee ?? r.dateHeure) >= maintenant,
          )
          .sort(
            (a: Reunion, b: Reunion) =>
              new Date(a.dateReportee ?? a.dateHeure).getTime() - new Date(b.dateReportee ?? b.dateHeure).getTime(),
          )
        setProchaineReunion(aVenir[0] ?? null)

        setNonCotisants((cotisationsData.scouts ?? []).filter((s: { cotisant: boolean }) => !s.cotisant).length)
      })
      .catch(() => setErreur('Impossible de charger les données'))
      .finally(() => setChargement(false))
  }, [session])

  if (chargement)
    return (
      <div className="flex h-48 items-center justify-center">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-(--cp) border-t-transparent" />
      </div>
    )

  if (erreur)
    return <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{erreur}</div>

  const couleur = brancheType ? COULEURS_BRANCHES[brancheType] : 'bg-gray-100 text-gray-700'
  const [bgCls, textCls] = couleur.split(' ')

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-gray-900 sm:text-2xl">Ma branche</h1>
        {brancheType && (
          <span className={`mt-1 inline-block rounded-full px-3 py-0.5 text-sm font-medium ${bgCls} ${textCls}`}>
            {LABELS_BRANCHES[brancheType] ?? brancheType}
          </span>
        )}
      </div>

      {/* Actions du jour */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Link
          href={prochaineReunion ? `/dashboard/reunions/${prochaineReunion.id}/presences` : '/dashboard/reunions'}
          className="rounded-xl border border-gray-200 bg-white p-4 transition-colors hover:border-(--cp)/40"
        >
          <p className="text-xs font-medium text-gray-500">Prochaine réunion</p>
          {prochaineReunion ? (
            <>
              <p className="mt-1 truncate text-sm font-semibold text-gray-900">{prochaineReunion.titre ?? 'Réunion'}</p>
              <p className="mt-0.5 inline-flex items-center gap-1 text-xs text-(--cp)">
                {new Date(prochaineReunion.dateReportee ?? prochaineReunion.dateHeure).toLocaleDateString('fr-FR', {
                  weekday: 'short',
                  day: 'numeric',
                  month: 'short',
                })}
                {' · '}Prendre les présences <ArrowRight className="h-3.5 w-3.5" strokeWidth={2} />
              </p>
            </>
          ) : (
            <p className="mt-1 text-sm text-gray-400">Aucune réunion planifiée</p>
          )}
        </Link>

        <Link
          href="/dashboard/cotisations"
          className="rounded-xl border border-gray-200 bg-white p-4 transition-colors hover:border-(--cp)/40"
        >
          <p className="text-xs font-medium text-gray-500">Non cotisants ({anneeScolaireCourante()})</p>
          <p className={`mt-1 text-2xl font-bold ${nonCotisants > 0 ? 'text-amber-600' : 'text-gray-900'}`}>
            {nonCotisants}
          </p>
          {nonCotisants > 0 && (
            <p className="mt-0.5 inline-flex items-center gap-1 text-xs text-amber-600">
              Voir la liste <ArrowRight className="h-3.5 w-3.5" strokeWidth={2} />
            </p>
          )}
        </Link>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Liste des scouts */}
        <div className="rounded-xl border border-gray-200 bg-white p-5 sm:p-6">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-800">Scouts de ma branche ({scouts.length})</h2>
            <Link
              href="/dashboard/scouts"
              className="inline-flex items-center gap-1 text-xs text-(--cp) hover:underline"
            >
              Voir tout <ArrowRight className="h-3.5 w-3.5" strokeWidth={2} />
            </Link>
          </div>
          {scouts.length === 0 ? (
            <p className="text-sm text-gray-400 italic">Aucun scout dans cette branche</p>
          ) : (
            <div className="space-y-2">
              {scouts.slice(0, 12).map((s) => (
                <Link
                  key={s.id}
                  href={`/dashboard/scouts/${s.id}`}
                  className="flex items-center gap-3 rounded-lg p-2 transition-colors hover:bg-gray-50"
                >
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full bg-gray-100 text-xs font-semibold text-gray-600">
                    {s.photo ? (
                      <Image
                        width={32}
                        height={32}
                        unoptimized
                        src={s.photo}
                        className="h-full w-full object-cover"
                        alt=""
                      />
                    ) : (
                      `${s.prenom[0]}${s.nom[0]}`
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-gray-900">
                      {s.prenom} {s.nom}
                    </p>
                    <p className="text-xs text-gray-400">{s.matricule ?? 'Sans matricule'}</p>
                  </div>
                  <span
                    className={`shrink-0 rounded-full px-2 py-0.5 text-xs ${s.actif ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}
                  >
                    {s.actif ? 'Actif' : 'Inactif'}
                  </span>
                </Link>
              ))}
              {scouts.length > 12 && (
                <p className="pt-1 text-center text-xs text-gray-400">+{scouts.length - 12} autres</p>
              )}
            </div>
          )}
        </div>

        {/* Activités récentes */}
        <div className="rounded-xl border border-gray-200 bg-white p-5 sm:p-6">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-800">Activités récentes</h2>
            <Link
              href="/dashboard/activites"
              className="inline-flex items-center gap-1 text-xs text-(--cp) hover:underline"
            >
              Voir tout <ArrowRight className="h-3.5 w-3.5" strokeWidth={2} />
            </Link>
          </div>
          {activites.length === 0 ? (
            <p className="text-sm text-gray-400 italic">Aucune activité enregistrée</p>
          ) : (
            <div className="space-y-3">
              {activites.map((a) => (
                <Link
                  key={a.id}
                  href={`/dashboard/activites/${a.id}`}
                  className="flex items-start gap-3 rounded-lg p-2 transition-colors hover:bg-gray-50"
                >
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-(--cp)/10">
                    {(() => {
                      const IconeType = ICONES_TYPE_ACTIVITE[a.type] ?? ICONES_TYPE_ACTIVITE.AUTRE
                      return <IconeType className="h-4 w-4 text-(--cp)" strokeWidth={2} />
                    })()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-gray-900">{a.titre}</p>
                    <p className="text-xs text-gray-400">
                      {new Date(a.dateDebut).toLocaleDateString('fr-FR', {
                        day: 'numeric',
                        month: 'long',
                        year: 'numeric',
                      })}
                      {' · '}
                      {LABELS_TYPE_ACTIVITE[a.type] ?? a.type}
                    </p>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
