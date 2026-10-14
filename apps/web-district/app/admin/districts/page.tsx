'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { MONO_PAROISSE } from '@scout/shared'
import { ArrowRight } from '@/lib/icons'

interface District {
  id: string
  nom: string
  nbParoisses: number
  commissaire: { id: string; nom: string; prenom: string; actif: boolean } | null
}

function CommissaireDistrict({ commissaire }: { commissaire: District['commissaire'] }) {
  if (!commissaire) {
    return <span className="text-xs font-medium text-orange-600">À désigner</span>
  }
  return (
    <span className="inline-flex items-center gap-2">
      <span className="text-gray-700">
        {commissaire.prenom} {commissaire.nom}
      </span>
      {!commissaire.actif && (
        <span className="inline-flex items-center rounded-full bg-gray-200 px-2 py-0.5 text-xs font-medium text-gray-600">
          Désactivé
        </span>
      )}
    </span>
  )
}

function EtatVide({ rechercheActive }: { rechercheActive: boolean }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white px-4 py-10 text-center">
      <p className="text-sm font-medium text-gray-700">
        {rechercheActive ? 'Aucun district trouvé' : 'Aucun district enregistré'}
      </p>
      <p className="mt-1 text-xs text-gray-400">
        {rechercheActive
          ? 'Essayez avec un autre nom.'
          : 'Un district apparaît automatiquement dès qu’une paroisse a un district renseigné.'}
      </p>
    </div>
  )
}

export default function ListeDistricts() {
  const router = useRouter()
  const [districts, setDistricts] = useState<District[]>([])
  const [chargement, setChargement] = useState(true)
  const [recherche, setRecherche] = useState('')
  const [creation, setCreation] = useState(false)
  const [nomNouveauDistrict, setNomNouveauDistrict] = useState('')
  const [soumissionCreation, setSoumissionCreation] = useState(false)

  const charger = () => {
    fetch('/api/admin/districts')
      .then((r) => {
        if (!r.ok) throw new Error('Erreur serveur')
        return r.json()
      })
      .then((data: { districts: District[] }) => setDistricts(data.districts))
      .catch(() => toast.error('Impossible de charger les districts.'))
      .finally(() => setChargement(false))
  }

  useEffect(charger, [])

  const handleCreer = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!nomNouveauDistrict.trim()) {
      toast.error('Le nom du district est requis.')
      return
    }
    setSoumissionCreation(true)
    try {
      const res = await fetch('/api/admin/districts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nom: nomNouveauDistrict.trim() }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.erreur ?? 'Erreur serveur')
        return
      }
      toast.success('District créé.')
      setNomNouveauDistrict('')
      setCreation(false)
      charger()
    } catch {
      toast.error('Erreur lors de la création')
    } finally {
      setSoumissionCreation(false)
    }
  }

  const rechercheNorm = recherche.trim().toLowerCase()
  const districtsFiltres = rechercheNorm
    ? districts.filter((d) => d.nom.toLowerCase().includes(rechercheNorm))
    : districts

  if (chargement) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="h-8 w-8 animate-spin rounded-full border-b-2" style={{ borderColor: 'var(--cp)' }} />
      </div>
    )
  }

  return (
    <div className="space-y-5 sm:space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
        <div className="min-w-0">
          <h1 className="text-xl font-bold text-gray-900 sm:text-2xl">Districts</h1>
          <p className="mt-0.5 text-sm text-gray-500">
            {districts.length} district{districts.length > 1 ? 's' : ''}
          </p>
        </div>
        {!creation && (!MONO_PAROISSE || districts.length === 0) && (
          <button
            onClick={() => setCreation(true)}
            className="rounded-lg px-4 py-2 text-sm font-bold text-white transition hover:brightness-110 sm:shrink-0"
            style={{ backgroundColor: 'var(--cp)' }}
          >
            + Nouveau district
          </button>
        )}
      </div>

      {creation && (
        <form
          onSubmit={handleCreer}
          className="flex flex-col gap-3 rounded-xl border border-gray-200 bg-white p-4 sm:flex-row"
        >
          <input
            autoFocus
            placeholder="Nom du district (ex : District Nord)"
            value={nomNouveauDistrict}
            onChange={(e) => setNomNouveauDistrict(e.target.value)}
            className="flex-1 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:border-transparent focus:ring-2 focus:ring-(--cp) focus:outline-none"
          />
          <div className="flex shrink-0 gap-2">
            <button
              type="submit"
              disabled={soumissionCreation}
              className="rounded-lg px-4 py-2 text-sm font-bold text-white transition disabled:opacity-50"
              style={{ backgroundColor: 'var(--cp)' }}
            >
              {soumissionCreation ? 'Création…' : 'Créer'}
            </button>
            <button
              type="button"
              onClick={() => {
                setCreation(false)
                setNomNouveauDistrict('')
              }}
              className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
            >
              Annuler
            </button>
          </div>
        </form>
      )}

      <div className="relative">
        <svg
          className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-gray-400"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M21 21l-4.35-4.35M11 19a8 8 0 100-16 8 8 0 000 16z"
          />
        </svg>
        <input
          type="text"
          placeholder="Rechercher un district…"
          value={recherche}
          onChange={(e) => setRecherche(e.target.value)}
          className="w-full rounded-lg border border-gray-300 bg-white py-2.5 pr-3 pl-9 text-sm text-gray-900 placeholder:text-gray-400 focus:ring-2 focus:ring-(--cp) focus:outline-none"
        />
      </div>

      {districtsFiltres.length === 0 ? (
        <EtatVide rechercheActive={Boolean(rechercheNorm)} />
      ) : (
        <>
          <div className="space-y-3 md:hidden">
            {districtsFiltres.map((d) => (
              <Link
                key={d.id}
                href={`/admin/districts/${d.id}${d.commissaire ? '' : '#commissaire'}`}
                className="block rounded-xl border border-gray-200 bg-white p-4 shadow-sm transition hover:border-gray-300 hover:shadow-md active:scale-[0.99]"
              >
                <div className="min-w-0">
                  <h2 className="text-base leading-snug font-bold wrap-break-word text-gray-900">{d.nom}</h2>
                  <p className="mt-1 text-xs text-gray-500">
                    {d.nbParoisses} paroisse{d.nbParoisses > 1 ? 's' : ''}
                  </p>
                </div>

                <div className="mt-4 border-t border-gray-100 pt-3">
                  <p className="text-[11px] font-semibold text-gray-400 uppercase">Commissaire de District</p>
                  <div className="mt-0.5 text-sm font-medium">
                    <CommissaireDistrict commissaire={d.commissaire} />
                  </div>
                </div>

                <p className="mt-4 inline-flex items-center gap-1 text-sm font-semibold" style={{ color: 'var(--cp)' }}>
                  {d.commissaire ? 'Gérer le district' : 'Nommer le Commissaire'}
                  <ArrowRight className="h-3.5 w-3.5" strokeWidth={2} />
                </p>
              </Link>
            ))}
          </div>

          <div className="hidden overflow-hidden rounded-xl border border-gray-200 bg-white md:block">
            <div className="overflow-x-auto">
              <table className="w-full min-w-160 text-sm">
                <thead>
                  <tr className="border-b border-gray-200 text-left text-xs font-semibold tracking-wide text-gray-500 uppercase">
                    <th className="px-4 py-3">District</th>
                    <th className="px-4 py-3 text-center">Paroisses</th>
                    <th className="px-4 py-3">Commissaire de District</th>
                    <th className="px-4 py-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {districtsFiltres.map((d) => (
                    <tr
                      key={d.id}
                      className="cursor-pointer transition-colors hover:bg-gray-50"
                      onClick={() => router.push(`/admin/districts/${d.id}`)}
                    >
                      <td className="px-4 py-3">
                        <p className="font-medium text-gray-900">{d.nom}</p>
                      </td>
                      <td className="px-4 py-3 text-center text-gray-700">{d.nbParoisses}</td>
                      <td className="px-4 py-3">
                        <CommissaireDistrict commissaire={d.commissaire} />
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Link
                          href={`/admin/districts/${d.id}${d.commissaire ? '' : '#commissaire'}`}
                          onClick={(event) => event.stopPropagation()}
                          className="inline-flex items-center justify-center rounded-lg px-3 py-1.5 text-xs font-bold text-white transition hover:brightness-110"
                          style={{ backgroundColor: 'var(--cp)' }}
                        >
                          {d.commissaire ? 'Gérer' : 'Nommer'}
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
