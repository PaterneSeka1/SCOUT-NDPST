'use client'

import { use, useState, useEffect } from 'react'
import Link from 'next/link'
import { toast } from 'sonner'
import { useActivite, usePresencesActivite, useEnregistrerPresences } from '@/hooks/useActivites'
import { LABELS_BRANCHES } from '@/lib/branches'

interface EtatPresence {
  scoutId: string
  present: boolean
  commentaire: string
}

export default function PagePresences({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const { data: activite } = useActivite(id)
  const { data: presencesData, isLoading } = usePresencesActivite(id)
  const enregistrerPresences = useEnregistrerPresences(id)

  const [presences, setPresences] = useState<EtatPresence[]>([])

  useEffect(() => {
    if (presencesData && Array.isArray(presencesData)) {
      setPresences(
        presencesData.map((p: { present: boolean; commentaire: string | null; scout: { id: string } }) => ({
          scoutId: p.scout.id,
          present: p.present,
          commentaire: p.commentaire ?? '',
        }))
      )
    }
  }, [presencesData])

  const nbPresents = presences.filter((p) => p.present).length
  const nbTotal = presences.length

  function togglePresence(scoutId: string) {
    setPresences((prev) =>
      prev.map((p) => (p.scoutId === scoutId ? { ...p, present: !p.present } : p))
    )
  }

  function setCommentaire(scoutId: string, commentaire: string) {
    setPresences((prev) =>
      prev.map((p) => (p.scoutId === scoutId ? { ...p, commentaire } : p))
    )
  }

  function toutCocher() {
    setPresences((prev) => prev.map((p) => ({ ...p, present: true })))
  }

  function toutDecocher() {
    setPresences((prev) => prev.map((p) => ({ ...p, present: false })))
  }

  async function handleEnregistrer() {
    try {
      await enregistrerPresences.mutateAsync(
        presences.map((p) => ({
          scoutId: p.scoutId,
          present: p.present,
          commentaire: p.commentaire || undefined,
        }))
      )
      toast.success('Présences enregistrées avec succès.')
    } catch (err) {
      toast.error((err as Error).message)
    }
  }

  const scouts = presencesData ?? []

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-32">
      {/* En-tête */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-4">
          <Link
            href={`/dashboard/activites/${id}`}
            className="text-gray-500 hover:text-gray-700 transition-colors"
          >
            ← Retour
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Feuille de présence</h1>
            {activite && (
              <p className="text-sm text-gray-500 mt-1">
                {activite.titre}
                {activite.brancheType && (
                  <span className="ml-2 text-gray-400">— {LABELS_BRANCHES[activite.brancheType] ?? activite.brancheType}</span>
                )}
              </p>
            )}
          </div>
        </div>

        {/* Compteur + boutons tout cocher */}
        <div className="flex items-center gap-3 flex-shrink-0">
          <div className="text-right">
            <p className="text-2xl font-bold text-[#1a4731]">{nbPresents}/{nbTotal}</p>
            <p className="text-xs text-gray-500">présent(s)</p>
          </div>
          <div className="flex flex-col gap-1">
            <button
              onClick={toutCocher}
              className="text-xs px-3 py-1 bg-green-100 text-green-700 rounded-lg hover:bg-green-200 transition-colors font-medium"
            >
              Tout cocher
            </button>
            <button
              onClick={toutDecocher}
              className="text-xs px-3 py-1 bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200 transition-colors font-medium"
            >
              Tout décocher
            </button>
          </div>
        </div>
      </div>

      {/* Liste des scouts */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center text-gray-500">Chargement des scouts...</div>
        ) : scouts.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            <p>Aucun scout trouvé pour cette activité.</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {scouts.map((p: {
              present: boolean
              commentaire: string | null
              scout: { id: string; nom: string; prenom: string; numeroAdhesion: string | null; brancheType: string | null; ficheMedicale?: boolean }
            }) => {
              const etat = presences.find((e) => e.scoutId === p.scout.id)
              const estPresent = etat?.present ?? false

              return (
                <div
                  key={p.scout.id}
                  className={`px-4 py-3 transition-colors ${estPresent ? 'bg-green-50' : 'bg-white'}`}
                >
                  <div className="flex items-center gap-4">
                    {/* Case à cocher */}
                    <button
                      onClick={() => togglePresence(p.scout.id)}
                      className={`flex-shrink-0 w-6 h-6 rounded border-2 flex items-center justify-center transition-colors ${
                        estPresent
                          ? 'bg-green-500 border-green-500 text-white'
                          : 'border-gray-300 hover:border-green-400'
                      }`}
                    >
                      {estPresent && (
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </button>

                    {/* Infos scout */}
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm font-medium ${estPresent ? 'text-green-800' : 'text-gray-900'}`}>
                        {p.scout.nom} {p.scout.prenom}
                      </p>
                      {p.scout.numeroAdhesion && (
                        <p className="text-xs text-gray-500">{p.scout.numeroAdhesion}</p>
                      )}
                    </div>

                    {/* Fiche médicale (camps uniquement, information seule) */}
                    {activite?.type === 'CAMP' && (
                      p.scout.ficheMedicale ? (
                        <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-green-50 text-green-700 border border-green-100 flex-shrink-0">
                          🩺 Fiche à jour
                        </span>
                      ) : (
                        <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-orange-50 text-orange-700 border border-orange-100 flex-shrink-0">
                          ⚠️ Fiche manquante
                        </span>
                      )
                    )}

                    {/* Branche */}
                    {p.scout.brancheType && (
                      <span className="text-xs text-gray-500 hidden sm:inline">
                        {LABELS_BRANCHES[p.scout.brancheType] ?? p.scout.brancheType}
                      </span>
                    )}

                    {/* Commentaire */}
                    <input
                      type="text"
                      value={etat?.commentaire ?? ''}
                      onChange={(e) => setCommentaire(p.scout.id, e.target.value)}
                      placeholder="Commentaire (optionnel)"
                      className="w-48 text-xs border border-gray-200 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-[#1a4731] hidden sm:block"
                    />
                  </div>

                  {/* Commentaire mobile */}
                  <div className="mt-2 sm:hidden">
                    <input
                      type="text"
                      value={etat?.commentaire ?? ''}
                      onChange={(e) => setCommentaire(p.scout.id, e.target.value)}
                      placeholder="Commentaire (optionnel)"
                      className="w-full text-xs border border-gray-200 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-[#1a4731]"
                    />
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Bouton sticky */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 px-4 py-4 shadow-lg">
        <div className="max-w-4xl mx-auto flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <p className="text-sm text-gray-600 font-medium">
            {nbPresents} présent(s) sur {nbTotal} scout(s)
          </p>
          <button
            onClick={handleEnregistrer}
            disabled={enregistrerPresences.isPending || scouts.length === 0}
            className="w-full sm:w-auto bg-[#1a4731] text-white px-6 py-2 rounded-lg hover:bg-[#15392a] disabled:opacity-50 transition-colors text-sm font-medium"
          >
            {enregistrerPresences.isPending ? 'Enregistrement...' : 'Enregistrer les présences'}
          </button>
        </div>
      </div>
    </div>
  )
}
