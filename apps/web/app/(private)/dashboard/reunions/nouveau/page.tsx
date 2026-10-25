'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useSession } from '@/lib/session-client'
import Link from 'next/link'
import { toast } from 'sonner'
import { LABELS_BRANCHES, ORDRE_CATEGORIES_SCOUTS } from '@scout/shared'
import { BackLink } from '@/components/ui/BackLink'
import { CalendarDays, Repeat, Check } from '@/lib/icons'

const CLS_INPUT =
  'w-full border border-stone-300 rounded-lg px-3 py-2 text-sm text-stone-900 placeholder:text-stone-400 bg-white focus:outline-none focus:ring-2 focus:ring-(--cp) focus:border-transparent'
const CLS_SELECT =
  'w-full border border-stone-300 rounded-lg px-3 py-2 text-sm text-stone-900 bg-white focus:outline-none focus:ring-2 focus:ring-(--cp) focus:border-transparent'
const CLS_LABEL = 'block text-sm font-medium text-stone-700 mb-1'

const BRANCHES = [
  { value: '', label: 'Toutes les branches' },
  ...ORDRE_CATEGORIES_SCOUTS.map((branche) => ({ value: branche, label: LABELS_BRANCHES[branche] })),
]
const JOURS_SEMAINE = [
  { value: 0, label: 'Dimanche' },
  { value: 1, label: 'Lundi' },
  { value: 2, label: 'Mardi' },
  { value: 3, label: 'Mercredi' },
  { value: 4, label: 'Jeudi' },
  { value: 5, label: 'Vendredi' },
  { value: 6, label: 'Samedi' },
]

interface Config {
  brancheType: string
  jourSemaine: number
  heureDebut: string
  dureeMinutes: number
  lieu: string | null
}

function genererDates(jourSemaine: number, heure: string, dateDebut: string, dateFin: string): string[] {
  const dates: string[] = []
  const [h, m] = heure.split(':').map(Number)
  const cursor = new Date(dateDebut)
  const fin = new Date(dateFin)
  while (cursor.getDay() !== jourSemaine) cursor.setDate(cursor.getDate() + 1)
  while (cursor <= fin) {
    const d = new Date(cursor)
    d.setHours(h, m, 0, 0)
    dates.push(d.toISOString())
    cursor.setDate(cursor.getDate() + 7)
  }
  return dates
}

const ROLES_BRANCHE = ['RESPONSABLE_BRANCHE', 'ADJOINT_BRANCHE', 'ASSISTANT_BRANCHE']

export default function PageNouvelleReunion() {
  const router = useRouter()
  const { data: session } = useSession()
  const estBranche = ROLES_BRANCHE.includes(session?.user?.role ?? '')

  const [configs, setConfigs] = useState<Config[]>([])
  const [mode, setMode] = useState<'unique' | 'serie'>('serie')
  const [brancheVerrouillee, setBrancheVerrouillee] = useState<string | null>(null)

  const [brancheType, setBrancheType] = useState('')
  const [titre, setTitre] = useState('')
  const [lieuSaisi, setLieu] = useState<string | null>(null)
  const [dureeSaisie, setDureeMinutes] = useState<string | null>(null)
  const [notes, setNotes] = useState('')

  // Mode unique
  const [dateHeure, setDateHeure] = useState('')

  // Mode série
  const [jourSaisi, setJourSemaine] = useState<number | null>(null)
  const [heureSaisie, setHeure] = useState<string | null>(null)
  const [dateDebut, setDateDebut] = useState('')
  const [dateFin, setDateFin] = useState('')

  const [configModifiee, setConfigModifiee] = useState(false)
  const configBranche = configs.find((c) => c.brancheType === brancheType)
  const lieu = lieuSaisi ?? configBranche?.lieu ?? ''
  const dureeMinutes = dureeSaisie ?? configBranche?.dureeMinutes.toString() ?? '90'
  const jourSemaine = jourSaisi ?? configBranche?.jourSemaine ?? 6
  const heure = heureSaisie ?? configBranche?.heureDebut ?? '09:00'
  const configAppliquee = Boolean(configBranche) && !configModifiee
  const [soumission, setSoumission] = useState(false)

  useEffect(() => {
    Promise.all([
      fetch('/api/reunions/config').then((r) => r.json() as Promise<Config[]>),
      estBranche
        ? fetch('/api/me/branche').then((r) => r.json() as Promise<{ brancheType?: string }>)
        : Promise.resolve(null),
    ])
      .then(([configsData, brancheData]) => {
        if (Array.isArray(configsData)) setConfigs(configsData)
        if (brancheData?.brancheType) {
          setBrancheVerrouillee(brancheData.brancheType)
          setBrancheType(brancheData.brancheType)
        }
      })
      .catch(() => toast.error('Impossible de charger la configuration des réunions'))
  }, [estBranche])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    let dates: string[] = []

    if (mode === 'unique') {
      if (!dateHeure) {
        toast.error('La date et heure sont requises')
        return
      }
      dates = [new Date(dateHeure).toISOString()]
    } else {
      if (!dateDebut || !dateFin) {
        toast.error('Les dates de début et de fin sont requises')
        return
      }
      if (new Date(dateFin) <= new Date(dateDebut)) {
        toast.error('La date de fin doit être après la date de début')
        return
      }
      dates = genererDates(jourSemaine, heure, dateDebut, dateFin)
      if (dates.length === 0) {
        toast.error('Aucune date générée avec ces paramètres')
        return
      }
      if (dates.length > 60) {
        toast.error('Maximum 60 réunions par création en série')
        return
      }
    }

    setSoumission(true)
    try {
      const res = await fetch('/api/reunions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dates,
          brancheType: brancheType || null,
          titre: titre || null,
          lieu: lieu || null,
          dureeMinutes: dureeMinutes ? parseInt(dureeMinutes) : null,
          notes: notes || null,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.erreur ?? 'Erreur serveur')
        return
      }
      router.push('/dashboard/reunions')
    } catch {
      toast.error('Erreur lors de la création')
    } finally {
      setSoumission(false)
    }
  }

  const previewDates =
    mode === 'serie' && dateDebut && dateFin && heure ? genererDates(jourSemaine, heure, dateDebut, dateFin) : []

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <BackLink href="/dashboard/reunions">Retour</BackLink>
        <h1 className="text-xl font-bold text-stone-900 sm:text-2xl">Planifier une réunion</h1>
      </div>

      <form onSubmit={handleSubmit}>
        <div className="space-y-5 rounded-xl border border-stone-200 bg-white p-5 sm:p-6">
          {/* Mode */}
          <div>
            <label className={CLS_LABEL}>Type de planification</label>
            <div className="flex gap-3">
              {(['serie', 'unique'] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setMode(m)}
                  className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg border py-2.5 text-sm font-medium transition-colors ${mode === m ? 'border-(--cp) bg-(--cp) text-white' : 'border-stone-300 text-stone-600 hover:bg-stone-50'}`}
                >
                  {m === 'unique' ? (
                    <CalendarDays className="h-4 w-4" strokeWidth={2} />
                  ) : (
                    <Repeat className="h-4 w-4" strokeWidth={2} />
                  )}
                  {m === 'unique' ? 'Réunion unique' : 'Série hebdomadaire'}
                </button>
              ))}
            </div>
          </div>

          {/* Branche + Titre */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className={CLS_LABEL}>Branche</label>
              {brancheVerrouillee ? (
                <div className="flex items-center gap-2 rounded-lg border border-stone-200 bg-stone-50 px-3 py-2">
                  <span className="text-sm font-medium text-stone-700">
                    {BRANCHES.find((b) => b.value === brancheVerrouillee)?.label ?? brancheVerrouillee}
                  </span>
                  <span className="ml-auto text-xs text-stone-400">Votre branche</span>
                </div>
              ) : (
                <select
                  value={brancheType}
                  onChange={(e) => {
                    setBrancheType(e.target.value)
                    setLieu(null)
                    setDureeMinutes(null)
                    setJourSemaine(null)
                    setHeure(null)
                    setConfigModifiee(false)
                  }}
                  className={CLS_SELECT}
                >
                  {BRANCHES.map((b) => (
                    <option key={b.value} value={b.value}>
                      {b.label}
                    </option>
                  ))}
                </select>
              )}
              {configAppliquee && (
                <p className="mt-1 inline-flex items-center gap-1 text-xs text-(--cp)">
                  <Check className="h-3 w-3" strokeWidth={2.5} />
                  Jour habituel pré-rempli depuis la configuration
                </p>
              )}
            </div>
            <div>
              <label className={CLS_LABEL}>
                Titre <span className="text-xs font-normal text-stone-400">(optionnel)</span>
              </label>
              <input
                type="text"
                value={titre}
                onChange={(e) => setTitre(e.target.value)}
                placeholder="Ex. Réunion de rentrée"
                className={CLS_INPUT}
              />
            </div>
          </div>

          {/* Mode unique */}
          {mode === 'unique' && (
            <div>
              <label className={CLS_LABEL}>
                Date et heure <span className="text-red-500">*</span>
              </label>
              <input
                type="datetime-local"
                value={dateHeure}
                onChange={(e) => setDateHeure(e.target.value)}
                className={CLS_INPUT}
              />
            </div>
          )}

          {/* Mode série */}
          {mode === 'serie' && (
            <div className="space-y-4 rounded-xl border border-stone-100 bg-stone-50 p-4">
              <p className="text-xs font-medium tracking-wide text-stone-500 uppercase">Paramètres de la série</p>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <div>
                  <label className={CLS_LABEL}>Jour de la semaine</label>
                  <select
                    value={jourSemaine}
                    onChange={(e) => {
                      setJourSemaine(parseInt(e.target.value))
                      setConfigModifiee(true)
                    }}
                    className={CLS_SELECT}
                  >
                    {JOURS_SEMAINE.map((j) => (
                      <option key={j.value} value={j.value}>
                        {j.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className={CLS_LABEL}>Heure</label>
                  <input
                    type="time"
                    value={heure}
                    onChange={(e) => {
                      setHeure(e.target.value)
                      setConfigModifiee(true)
                    }}
                    className={CLS_INPUT}
                  />
                </div>
                <div>
                  <label className={CLS_LABEL}>Durée (min)</label>
                  <input
                    type="number"
                    value={dureeMinutes}
                    onChange={(e) => setDureeMinutes(e.target.value)}
                    min="15"
                    max="480"
                    step="15"
                    className={CLS_INPUT}
                  />
                </div>
                <div>
                  <label className={CLS_LABEL}>Lieu</label>
                  <input
                    type="text"
                    value={lieu}
                    onChange={(e) => setLieu(e.target.value)}
                    placeholder="Salle parois."
                    className={CLS_INPUT}
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className={CLS_LABEL}>
                    Du <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="date"
                    value={dateDebut}
                    onChange={(e) => setDateDebut(e.target.value)}
                    className={CLS_INPUT}
                  />
                </div>
                <div>
                  <label className={CLS_LABEL}>
                    Au <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="date"
                    value={dateFin}
                    onChange={(e) => setDateFin(e.target.value)}
                    className={CLS_INPUT}
                  />
                </div>
              </div>
              {previewDates.length > 0 && (
                <div className="rounded-lg bg-(--cp)/5 px-3 py-2 text-xs text-(--cp)">
                  <span className="font-medium">
                    {previewDates.length} réunion{previewDates.length > 1 ? 's' : ''} seront créées
                  </span>
                  {previewDates.length <= 6 && (
                    <span className="ml-1 text-stone-500">
                      —{' '}
                      {previewDates
                        .map((d) =>
                          new Date(d).toLocaleDateString('fr-FR', { weekday: 'short', day: '2-digit', month: 'short' }),
                        )
                        .join(', ')}
                    </span>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Lieu + Durée en mode unique */}
          {mode === 'unique' && (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className={CLS_LABEL}>
                  Lieu <span className="text-xs font-normal text-stone-400">(optionnel)</span>
                </label>
                <input
                  type="text"
                  value={lieu}
                  onChange={(e) => setLieu(e.target.value)}
                  placeholder="Ex. Salle paroissiale"
                  className={CLS_INPUT}
                />
              </div>
              <div>
                <label className={CLS_LABEL}>Durée (min)</label>
                <input
                  type="number"
                  value={dureeMinutes}
                  onChange={(e) => setDureeMinutes(e.target.value)}
                  min="15"
                  max="480"
                  step="15"
                  className={CLS_INPUT}
                />
              </div>
            </div>
          )}

          {/* Notes */}
          <div>
            <label className={CLS_LABEL}>
              Notes <span className="text-xs font-normal text-stone-400">(optionnel)</span>
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              placeholder="Programme, consignes particulières…"
              className="w-full resize-none rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm text-stone-900 placeholder:text-stone-400 focus:ring-2 focus:ring-(--cp) focus:outline-none"
            />
          </div>

          <div className="flex flex-col gap-3 pt-2 sm:flex-row">
            <button
              type="submit"
              disabled={soumission}
              className="rounded-lg bg-(--cp) px-6 py-2.5 text-sm font-medium text-white transition-all hover:brightness-110 disabled:opacity-60 sm:flex-none"
            >
              {soumission
                ? 'Création…'
                : mode === 'serie'
                  ? `Créer ${previewDates.length > 0 ? previewDates.length + ' ' : ''}réunion${previewDates.length > 1 ? 's' : ''}`
                  : 'Créer la réunion'}
            </button>
            <Link
              href="/dashboard/reunions"
              className="inline-flex items-center justify-center rounded-lg border border-stone-300 px-4 py-2.5 text-sm text-stone-700 transition-colors hover:bg-stone-50"
            >
              Annuler
            </Link>
          </div>
        </div>
      </form>
    </div>
  )
}
