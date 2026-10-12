'use client'

import { useEffect, useMemo, useState } from 'react'
import { useSession } from 'next-auth/react'
import Link from 'next/link'
import { toast } from 'sonner'
import { LABELS_BRANCHES } from '@/lib/branches'
import { anneeScolaireCourante } from '@/lib/cotisations'
import { ROLES_GROUPE, ROLES_BRANCHE } from '@/lib/roles'
import { Wallet } from '@/lib/icons'

// Cotisations V1 : uniquement « cotisant / non cotisant » par scout et par
// année scolaire. Seul le Chef de Groupe modifie ; la maîtrise et
// l'encadrement de branche consultent (voir app/api/cotisations/statuts).

interface ScoutCotisation {
  id: string
  nom: string
  prenom: string
  matricule: string | null
  brancheType: string
  cotisant: boolean
}

type FiltreStatut = '' | 'cotisants' | 'non-cotisants'

const BRANCHES = Object.keys(LABELS_BRANCHES)

function optionsAnnees(): string[] {
  const [debut] = anneeScolaireCourante().split('-').map(Number)
  return [debut - 1, debut, debut + 1].map((a) => `${a}-${a + 1}`)
}

export default function PageCotisations() {
  const { data: session } = useSession()
  const role = session?.user?.role ?? ''
  const peutModifier = ROLES_GROUPE.includes(role)
  const estBranche = ROLES_BRANCHE.includes(role)

  const [scouts, setScouts] = useState<ScoutCotisation[]>([])
  const [anneeScolaire, setAnneeScolaire] = useState(anneeScolaireCourante())
  const [filtreBranche, setFiltreBranche] = useState('')
  const [filtreStatut, setFiltreStatut] = useState<FiltreStatut>('')
  const [chargement, setChargement] = useState(true)
  const [erreur, setErreur] = useState('')
  const [enCours, setEnCours] = useState<string | null>(null)

  useEffect(() => {
    if (!session?.user) return
    const params = new URLSearchParams({ anneeScolaire })
    if (filtreBranche) params.set('branche', filtreBranche)
    setChargement(true)
    setErreur('')
    fetch(`/api/cotisations/statuts?${params.toString()}`)
      .then(async (r) => {
        const data = await r.json()
        if (!r.ok) throw new Error(data.erreur ?? 'Erreur de chargement')
        setScouts(data.scouts ?? [])
      })
      .catch((e: unknown) => setErreur(e instanceof Error ? e.message : 'Impossible de charger les cotisations.'))
      .finally(() => setChargement(false))
  }, [session, anneeScolaire, filtreBranche])

  const totaux = useMemo(() => {
    const cotisants = scouts.filter((s) => s.cotisant).length
    return { cotisants, nonCotisants: scouts.length - cotisants, total: scouts.length }
  }, [scouts])

  const scoutsAffiches = useMemo(() => {
    if (filtreStatut === 'cotisants') return scouts.filter((s) => s.cotisant)
    if (filtreStatut === 'non-cotisants') return scouts.filter((s) => !s.cotisant)
    return scouts
  }, [scouts, filtreStatut])

  async function basculer(scout: ScoutCotisation) {
    const cotisant = !scout.cotisant
    setEnCours(scout.id)
    try {
      const res = await fetch('/api/cotisations/statuts', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scoutId: scout.id, cotisant, anneeScolaire }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.erreur ?? 'Erreur lors de la mise à jour')
        return
      }
      setScouts((prec) => prec.map((s) => (s.id === scout.id ? { ...s, cotisant } : s)))
      toast.success(`${scout.prenom} ${scout.nom} : ${cotisant ? 'cotisant' : 'non cotisant'}.`)
    } catch {
      toast.error('Erreur réseau, veuillez réessayer.')
    } finally {
      setEnCours(null)
    }
  }

  const champ =
    'border border-gray-300 rounded-lg px-3 py-1.5 text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-(--cp)'

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Cotisations</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          {peutModifier
            ? 'Indiquez pour chaque scout s’il est à jour de sa cotisation annuelle.'
            : 'Situation des cotisations annuelles. Seul le Chef de Groupe peut la modifier.'}
        </p>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-xs text-gray-500">Cotisants</p>
          <p className="text-xl font-bold text-green-700">{totaux.cotisants}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-xs text-gray-500">Non cotisants</p>
          <p className="text-xl font-bold text-amber-700">{totaux.nonCotisants}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-xs text-gray-500">Scouts actifs</p>
          <p className="text-xl font-bold text-gray-900">{totaux.total}</p>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-4 sm:p-5 space-y-4">
        <div className="flex flex-wrap items-center gap-3">
          <label className="text-sm text-gray-600" htmlFor="annee">Année scolaire :</label>
          <select id="annee" value={anneeScolaire} onChange={(e) => setAnneeScolaire(e.target.value)} className={champ}>
            {optionsAnnees().map((a) => <option key={a} value={a}>{a}</option>)}
          </select>
          {!estBranche && (
            <>
              <label className="text-sm text-gray-600 sm:ml-2" htmlFor="branche">Branche :</label>
              <select id="branche" value={filtreBranche} onChange={(e) => setFiltreBranche(e.target.value)} className={champ}>
                <option value="">Toutes</option>
                {BRANCHES.map((b) => <option key={b} value={b}>{LABELS_BRANCHES[b]}</option>)}
              </select>
            </>
          )}
          <label className="text-sm text-gray-600 sm:ml-2" htmlFor="statut">Statut :</label>
          <select id="statut" value={filtreStatut} onChange={(e) => setFiltreStatut(e.target.value as FiltreStatut)} className={champ}>
            <option value="">Tous</option>
            <option value="cotisants">Cotisants</option>
            <option value="non-cotisants">Non cotisants</option>
          </select>
        </div>

        {erreur && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">{erreur}</div>
        )}

        {chargement ? (
          <div className="flex items-center justify-center py-12">
            <div className="w-6 h-6 border-2 border-(--cp) border-t-transparent rounded-full animate-spin" />
          </div>
        ) : scoutsAffiches.length === 0 ? (
          <div className="text-center py-12">
            <Wallet className="h-10 w-10 mx-auto mb-3 text-gray-300" strokeWidth={2} />
            <p className="text-sm text-gray-500">Aucun scout pour ces critères.</p>
          </div>
        ) : (
          <ul className="divide-y divide-gray-50">
            {scoutsAffiches.map((s) => (
              <li key={s.id} className="flex items-center justify-between gap-3 py-2.5">
                <div className="min-w-0">
                  <Link href={`/dashboard/scouts/${s.id}`} className="block truncate text-sm font-medium text-gray-900 hover:text-(--cp) hover:underline">
                    {s.prenom} {s.nom}
                  </Link>
                  <p className="text-xs text-gray-500 truncate">
                    {LABELS_BRANCHES[s.brancheType] ?? s.brancheType}
                    {s.matricule ? ` · ${s.matricule}` : ''}
                  </p>
                </div>
                {peutModifier ? (
                  <button
                    type="button"
                    role="switch"
                    aria-checked={s.cotisant}
                    aria-label={`${s.prenom} ${s.nom} cotisant`}
                    disabled={enCours === s.id}
                    onClick={() => basculer(s)}
                    className={`shrink-0 text-xs font-medium px-3 py-1.5 rounded-full border transition-colors disabled:opacity-50 ${
                      s.cotisant
                        ? 'bg-green-100 text-green-800 border-green-200 hover:bg-green-200'
                        : 'bg-white text-amber-700 border-amber-200 hover:bg-amber-50'
                    }`}
                  >
                    {s.cotisant ? 'Cotisant' : 'Non cotisant'}
                  </button>
                ) : (
                  <span className={`shrink-0 text-xs px-2 py-0.5 rounded-full ${s.cotisant ? 'bg-green-100 text-green-800' : 'bg-amber-100 text-amber-800'}`}>
                    {s.cotisant ? 'Cotisant' : 'Non cotisant'}
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
