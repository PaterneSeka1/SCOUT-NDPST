'use client'

import { useCallback, useEffect, useState } from 'react'
import { useSession } from '@/lib/session-client'
import { toast } from 'sonner'
import { confirmer } from '@/components/ConfirmDialog'
import { BackLink } from '@/components/ui/BackLink'
import {
  DESCRIPTION_RESSOURCES_ADULTES,
  LABELS_BRANCHES,
  COULEURS_BRANCHES,
  TRANCHES_AGE_BRANCHES,
  ORDRE_CATEGORIES_SCOUTS,
  formatTrancheAge,
} from '@scout/shared'
import { ArrowRight, AlertTriangle, CheckCircle2 } from '@/lib/icons'

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
    return <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs text-red-700">Sortie du mouvement</span>
  }
  const couleur = COULEURS_BRANCHES[branche] ?? 'bg-stone-100 text-stone-700'
  const tranche = TRANCHES_AGE_BRANCHES[branche]
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs whitespace-nowrap ${couleur}`}>
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
  return ORDRE_CATEGORIES_SCOUTS.indexOf(p.brancheProposee) < ORDRE_CATEGORIES_SCOUTS.indexOf(p.brancheActuelle)
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

  const charger = useCallback((date: string) => {
    fetch(`/api/scouts/passage-branche?dateReference=${date}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.erreur) {
          setErreur(data.erreur)
          return
        }
        setErreur('')
        setPropositions(data.propositions ?? [])
        setSelection(new Set((data.propositions ?? []).map((p: Proposition) => p.scoutId)))
      })
      .catch(() => setErreur('Impossible de calculer les propositions de passage'))
      .finally(() => setChargement(false))
  }, [])

  useEffect(() => {
    if (!session?.user) return
    charger(dateReference)
  }, [session, dateReference, charger])

  const basculer = (scoutId: string) => {
    setSelection((prev) => {
      const suivant = new Set(prev)
      if (suivant.has(scoutId)) suivant.delete(scoutId)
      else suivant.add(scoutId)
      return suivant
    })
  }

  const toutBasculer = () => {
    setSelection((prev) =>
      prev.size === propositions.length ? new Set() : new Set(propositions.map((p) => p.scoutId)),
    )
  }

  const soumettrePassage = async () => {
    if (selection.size === 0) return
    const ok = await confirmer({
      titre: `Confirmer le passage de branche pour ${selection.size} scout${selection.size > 1 ? 's' : ''} ?`,
      description:
        "Chaque scout sélectionné sera transféré vers la branche proposée à l'écran. Vous pourrez toujours corriger la branche d'un scout manuellement par la suite si besoin.",
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
      if (!res.ok) {
        toast.error(data.erreur ?? 'Erreur lors du passage de branche')
        return
      }

      toast.success(`${data.appliques} scout${data.appliques > 1 ? 's' : ''} mis à jour.`)
      setChargement(true)
      charger(dateReference)
    } catch {
      toast.error('Erreur réseau. Veuillez réessayer.')
    } finally {
      setSoumission(false)
    }
  }

  return (
    <div className="space-y-6">
      <BackLink href="/dashboard/branches">Retour aux branches</BackLink>

      <div>
        <h1 className="text-xl font-bold text-stone-900 sm:text-2xl">Passage de branche</h1>
        <p className="mt-0.5 text-sm text-stone-500">
          Propose un changement de branche pour chaque scout dont l&apos;âge ne correspond plus à sa branche actuelle,
          selon les tranches d&apos;âge ci-dessous. Rien n&apos;est modifié tant que vous ne confirmez pas.
        </p>
        <p className="mt-2 text-sm text-stone-500">{DESCRIPTION_RESSOURCES_ADULTES}</p>
        <div className="mt-3 flex flex-wrap gap-1.5">
          {ORDRE_CATEGORIES_SCOUTS.map((branche) => (
            <span key={branche} className={`rounded-lg px-2 py-1 text-xs ${COULEURS_BRANCHES[branche]}`}>
              {LABELS_BRANCHES[branche]} · {formatTrancheAge(TRANCHES_AGE_BRANCHES[branche])}
            </span>
          ))}
        </div>
      </div>

      <div className="space-y-4 rounded-xl border border-stone-200 bg-white p-5 sm:p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div>
            <label className="mb-1 block text-sm font-medium text-stone-700">Date de référence</label>
            <input
              type="date"
              value={dateReference}
              onChange={(e) => {
                setChargement(true)
                setErreur('')
                setDateReference(e.target.value)
              }}
              className="rounded-lg border border-stone-300 px-3 py-2 text-sm text-stone-900 focus:border-transparent focus:ring-2 focus:ring-(--cp) focus:outline-none"
            />
            <p className="mt-1 text-xs text-stone-400">
              Âge calculé à cette date (ex : le 1er septembre pour une rentrée scoute).
            </p>
          </div>
          <button
            onClick={() => {
              setChargement(true)
              setErreur('')
              charger(dateReference)
            }}
            disabled={chargement}
            className="rounded-lg border border-stone-300 bg-white px-4 py-2 text-sm font-medium text-stone-700 transition-colors hover:bg-stone-50 disabled:opacity-60 sm:mb-6"
          >
            Recalculer
          </button>
        </div>

        {erreur && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{erreur}</div>
        )}

        {chargement ? (
          <div className="flex items-center justify-center py-12">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-(--cp) border-t-transparent" />
          </div>
        ) : propositions.length === 0 ? (
          <div className="py-12 text-center">
            <CheckCircle2 className="mx-auto mb-3 h-10 w-10 text-stone-300" strokeWidth={2} />
            <p className="text-sm text-stone-500">Aucun scout à changer de branche à cette date.</p>
          </div>
        ) : (
          <>
            <div className="flex flex-col gap-3 border-b border-stone-100 pb-3 sm:flex-row sm:items-center sm:justify-between">
              <label className="flex cursor-pointer items-center gap-2 text-sm text-stone-600">
                <input
                  type="checkbox"
                  checked={selection.size === propositions.length}
                  onChange={toutBasculer}
                  className="h-4 w-4 rounded accent-(--cp)"
                />
                Tout sélectionner ({propositions.length})
              </label>
              <button
                onClick={soumettrePassage}
                disabled={soumission || selection.size === 0}
                className="rounded-lg bg-(--cp) px-4 py-2 text-sm font-medium text-white transition-all hover:brightness-110 disabled:opacity-60"
              >
                {soumission ? 'Application…' : `Confirmer pour ${selection.size} scout${selection.size > 1 ? 's' : ''}`}
              </button>
            </div>

            <div className="space-y-2">
              {propositions.map((p) => (
                <label
                  key={p.scoutId}
                  className="flex cursor-pointer flex-col gap-2 rounded-lg border border-stone-100 p-3 hover:bg-stone-50 sm:flex-row sm:items-center sm:gap-3"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <input
                      type="checkbox"
                      checked={selection.has(p.scoutId)}
                      onChange={() => basculer(p.scoutId)}
                      className="h-4 w-4 shrink-0 rounded accent-(--cp)"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-stone-900">
                        {p.prenom} {p.nom}
                      </p>
                      <p className="text-xs text-stone-500">
                        {p.matricule ?? 'Sans matricule'} · {p.age} ans
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 pl-7 sm:shrink-0 sm:pl-0">
                    {badgeBranche(p.brancheActuelle)}
                    <ArrowRight className="h-4 w-4 text-stone-300" strokeWidth={2} />
                    {badgeBranche(p.brancheProposee)}
                    {estCorrection(p) && (
                      <span
                        className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-xs whitespace-nowrap text-amber-700"
                        title="La branche proposée est antérieure à la branche actuelle : vérifiez la date de naissance de ce scout avant de confirmer."
                      >
                        <AlertTriangle className="h-3.5 w-3.5" strokeWidth={2} /> à vérifier
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
