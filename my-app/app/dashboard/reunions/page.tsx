'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import Link from 'next/link'
import { toast } from 'sonner'
import { ROLES_GROUPE, ROLES_BRANCHE } from '@/lib/roles'

const BRANCHES_ORDRE = ['OISILLONS', 'LOUVETEAUX', 'ECLAIREURS', 'CHEMINOTS', 'COMPAGNONS']
const BRANCHES: Record<string, string> = {
  OISILLONS: 'Oisillons', LOUVETEAUX: 'Louveteaux', ECLAIREURS: 'Éclaireurs',
  CHEMINOTS: 'Cheminots', COMPAGNONS: 'Compagnons',
}
const COULEURS_BRANCHE: Record<string, string> = {
  OISILLONS: 'bg-yellow-100 text-yellow-800',
  LOUVETEAUX: 'bg-blue-100 text-blue-800',
  ECLAIREURS: 'bg-green-100 text-green-800',
  CHEMINOTS: 'bg-orange-100 text-orange-800',
  COMPAGNONS: 'bg-purple-100 text-purple-800',
}
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
    const fetches: Promise<any>[] = [fetch('/api/reunions').then((r) => r.json())]
    if (estGroupe) fetches.push(fetch('/api/reunions/config').then((r) => r.json()))
    if (estBranche) fetches.push(fetch('/api/me/branche').then((r) => r.json()))

    Promise.all(fetches).then(([reunionsData, extra]) => {
      if (reunionsData.erreur) { toast.error(reunionsData.erreur); return }
      setReunions(reunionsData)
      if (estGroupe && extra) setConfigs(extra)
      if (estBranche && extra?.brancheType) setBrancheUtilisateur(extra.brancheType)
    }).catch(() => toast.error('Impossible de charger les réunions'))
      .finally(() => setChargement(false))
  }, [estGroupe, estBranche])

  const handleAnnuler = async (id: string) => {
    if (!confirm('Annuler cette réunion ?')) return
    const res = await fetch(`/api/reunions/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ statut: 'ANNULEE' }),
    })
    if (res.ok) setReunions((prev) => prev.map((r) => r.id === id ? { ...r, statut: 'ANNULEE' } : r))
  }

  const handleReporter = async () => {
    if (!modalReport || !nouvelleDate) return
    setSoumissionReport(true)
    const res = await fetch(`/api/reunions/${modalReport.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ statut: 'REPORTEE', dateReportee: new Date(nouvelleDate).toISOString() }),
    })
    if (res.ok) {
      const updated = await res.json()
      setReunions((prev) => prev.map((r) => r.id === updated.id ? { ...r, statut: 'REPORTEE', dateReportee: updated.dateReportee } : r))
      setModalReport(null)
      setNouvelleDate('')
    }
    setSoumissionReport(false)
  }

  const handleSaveConfig = (updated: Config) => {
    setConfigs((prev) => {
      const idx = prev.findIndex((c) => c.brancheType === updated.brancheType)
      if (idx >= 0) { const next = [...prev]; next[idx] = updated; return next }
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

  if (chargement) return (
    <div className="flex items-center justify-center h-48">
      <div className="w-6 h-6 border-2 border-[#1a4731] border-t-transparent rounded-full animate-spin" />
    </div>
  )
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Réunions</h1>
          <p className="text-sm text-gray-500 mt-0.5">Jours de réunion et feuilles de présences</p>
        </div>
        {peutCreer && (
          <Link href="/dashboard/reunions/nouveau"
            className="flex-shrink-0 flex items-center gap-1.5 bg-[#1a4731] text-white px-4 py-2 rounded-lg hover:bg-[#163d29] transition-colors text-sm font-medium">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Planifier
          </Link>
        )}
      </div>

      {/* Onglets */}
      {peutCreer && (
        <div className="flex gap-1 bg-gray-100 p-1 rounded-xl w-fit">
          {([['reunions', 'Réunions'], ['config', 'Configuration']] as const).map(([k, label]) => (
            <button key={k} onClick={() => setOnglet(k)}
              className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${onglet === k ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
              {label}
            </button>
          ))}
        </div>
      )}

      {/* === Onglet Configuration === */}
      {onglet === 'config' && peutCreer && (
        <div className="space-y-4">
          <p className="text-sm text-gray-500">
            Définissez le jour et l&apos;heure habituels de réunion pour chaque branche. Cette configuration s&apos;applique à toutes les années et pré-remplit le formulaire de planification.
          </p>
          {BRANCHES_ORDRE.map((branche) => {
            const cfg = configs.find((c) => c.brancheType === branche)
            return (
              <CarteConfig
                key={branche}
                branche={branche}
                config={cfg ?? null}
                onSave={handleSaveConfig}
              />
            )
          })}
        </div>
      )}

      {/* === Onglet Réunions === */}
      {onglet === 'reunions' && (
        <>
          <section>
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">À venir ({aVenir.length})</h2>
            {aVenir.length === 0 ? (
              <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
                <p className="text-gray-400 text-sm">Aucune réunion planifiée</p>
                {peutCreer && (
                  <Link href="/dashboard/reunions/nouveau" className="text-[#1a4731] text-sm font-medium hover:underline mt-2 inline-block">
                    Planifier la prochaine réunion →
                  </Link>
                )}
              </div>
            ) : (
              <div className="space-y-3">
                {aVenir.map((r) => <CarteReunion key={r.id} reunion={r} estGroupe={estGroupe} brancheUtilisateur={brancheUtilisateur} onAnnuler={handleAnnuler} onReporter={setModalReport} />)}
              </div>
            )}
          </section>

          {passees.length > 0 && (
            <section>
              <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Passées ({passees.length})</h2>
              <div className="space-y-3">
                {passees.map((r) => <CarteReunion key={r.id} reunion={r} estGroupe={estGroupe} brancheUtilisateur={brancheUtilisateur} onAnnuler={handleAnnuler} onReporter={setModalReport} />)}
              </div>
            </section>
          )}
        </>
      )}

      {/* Modal reporter */}
      {modalReport && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-6 space-y-4">
            <h2 className="text-base font-semibold text-gray-900">Reporter la réunion</h2>
            <p className="text-sm text-gray-500">
              {modalReport.titre || `Réunion du ${formatDate(dateEffective(modalReport))}`}
            </p>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Nouvelle date et heure</label>
              <input type="datetime-local" value={nouvelleDate} onChange={(e) => setNouvelleDate(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1a4731]" />
            </div>
            <div className="flex gap-3">
              <button onClick={handleReporter} disabled={!nouvelleDate || soumissionReport}
                className="flex-1 bg-[#1a4731] text-white py-2 rounded-lg text-sm font-medium hover:bg-[#163d29] disabled:opacity-60 transition-colors">
                {soumissionReport ? 'Enregistrement…' : 'Confirmer le report'}
              </button>
              <button onClick={() => { setModalReport(null); setNouvelleDate('') }}
                className="flex-1 border border-gray-300 text-gray-700 py-2 rounded-lg text-sm hover:bg-gray-50 transition-colors">
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
function CarteConfig({ branche, config, onSave }: {
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
    }
    setSauvegarde(false)
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <button onClick={() => setOuvert((o) => !o)}
        className="w-full flex items-center justify-between px-5 py-4 hover:bg-gray-50 transition-colors">
        <div className="flex items-center gap-3">
          <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${COULEURS_BRANCHE[branche] ?? 'bg-gray-100 text-gray-600'}`}>
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
          <svg className={`w-4 h-4 text-gray-400 transition-transform ${ouvert ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </button>

      {ouvert && (
        <div className="px-5 pb-5 border-t border-gray-100 pt-4 space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Jour</label>
              <select value={jourSemaine} onChange={(e) => setJourSemaine(parseInt(e.target.value))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#1a4731]">
                {JOURS.map((j, i) => <option key={i} value={i}>{j}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Heure</label>
              <input type="time" value={heureDebut} onChange={(e) => setHeureDebut(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1a4731]" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Durée (min)</label>
              <input type="number" value={dureeMinutes} onChange={(e) => setDureeMinutes(parseInt(e.target.value))}
                min="15" max="480" step="15"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1a4731]" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Lieu habituel</label>
              <input type="text" value={lieu} onChange={(e) => setLieu(e.target.value)}
                placeholder="Ex. Salle parois."
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#1a4731]" />
            </div>
          </div>
          <button onClick={handleSave} disabled={sauvegarde}
            className="bg-[#1a4731] text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-[#163d29] transition-colors disabled:opacity-60">
            {sauvegarde ? 'Enregistrement…' : 'Enregistrer'}
          </button>
        </div>
      )}
    </div>
  )
}

// --- Carte réunion ---
function CarteReunion({ reunion: r, estGroupe, brancheUtilisateur, onAnnuler, onReporter }: {
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
    <div className={`bg-white rounded-xl border border-gray-200 p-4 sm:p-5 ${r.statut === 'ANNULEE' ? 'opacity-60' : ''}`}>
      <div className="flex items-center gap-3">
        <div className="flex-shrink-0 w-11 h-11 rounded-xl bg-[#1a4731]/10 flex flex-col items-center justify-center">
          <span className="text-xs font-bold text-[#1a4731] leading-none">
            {date.toLocaleDateString('fr-FR', { day: '2-digit' })}
          </span>
          <span className="text-xs text-[#1a4731]/70 leading-none mt-0.5">
            {date.toLocaleDateString('fr-FR', { month: 'short' })}
          </span>
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-sm font-semibold text-gray-900 truncate">
              {r.titre || `Réunion ${r.brancheType ? BRANCHES[r.brancheType] : 'inter-branches'}`}
            </p>
            <span className={`text-xs px-2 py-0.5 rounded-full border font-medium flex-shrink-0 ${cfg.cls}`}>{cfg.label}</span>
          </div>
          <p className="text-xs text-gray-500 mt-0.5">
            {JOURS[date.getDay()]} · {formatHeure(date)}
            {r.dureeMinutes ? ` · ${r.dureeMinutes} min` : ''}
            {r.lieu ? ` · ${r.lieu}` : ''}
          </p>
          {r.brancheType && (
            <span className={`inline-block mt-1 text-xs px-2 py-0.5 rounded-full font-medium ${COULEURS_BRANCHE[r.brancheType] ?? 'bg-gray-100 text-gray-600'}`}>
              {BRANCHES[r.brancheType]}
            </span>
          )}
        </div>

        <div className="flex-shrink-0 flex items-center gap-2">
          {r.statut !== 'ANNULEE' && (
            <Link href={`/dashboard/reunions/${r.id}/presences`}
              className="text-xs bg-[#1a4731] text-white px-3 py-2 rounded-lg hover:bg-[#163d29] transition-colors whitespace-nowrap">
              {estPassee && r._count.presences > 0 ? 'Voir présences' : 'Présences'}
            </Link>
          )}

          {aActions && (
            <div className="relative">
              <button
                onClick={() => setMenuOuvert((o) => !o)}
                onBlur={() => setTimeout(() => setMenuOuvert(false), 150)}
                className="w-8 h-8 flex items-center justify-center rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors text-gray-500">
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                  <circle cx="12" cy="5" r="1.5" /><circle cx="12" cy="12" r="1.5" /><circle cx="12" cy="19" r="1.5" />
                </svg>
              </button>
              {menuOuvert && (
                <div className="absolute right-0 top-full mt-1 w-36 bg-white border border-gray-200 rounded-xl shadow-lg z-20 py-1 overflow-hidden">
                  <button onClick={() => { onReporter(r); setMenuOuvert(false) }}
                    className="w-full text-left px-4 py-2.5 text-sm text-orange-600 hover:bg-orange-50 transition-colors">
                    Reporter
                  </button>
                  <button onClick={() => { onAnnuler(r.id); setMenuOuvert(false) }}
                    className="w-full text-left px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 transition-colors">
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
