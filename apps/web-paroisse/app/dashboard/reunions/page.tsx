'use client'

import { useState, useEffect } from 'react'
import { useSession } from '@/lib/session-client'
import Link from 'next/link'
import { toast } from 'sonner'
import { ROLES_GROUPE, ROLES_BRANCHE } from '@scout/shared'
import {
  LABELS_BRANCHES as BRANCHES,
  COULEURS_BRANCHES as COULEURS_BRANCHE,
  ORDRE_BRANCHES as BRANCHES_ORDRE,
} from '@scout/shared'
import { confirmer } from '@/app/components/ConfirmDialog'
import { Plus, ChevronDown, ArrowRight } from '@/lib/icons'
import { MoreVertical } from 'lucide-react'

const JOURS = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi']

const STATUT_CONFIG: Record<string, { label: string; cls: string }> = {
  PLANIFIEE: { label: 'Planifiée', cls: 'bg-blue-50 text-blue-700 border-blue-100' },
  REPORTEE: { label: 'Reportée', cls: 'bg-orange-50 text-orange-700 border-orange-100' },
  ANNULEE: { label: 'Annulée', cls: 'bg-red-50 text-red-700 border-red-100' },
  TERMINEE: { label: 'Terminée', cls: 'bg-gray-100 text-gray-500 border-gray-200' },
}

interface Reunion {
  id: string
  brancheType: string | null
  titre: string | null
  dateHeure: string
  dateReportee: string | null
  lieu: string | null
  statut: string
  dureeMinutes: number | null
  _count: { presences: number }
  creeParUtilisateur: { prenom: string; nom: string }
}

interface Config {
  id: string
  brancheType: string
  jourSemaine: number
  heureDebut: string
  dureeMinutes: number
  lieu: string | null
}

function dateEffective(r: Reunion) {
  return new Date(r.dateReportee ?? r.dateHeure)
}

function formatDate(d: Date) {
  return d.toLocaleDateString('fr-FR', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })
}
function formatHeure(d: Date) {
  return d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
}

export default function PageReunions() {
  const { data: session } = useSession()
  const role = session?.user?.role ?? ''
  const estGroupe = ROLES_GROUPE.includes(role)
  const estBranche = ROLES_BRANCHE.includes(role)
  const peutCreer = estGroupe || estBranche
  // Configuration des jours de réunion : PUT /api/reunions/config réservé au Chef de Groupe.
  const peutConfigurer = estGroupe

  const [reunions, setReunions] = useState<Reunion[]>([])
  const [configs, setConfigs] = useState<Config[]>([])
  const [brancheUtilisateur, setBrancheUtilisateur] = useState<string | null>(null)
  const [chargement, setChargement] = useState(true)
  const [onglet, setOnglet] = useState<'reunions' | 'config'>('reunions')

  // Modal reporter
  const [modalReport, setModalReport] = useState<Reunion | null>(null)
  const [nouvelleDate, setNouvelleDate] = useState('')
  const [soumissionReport, setSoumissionReport] = useState(false)

  useEffect(() => {
    Promise.all([
      fetch('/api/reunions').then((r) => r.json() as Promise<Reunion[] | { erreur: string }>),
      estGroupe ? fetch('/api/reunions/config').then((r) => r.json() as Promise<Config[]>) : Promise.resolve(null),
      estBranche
        ? fetch('/api/me/branche').then((r) => r.json() as Promise<{ brancheType?: string }>)
        : Promise.resolve(null),
    ])
      .then(([reunionsData, configsData, brancheData]) => {
        if (!Array.isArray(reunionsData)) {
          toast.error(reunionsData.erreur)
          return
        }
        setReunions(reunionsData)
        if (configsData && Array.isArray(configsData)) setConfigs(configsData)
        if (brancheData?.brancheType) setBrancheUtilisateur(brancheData.brancheType)
      })
      .catch(() => toast.error('Impossible de charger les réunions'))
      .finally(() => setChargement(false))
  }, [estGroupe, estBranche])

  const handleAnnuler = async (id: string) => {
    const cible = reunions.find((r) => r.id === id)
    const nomReunion = cible
      ? (cible.titre || `du ${formatDate(dateEffective(cible))}`) +
        (cible.brancheType ? ` (${BRANCHES[cible.brancheType]})` : '')
      : 'cette réunion'
    const ok = await confirmer({
      titre: 'Annuler cette réunion ?',
      description: `La réunion "${nomReunion}" sera marquée comme annulée. Les présences déjà enregistrées seront conservées, mais cette réunion ne pourra plus être remise à l'état planifié depuis cette page.`,
      labelConfirmer: 'Annuler la réunion',
      danger: true,
    })
    if (!ok) return
    try {
      const res = await fetch(`/api/reunions/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ statut: 'ANNULEE' }),
      })
      if (res.ok) {
        setReunions((prev) => prev.map((r) => (r.id === id ? { ...r, statut: 'ANNULEE' } : r)))
        toast.success('Réunion annulée')
      } else {
        const data = await res.json().catch(() => ({}))
        toast.error(data.erreur ?? 'Impossible d’annuler la réunion')
      }
    } catch {
      toast.error('Impossible d’annuler la réunion')
    }
  }

  const handleReporter = async () => {
    if (!modalReport || !nouvelleDate) return
    setSoumissionReport(true)
    try {
      const res = await fetch(`/api/reunions/${modalReport.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ statut: 'REPORTEE', dateReportee: new Date(nouvelleDate).toISOString() }),
      })
      if (res.ok) {
        const updated = await res.json()
        setReunions((prev) =>
          prev.map((r) => (r.id === updated.id ? { ...r, statut: 'REPORTEE', dateReportee: updated.dateReportee } : r)),
        )
        setModalReport(null)
        setNouvelleDate('')
        toast.success('Réunion reportée')
      } else {
        const data = await res.json().catch(() => ({}))
        toast.error(data.erreur ?? 'Impossible de reporter la réunion')
      }
    } catch {
      toast.error('Impossible de reporter la réunion')
    } finally {
      setSoumissionReport(false)
    }
  }

  const handleSaveConfig = (updated: Config) => {
    setConfigs((prev) => {
      const idx = prev.findIndex((c) => c.brancheType === updated.brancheType)
      if (idx >= 0) {
        const next = [...prev]
        next[idx] = updated
        return next
      }
      return [...prev, updated]
    })
  }

  const maintenant = new Date()
  const aVenir = reunions
    .filter((r) => r.statut !== 'ANNULEE' && dateEffective(r) >= maintenant)
    .sort((a, b) => dateEffective(a).getTime() - dateEffective(b).getTime())
  const passees = reunions
    .filter((r) => r.statut === 'ANNULEE' || dateEffective(r) < maintenant)
    .sort((a, b) => dateEffective(b).getTime() - dateEffective(a).getTime())

  if (chargement)
    return (
      <div className="flex h-48 items-center justify-center">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-(--cp) border-t-transparent" />
      </div>
    )
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-gray-900 sm:text-2xl">Réunions</h1>
          <p className="mt-0.5 text-sm text-gray-500">Jours de réunion et feuilles de présences</p>
        </div>
        {peutCreer && (
          <Link
            href="/dashboard/reunions/nouveau"
            className="flex shrink-0 items-center gap-1.5 rounded-lg bg-(--cp) px-4 py-2 text-sm font-medium text-white transition-all hover:brightness-110"
          >
            <Plus className="h-4 w-4" strokeWidth={2} />
            Planifier
          </Link>
        )}
      </div>

      {/* Onglets */}
      {peutConfigurer && (
        <div className="flex w-fit gap-1 rounded-xl bg-gray-100 p-1">
          {(
            [
              ['reunions', 'Réunions'],
              ['config', 'Configuration'],
            ] as const
          ).map(([k, label]) => (
            <button
              key={k}
              onClick={() => setOnglet(k)}
              className={`rounded-lg px-4 py-1.5 text-sm font-medium transition-colors ${onglet === k ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
            >
              {label}
            </button>
          ))}
        </div>
      )}

      {/* === Onglet Configuration === */}
      {onglet === 'config' && peutConfigurer && (
        <div className="space-y-4">
          <p className="text-sm text-gray-500">
            Définissez le jour et l&apos;heure habituels de réunion pour chaque branche. Cette configuration
            s&apos;applique à toutes les années et pré-remplit le formulaire de planification.
          </p>
          {BRANCHES_ORDRE.map((branche) => {
            const cfg = configs.find((c) => c.brancheType === branche)
            return <CarteConfig key={branche} branche={branche} config={cfg ?? null} onSave={handleSaveConfig} />
          })}
        </div>
      )}

      {/* === Onglet Réunions === */}
      {onglet === 'reunions' && (
        <>
          <section>
            <h2 className="mb-3 text-sm font-semibold tracking-wide text-gray-500 uppercase">
              À venir ({aVenir.length})
            </h2>
            {aVenir.length === 0 ? (
              <div className="rounded-xl border border-gray-200 bg-white p-8 text-center">
                <p className="text-sm text-gray-400">Aucune réunion planifiée</p>
                {peutCreer && (
                  <Link
                    href="/dashboard/reunions/nouveau"
                    className="mt-2 inline-flex items-center gap-1 text-sm font-medium text-(--cp) hover:underline"
                  >
                    Planifier la prochaine réunion
                    <ArrowRight className="h-3.5 w-3.5" strokeWidth={2} />
                  </Link>
                )}
              </div>
            ) : (
              <div className="space-y-3">
                {aVenir.map((r) => (
                  <CarteReunion
                    key={r.id}
                    reunion={r}
                    estGroupe={estGroupe}
                    brancheUtilisateur={brancheUtilisateur}
                    onAnnuler={handleAnnuler}
                    onReporter={setModalReport}
                  />
                ))}
              </div>
            )}
          </section>

          {passees.length > 0 && (
            <section>
              <h2 className="mb-3 text-sm font-semibold tracking-wide text-gray-500 uppercase">
                Passées ({passees.length})
              </h2>
              <div className="space-y-3">
                {passees.map((r) => (
                  <CarteReunion
                    key={r.id}
                    reunion={r}
                    estGroupe={estGroupe}
                    brancheUtilisateur={brancheUtilisateur}
                    onAnnuler={handleAnnuler}
                    onReporter={setModalReport}
                  />
                ))}
              </div>
            </section>
          )}
        </>
      )}

      {/* Modal reporter */}
      {modalReport && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-sm space-y-4 rounded-xl bg-white p-6 shadow-xl">
            <h2 className="text-base font-semibold text-gray-900">Reporter la réunion</h2>
            <p className="text-sm text-gray-500">
              {modalReport.titre || `Réunion du ${formatDate(dateEffective(modalReport))}`}
            </p>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Nouvelle date et heure</label>
              <input
                type="datetime-local"
                value={nouvelleDate}
                onChange={(e) => setNouvelleDate(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-(--cp) focus:outline-none"
              />
            </div>
            <div className="flex gap-3">
              <button
                onClick={handleReporter}
                disabled={!nouvelleDate || soumissionReport}
                className="flex-1 rounded-lg bg-(--cp) py-2 text-sm font-medium text-white transition-all hover:brightness-110 disabled:opacity-60"
              >
                {soumissionReport ? 'Enregistrement…' : 'Confirmer le report'}
              </button>
              <button
                onClick={() => {
                  setModalReport(null)
                  setNouvelleDate('')
                }}
                className="flex-1 rounded-lg border border-gray-300 py-2 text-sm text-gray-700 transition-colors hover:bg-gray-50"
              >
                Annuler
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// --- Carte configuration par branche ---
function CarteConfig({
  branche,
  config,
  onSave,
}: {
  branche: string
  config: Config | null
  onSave: (c: Config) => void
}) {
  const [ouvert, setOuvert] = useState(false)
  const [jourSemaine, setJourSemaine] = useState(config?.jourSemaine ?? 6)
  const [heureDebut, setHeureDebut] = useState(config?.heureDebut ?? '09:00')
  const [dureeMinutes, setDureeMinutes] = useState(config?.dureeMinutes ?? 90)
  const [lieu, setLieu] = useState(config?.lieu ?? '')
  const [sauvegarde, setSauvegarde] = useState(false)

  const handleSave = async () => {
    setSauvegarde(true)
    try {
      const res = await fetch('/api/reunions/config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ brancheType: branche, jourSemaine, heureDebut, dureeMinutes, lieu: lieu || null }),
      })
      if (res.ok) {
        const data = await res.json()
        onSave(data)
        toast.success('Enregistré')
        setOuvert(false)
      } else {
        const data = await res.json().catch(() => ({}))
        toast.error(data.erreur ?? 'Impossible d’enregistrer la configuration')
      }
    } catch {
      toast.error('Impossible d’enregistrer la configuration')
    } finally {
      setSauvegarde(false)
    }
  }

  return (
    <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
      <button
        onClick={() => setOuvert((o) => !o)}
        className="flex w-full items-center justify-between px-5 py-4 transition-colors hover:bg-gray-50"
      >
        <div className="flex items-center gap-3">
          <span
            className={`rounded-full px-2.5 py-1 text-xs font-medium ${COULEURS_BRANCHE[branche] ?? 'bg-gray-100 text-gray-600'}`}
          >
            {BRANCHES[branche]}
          </span>
          {config ? (
            <span className="text-sm text-gray-600">
              {JOURS[config.jourSemaine]} · {config.heureDebut}
              {config.lieu ? ` · ${config.lieu}` : ''}
            </span>
          ) : (
            <span className="text-sm text-gray-400 italic">Non configuré</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <ChevronDown
            className={`h-4 w-4 text-gray-400 transition-transform ${ouvert ? 'rotate-180' : ''}`}
            strokeWidth={2}
          />
        </div>
      </button>

      {ouvert && (
        <div className="space-y-4 border-t border-gray-100 px-5 pt-4 pb-5">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600">Jour</label>
              <select
                value={jourSemaine}
                onChange={(e) => setJourSemaine(parseInt(e.target.value))}
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:ring-2 focus:ring-(--cp) focus:outline-none"
              >
                {JOURS.map((j, i) => (
                  <option key={i} value={i}>
                    {j}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600">Heure</label>
              <input
                type="time"
                value={heureDebut}
                onChange={(e) => setHeureDebut(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-(--cp) focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600">Durée (min)</label>
              <input
                type="number"
                value={dureeMinutes}
                onChange={(e) => setDureeMinutes(parseInt(e.target.value))}
                min="15"
                max="480"
                step="15"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-(--cp) focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600">Lieu habituel</label>
              <input
                type="text"
                value={lieu}
                onChange={(e) => setLieu(e.target.value)}
                placeholder="Ex. Salle parois."
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm placeholder:text-gray-400 focus:ring-2 focus:ring-(--cp) focus:outline-none"
              />
            </div>
          </div>
          <button
            onClick={handleSave}
            disabled={sauvegarde}
            className="rounded-lg bg-(--cp) px-4 py-2 text-sm font-medium text-white transition-all hover:brightness-110 disabled:opacity-60"
          >
            {sauvegarde ? 'Enregistrement…' : 'Enregistrer'}
          </button>
        </div>
      )}
    </div>
  )
}

// --- Carte réunion ---
function CarteReunion({
  reunion: r,
  estGroupe,
  brancheUtilisateur,
  onAnnuler,
  onReporter,
}: {
  reunion: Reunion
  estGroupe: boolean
  brancheUtilisateur: string | null
  onAnnuler: (id: string) => void
  onReporter: (r: Reunion) => void
}) {
  const [menuOuvert, setMenuOuvert] = useState(false)
  const date = dateEffective(r)
  const estPassee = date < new Date() || r.statut === 'ANNULEE' || r.statut === 'TERMINEE'
  const cfg = STATUT_CONFIG[r.statut] ?? STATUT_CONFIG.PLANIFIEE

  // Un chef de branche peut agir sur les réunions de sa propre branche uniquement
  const peutModifier = estGroupe || (brancheUtilisateur !== null && r.brancheType === brancheUtilisateur)
  const aActions = peutModifier && r.statut === 'PLANIFIEE'

  return (
    <div
      className={`rounded-xl border border-gray-200 bg-white p-4 sm:p-5 ${r.statut === 'ANNULEE' ? 'opacity-60' : ''}`}
    >
      <div className="flex items-center gap-3">
        <div className="flex h-11 w-11 shrink-0 flex-col items-center justify-center rounded-xl bg-(--cp)/10">
          <span className="text-xs leading-none font-bold text-(--cp)">
            {date.toLocaleDateString('fr-FR', { day: '2-digit' })}
          </span>
          <span className="mt-0.5 text-xs leading-none text-(--cp)/70">
            {date.toLocaleDateString('fr-FR', { month: 'short' })}
          </span>
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="truncate text-sm font-semibold text-gray-900">
              {r.titre || `Réunion ${r.brancheType ? BRANCHES[r.brancheType] : 'inter-branches'}`}
            </p>
            <span className={`shrink-0 rounded-full border px-2 py-0.5 text-xs font-medium ${cfg.cls}`}>
              {cfg.label}
            </span>
          </div>
          <p className="mt-0.5 text-xs text-gray-500">
            {JOURS[date.getDay()]} · {formatHeure(date)}
            {r.dureeMinutes ? ` · ${r.dureeMinutes} min` : ''}
            {r.lieu ? ` · ${r.lieu}` : ''}
          </p>
          {r.brancheType && (
            <span
              className={`mt-1 inline-block rounded-full px-2 py-0.5 text-xs font-medium ${COULEURS_BRANCHE[r.brancheType] ?? 'bg-gray-100 text-gray-600'}`}
            >
              {BRANCHES[r.brancheType]}
            </span>
          )}
        </div>

        <div className="flex shrink-0 items-center gap-2">
          {r.statut !== 'ANNULEE' && (
            <Link
              href={`/dashboard/reunions/${r.id}/presences`}
              className="rounded-lg bg-(--cp) px-3 py-2 text-xs whitespace-nowrap text-white transition-all hover:brightness-110"
            >
              {estPassee && r._count.presences > 0 ? 'Voir présences' : 'Présences'}
            </Link>
          )}

          {aActions && (
            <div className="relative">
              <button
                onClick={() => setMenuOuvert((o) => !o)}
                onBlur={() => setTimeout(() => setMenuOuvert(false), 150)}
                className="flex h-8 w-8 items-center justify-center rounded-lg border border-gray-200 text-gray-500 transition-colors hover:bg-gray-50"
              >
                <MoreVertical className="h-4 w-4" strokeWidth={2} />
              </button>
              {menuOuvert && (
                <div className="absolute top-full right-0 z-20 mt-1 w-36 overflow-hidden rounded-xl border border-gray-200 bg-white py-1 shadow-lg">
                  <button
                    onClick={() => {
                      onReporter(r)
                      setMenuOuvert(false)
                    }}
                    className="w-full px-4 py-2.5 text-left text-sm text-orange-600 transition-colors hover:bg-orange-50"
                  >
                    Reporter
                  </button>
                  <button
                    onClick={() => {
                      onAnnuler(r.id)
                      setMenuOuvert(false)
                    }}
                    className="w-full px-4 py-2.5 text-left text-sm text-red-600 transition-colors hover:bg-red-50"
                  >
                    Annuler
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
