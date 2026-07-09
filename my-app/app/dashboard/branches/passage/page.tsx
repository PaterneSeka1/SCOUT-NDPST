'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import Link from 'next/link'
import { toast } from 'sonner'
import { confirmer } from '@/app/components/ConfirmDialog'
import { LABELS_BRANCHES, COULEURS_BRANCHES, TRANCHES_AGE_BRANCHES, ORDRE_BRANCHES, formatTrancheAge } from '@/lib/branches'

interface Proposition {
  scoutId: string
  nom: string
  prenom: string
  matricule: string | null
  age: number
  brancheActuelle: string
  brancheProposee: string | null
}

function badgeBranche(branche: string | null) {
  if (!branche) {
    return <span className="text-xs px-2 py-0.5 rounded-full bg-red-100 text-red-700">Sortie du mouvement</span>
  }
  const couleur = COULEURS_BRANCHES[branche] ?? 'bg-gray-100 text-gray-700'
  const tranche = TRANCHES_AGE_BRANCHES[branche]
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full whitespace-nowrap ${couleur}`}>
      {LABELS_BRANCHES[branche] ?? branche}
      {tranche ? ` · ${formatTrancheAge(tranche)}` : ''}
    </span>
  )
}

// La branche proposée est parfois antérieure à l'actuelle (ex. Éclaireurs →
// Louveteaux) : ce n'est pas un recul normal, mais le signe probable d'une
// date de naissance ou d'une branche mal saisie à l'origine — à vérifier
// avant de confirmer, contrairement à un passage classique en fin d'année.
function estCorrection(p: Proposition): boolean {
  if (!p.brancheProposee) return false
  return ORDRE_BRANCHES.indexOf(p.brancheProposee) < ORDRE_BRANCHES.indexOf(p.brancheActuelle)
}

function dateAujourdhui(): string {
  return new Date().toISOString().slice(0, 10)
}

export default function PagePassageBranche() {
  const { data: session } = useSession()
  const [dateReference, setDateReference] = useState(dateAujourdhui())
  const [propositions, setPropositions] = useState<Proposition[]>([])
  const [selection, setSelection] = useState<Set<string>>(new Set())
  const [chargement, setChargement] = useState(true)
  const [soumission, setSoumission] = useState(false)
  const [erreur, setErreur] = useState('')

  const charger = (date: string) => {
    setChargement(true)
    setErreur('')
    fetch(`/api/scouts/passage-branche?dateReference=${date}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.erreur) { setErreur(data.erreur); return }
        setPropositions(data.propositions ?? [])
        setSelection(new Set((data.propositions ?? []).map((p: Proposition) => p.scoutId)))
      })
      .catch(() => setErreur('Impossible de calculer les propositions de passage'))
      .finally(() => setChargement(false))
  }

  useEffect(() => {
    if (!session?.user) return
    charger(dateReference)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session])

  const basculer = (scoutId: string) => {
    setSelection((prev) => {
      const suivant = new Set(prev)
      if (suivant.has(scoutId)) suivant.delete(scoutId)
      else suivant.add(scoutId)
      return suivant
    })
  }

  const toutBasculer = () => {
    setSelection((prev) => (prev.size === propositions.length ? new Set() : new Set(propositions.map((p) => p.scoutId))))
  }

  const soumettrePassage = async () => {
    if (selection.size === 0) return
    const ok = await confirmer({
      titre: `Confirmer le passage de branche pour ${selection.size} scout${selection.size > 1 ? 's' : ''} ?`,
      description: 'Chaque scout sélectionné sera transféré vers la branche proposée à l\'écran. Vous pourrez toujours corriger la branche d\'un scout manuellement par la suite si besoin.',
      labelConfirmer: 'Confirmer le passage',
      danger: false,
    })
    if (!ok) return

    setSoumission(true)
    try {
      const passages = propositions
        .filter((p) => selection.has(p.scoutId))
        .map((p) => ({ scoutId: p.scoutId, nouvelleBranche: p.brancheProposee }))

      const res = await fetch('/api/scouts/passage-branche', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ passages }),
      })
      const data = await res.json()
      if (!res.ok) { toast.error(data.erreur ?? 'Erreur lors du passage de branche'); return }

      toast.success(`${data.appliques} scout${data.appliques > 1 ? 's' : ''} mis à jour.`)
      charger(dateReference)
    } catch {
      toast.error('Erreur réseau. Veuillez réessayer.')
    } finally {
      setSoumission(false)
    }
  }

  return (
    <div className="space-y-6">
      <Link href="/dashboard/branches" className="text-sm text-gray-500 hover:text-gray-700 transition-colors">
        ← Retour aux branches
      </Link>

      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Passage de branche</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          Propose un changement de branche pour chaque scout dont l&apos;âge ne correspond plus à sa branche actuelle,
          selon les tranches d&apos;âge ci-dessous. Rien n&apos;est modifié tant que vous ne confirmez pas.
        </p>
        <div className="flex flex-wrap gap-1.5 mt-3">
          {ORDRE_BRANCHES.map((branche) => (
            <span key={branche} className={`text-xs px-2 py-1 rounded-lg ${COULEURS_BRANCHES[branche]}`}>
              {LABELS_BRANCHES[branche]} · {formatTrancheAge(TRANCHES_AGE_BRANCHES[branche])}
            </span>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-5 sm:p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-end gap-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Date de référence</label>
            <input
              type="date"
              value={dateReference}
              onChange={(e) => setDateReference(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#1a4731] focus:border-transparent"
            />
            <p className="mt-1 text-xs text-gray-400">Âge calculé à cette date (ex : le 1er septembre pour une rentrée scoute).</p>
          </div>
          <button
            onClick={() => charger(dateReference)}
            disabled={chargement}
            className="sm:mb-6 bg-white border border-gray-300 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-50 transition-colors text-sm font-medium disabled:opacity-60"
          >
            Recalculer
          </button>
        </div>

        {erreur && <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">{erreur}</div>}

        {chargement ? (
          <div className="flex items-center justify-center py-12">
            <div className="w-6 h-6 border-2 border-[#1a4731] border-t-transparent rounded-full animate-spin" />
          </div>
        ) : propositions.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-4xl mb-3">✅</p>
            <p className="text-sm text-gray-500">Aucun scout à changer de branche à cette date.</p>
          </div>
        ) : (
          <>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-gray-100 pb-3">
              <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
                <input
                  type="checkbox"
                  checked={selection.size === propositions.length}
                  onChange={toutBasculer}
                  className="w-4 h-4 accent-[#1a4731] rounded"
                />
                Tout sélectionner ({propositions.length})
              </label>
              <button
                onClick={soumettrePassage}
                disabled={soumission || selection.size === 0}
                className="bg-[#1a4731] text-white px-4 py-2 rounded-lg hover:bg-[#163d29] transition-colors text-sm font-medium disabled:opacity-60"
              >
                {soumission ? 'Application…' : `Confirmer pour ${selection.size} scout${selection.size > 1 ? 's' : ''}`}
              </button>
            </div>

            <div className="space-y-2">
              {propositions.map((p) => (
                <label
                  key={p.scoutId}
                  className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 p-3 rounded-lg border border-gray-100 hover:bg-gray-50 cursor-pointer"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <input
                      type="checkbox"
                      checked={selection.has(p.scoutId)}
                      onChange={() => basculer(p.scoutId)}
                      className="w-4 h-4 accent-[#1a4731] rounded flex-shrink-0"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{p.prenom} {p.nom}</p>
                      <p className="text-xs text-gray-500">{p.matricule ?? 'Sans matricule'} · {p.age} ans</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap pl-7 sm:pl-0 sm:flex-shrink-0">
                    {badgeBranche(p.brancheActuelle)}
                    <span className="text-gray-300">→</span>
                    {badgeBranche(p.brancheProposee)}
                    {estCorrection(p) && (
                      <span
                        className="text-xs text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full whitespace-nowrap"
                        title="La branche proposée est antérieure à la branche actuelle : vérifiez la date de naissance de ce scout avant de confirmer."
                      >
                        ⚠️ à vérifier
                      </span>
                    )}
                  </div>
                </label>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
