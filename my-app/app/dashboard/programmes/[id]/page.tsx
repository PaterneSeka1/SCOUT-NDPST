'use client'

import { use, useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import Link from 'next/link'
import { toast } from 'sonner'
import { confirmer } from '@/app/components/ConfirmDialog'
import { ROLES_GROUPE, ROLES_BRANCHE } from '@/lib/roles'
import { LABELS_BRANCHES as BRANCHES, COULEURS_BRANCHES as COULEURS_BRANCHE } from '@/lib/branches'
import { BackLink } from '@/app/components/ui/BackLink'
import { Check, ChevronDown } from '@/lib/icons'
import { ChevronUp } from 'lucide-react'

const CLS_INPUT = 'w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 bg-white focus:outline-none focus:ring-2 focus:ring-[var(--cp)] focus:border-transparent'
const CLS_LABEL = 'block text-xs font-medium text-gray-600 mb-1'

interface Ligne {
  id: string
  theme: string
  objectif: string | null
  datePrevue: string | null
  ordre: number
  activite: { id: string; titre: string; dateDebut: string } | null
}

interface Programme {
  id: string
  titre: string
  description: string | null
  periodeDebut: string
  periodeFin: string
  brancheType: string | null
  creeParUtilisateur: { prenom: string; nom: string }
  lignes: Ligne[]
}

function formatDate(d: string) {
  return new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })
}

export default function PageDetailProgramme({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  const { data: session } = useSession()
  const role = session?.user?.role ?? ''
  const peutGerer = ROLES_GROUPE.includes(role) || ROLES_BRANCHE.includes(role)

  const [programme, setProgramme] = useState<Programme | null>(null)
  const [chargement, setChargement] = useState(true)
  const [modifierMeta, setModifierMeta] = useState(false)

  // Formulaire édition métadonnées
  const [titre, setTitre] = useState('')
  const [description, setDescription] = useState('')
  const [periodeDebut, setPeriodeDebut] = useState('')
  const [periodeFin, setPeriodeFin] = useState('')

  // Formulaire nouvelle ligne
  const [theme, setTheme] = useState('')
  const [objectif, setObjectif] = useState('')
  const [datePrevue, setDatePrevue] = useState('')
  const [ajoutEnCours, setAjoutEnCours] = useState(false)

  const charger = useCallback(() => {
    fetch(`/api/programmes/${id}`).then((r) => r.json()).then((data) => {
      if (data.erreur) { toast.error(data.erreur); return }
      setProgramme(data)
      setTitre(data.titre)
      setDescription(data.description ?? '')
      setPeriodeDebut(data.periodeDebut.slice(0, 10))
      setPeriodeFin(data.periodeFin.slice(0, 10))
    }).catch(() => toast.error('Impossible de charger le programme'))
      .finally(() => setChargement(false))
  }, [id])

  useEffect(() => { charger() }, [charger])

  async function handleSupprimerProgramme() {
    if (!programme) return
    const ok = await confirmer({
      titre: `Supprimer le programme "${programme.titre}" ?`,
      description: 'Ce programme et toutes ses lignes (thèmes planifiés) seront définitivement supprimés. Cette action est irréversible.',
      labelConfirmer: 'Supprimer',
      danger: true,
    })
    if (!ok) return
    const res = await fetch(`/api/programmes/${id}`, { method: 'DELETE' })
    if (!res.ok) { const d = await res.json().catch(() => ({})); toast.error(d.erreur ?? 'Erreur serveur'); return }
    router.push('/dashboard/programmes')
  }

  async function handleEnregistrerMeta() {
    if (!titre || !periodeDebut || !periodeFin) { toast.error('Le titre et la période sont obligatoires'); return }
    const res = await fetch(`/api/programmes/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        titre, description: description || null,
        periodeDebut: new Date(periodeDebut).toISOString(),
        periodeFin: new Date(periodeFin).toISOString(),
      }),
    })
    const data = await res.json()
    if (!res.ok) { toast.error(data.erreur ?? 'Erreur serveur'); return }
    toast.success('Programme mis à jour')
    setModifierMeta(false)
    charger()
  }

  async function handleAjouterLigne(e: React.FormEvent) {
    e.preventDefault()
    if (!theme) { toast.error('Le thème est obligatoire'); return }
    setAjoutEnCours(true)
    const res = await fetch(`/api/programmes/${id}/lignes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ theme, objectif: objectif || null, datePrevue: datePrevue ? new Date(datePrevue).toISOString() : null }),
    })
    const data = await res.json()
    if (!res.ok) { toast.error(data.erreur ?? 'Erreur serveur'); setAjoutEnCours(false); return }
    setTheme(''); setObjectif(''); setDatePrevue('')
    setAjoutEnCours(false)
    charger()
  }

  async function handleSupprimerLigne(ligneId: string) {
    const ligne = programme?.lignes.find((l) => l.id === ligneId)
    const ok = await confirmer({
      titre: 'Supprimer ce thème ?',
      description: ligne
        ? `Le thème "${ligne.theme}" sera définitivement supprimé du programme. Cette action est irréversible.`
        : 'Ce thème sera définitivement supprimé du programme. Cette action est irréversible.',
      labelConfirmer: 'Supprimer',
      danger: true,
    })
    if (!ok) return
    const res = await fetch(`/api/programmes/${id}/lignes/${ligneId}`, { method: 'DELETE' })
    if (!res.ok) { const d = await res.json().catch(() => ({})); toast.error(d.erreur ?? 'Erreur serveur'); return }
    charger()
  }

  async function handleDeplacerLigne(ligne: Ligne, direction: -1 | 1) {
    if (!programme) return
    const triees = [...programme.lignes].sort((a, b) => a.ordre - b.ordre)
    const index = triees.findIndex((l) => l.id === ligne.id)
    const voisin = triees[index + direction]
    if (!voisin) return
    await Promise.all([
      fetch(`/api/programmes/${id}/lignes/${ligne.id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ordre: voisin.ordre }),
      }),
      fetch(`/api/programmes/${id}/lignes/${voisin.id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ordre: ligne.ordre }),
      }),
    ])
    charger()
  }

  if (chargement) {
    return (
      <div className="flex items-center justify-center h-48">
        <div className="w-6 h-6 border-2 border-[var(--cp)] border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (!programme) {
    return (
      <div className="max-w-3xl mx-auto p-8 text-center">
        <p className="text-red-600 font-medium">Programme introuvable</p>
        <div className="mt-2 flex justify-center">
          <BackLink href="/dashboard/programmes">Retour aux programmes</BackLink>
        </div>
      </div>
    )
  }

  const lignesTriees = [...programme.lignes].sort((a, b) => a.ordre - b.ordre)

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-4">
          <BackLink href="/dashboard/programmes">Retour</BackLink>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{programme.titre}</h1>
            <div className="flex items-center gap-2 mt-1">
              {programme.brancheType ? (
                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${COULEURS_BRANCHE[programme.brancheType] ?? 'bg-gray-100 text-gray-700'}`}>
                  {BRANCHES[programme.brancheType]}
                </span>
              ) : (
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600">Groupe</span>
              )}
              <span className="text-xs text-gray-500">{formatDate(programme.periodeDebut)} → {formatDate(programme.periodeFin)}</span>
            </div>
          </div>
        </div>

        {peutGerer && (
          <div className="flex gap-2 flex-shrink-0">
            <button onClick={() => setModifierMeta((m) => !m)}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-50 transition-colors">
              Modifier
            </button>
            <button onClick={handleSupprimerProgramme}
              className="px-3 py-2 border border-red-300 text-red-600 rounded-lg text-sm hover:bg-red-50 transition-colors">
              Supprimer
            </button>
          </div>
        )}
      </div>

      {modifierMeta && peutGerer && (
        <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
          <div>
            <label className={CLS_LABEL}>Titre</label>
            <input type="text" value={titre} onChange={(e) => setTitre(e.target.value)} className={CLS_INPUT} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={CLS_LABEL}>Début</label>
              <input type="date" value={periodeDebut} onChange={(e) => setPeriodeDebut(e.target.value)} className={CLS_INPUT} />
            </div>
            <div>
              <label className={CLS_LABEL}>Fin</label>
              <input type="date" value={periodeFin} onChange={(e) => setPeriodeFin(e.target.value)} className={CLS_INPUT} />
            </div>
          </div>
          <div>
            <label className={CLS_LABEL}>Description / objectifs</label>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-[var(--cp)] resize-none" />
          </div>
          <button onClick={handleEnregistrerMeta}
            className="bg-[var(--cp)] text-white px-4 py-2 rounded-lg text-sm font-medium hover:brightness-110 transition-all">
            Enregistrer
          </button>
        </div>
      )}

      {programme.description && !modifierMeta && (
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <p className="text-sm text-gray-700 whitespace-pre-wrap">{programme.description}</p>
        </div>
      )}

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">Thèmes planifiés ({lignesTriees.length})</h2>

        {lignesTriees.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
            <p className="text-gray-400 text-sm">Aucun thème ajouté pour l&apos;instant</p>
          </div>
        ) : (
          <div className="space-y-2">
            {lignesTriees.map((ligne, i) => (
              <div key={ligne.id} className="bg-white rounded-xl border border-gray-200 p-4 flex items-start gap-3">
                {peutGerer && (
                  <div className="flex flex-col gap-1 flex-shrink-0 pt-0.5">
                    <button onClick={() => handleDeplacerLigne(ligne, -1)} disabled={i === 0}
                      className="w-6 h-6 flex items-center justify-center rounded border border-gray-200 text-gray-400 hover:text-gray-700 disabled:opacity-30"><ChevronUp className="h-3.5 w-3.5" strokeWidth={2} /></button>
                    <button onClick={() => handleDeplacerLigne(ligne, 1)} disabled={i === lignesTriees.length - 1}
                      className="w-6 h-6 flex items-center justify-center rounded border border-gray-200 text-gray-400 hover:text-gray-700 disabled:opacity-30"><ChevronDown className="h-3.5 w-3.5" strokeWidth={2} /></button>
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-900">{ligne.theme}</p>
                  {ligne.objectif && <p className="text-xs text-gray-500 mt-0.5">{ligne.objectif}</p>}
                  <div className="flex items-center gap-2 flex-wrap mt-1.5">
                    {ligne.datePrevue && (
                      <span className="text-xs text-gray-400">Prévu le {formatDate(ligne.datePrevue)}</span>
                    )}
                    {ligne.activite ? (
                      <Link href={`/dashboard/activites/${ligne.activite.id}`}
                        className="inline-flex items-center gap-1 text-xs bg-green-50 text-green-700 border border-green-100 px-2 py-0.5 rounded-full font-medium hover:bg-green-100">
                        <Check className="h-3 w-3" strokeWidth={2.5} />
                        Réalisé — {ligne.activite.titre}
                      </Link>
                    ) : (
                      <span className="text-xs bg-gray-50 text-gray-500 border border-gray-100 px-2 py-0.5 rounded-full">À réaliser</span>
                    )}
                  </div>
                </div>
                {peutGerer && (
                  <button onClick={() => handleSupprimerLigne(ligne.id)}
                    className="text-red-500 hover:text-red-700 text-xs font-medium flex-shrink-0">Supprimer</button>
                )}
              </div>
            ))}
          </div>
        )}

        {peutGerer && (
          <form onSubmit={handleAjouterLigne} className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Ajouter un thème</p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="sm:col-span-2">
                <label className={CLS_LABEL}>Thème <span className="text-red-500">*</span></label>
                <input type="text" value={theme} onChange={(e) => setTheme(e.target.value)}
                  placeholder="Ex. Vie de groupe" className={CLS_INPUT} />
              </div>
              <div>
                <label className={CLS_LABEL}>Date prévue</label>
                <input type="date" value={datePrevue} onChange={(e) => setDatePrevue(e.target.value)} className={CLS_INPUT} />
              </div>
            </div>
            <div>
              <label className={CLS_LABEL}>Objectif <span className="text-xs text-gray-400 font-normal">(optionnel)</span></label>
              <input type="text" value={objectif} onChange={(e) => setObjectif(e.target.value)}
                placeholder="Objectif pédagogique" className={CLS_INPUT} />
            </div>
            <button type="submit" disabled={ajoutEnCours}
              className="bg-[var(--cp)] text-white px-4 py-2 rounded-lg text-sm font-medium hover:brightness-110 transition-all disabled:opacity-60">
              {ajoutEnCours ? 'Ajout…' : '+ Ajouter'}
            </button>
          </form>
        )}
      </section>
    </div>
  )
}
