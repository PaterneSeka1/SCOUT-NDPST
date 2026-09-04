'use client'

import { use, useState, useEffect } from 'react'
import { toast } from 'sonner'
import { useActivite, usePresencesActivite, useEnregistrerPresences } from '@/hooks/useActivites'
import { LABELS_BRANCHES } from '@/lib/branches'
import { ScannerQR } from '@/app/components/ScannerQR'
import { decoderQrScout } from '@/lib/qr'
import { BackLink } from '@/app/components/ui/BackLink'
import { Camera, Stethoscope, FileSignature } from '@/lib/icons'

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
  const [scannerOuvert, setScannerOuvert] = useState(false)

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

  function setPresent(scoutId: string) {
    setPresences((prev) =>
      prev.map((p) => (p.scoutId === scoutId ? { ...p, present: true } : p))
    )
  }

  function handleScan(contenu: string) {
    const scoutId = decoderQrScout(contenu)
    if (!scoutId) { toast.error('QR code non reconnu'); return }
    const trouve = scouts.find((p: { scout: { id: string } }) => p.scout.id === scoutId)
    if (!trouve) { toast.error('Ce scout ne fait pas partie de cette liste'); return }
    setPresent(scoutId)
    toast.success(`${trouve.scout.prenom} ${trouve.scout.nom} — présent`)
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
          <BackLink href={`/dashboard/activites/${id}`}>Retour</BackLink>
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
            <p className="text-2xl font-bold text-[var(--cp)]">{nbPresents}/{nbTotal}</p>
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
          <button
            onClick={() => setScannerOuvert(true)}
            className="text-xs px-3 py-2 bg-[var(--cp)] text-white rounded-lg hover:brightness-110 transition-all font-medium flex items-center gap-1.5"
          >
            <Camera className="h-3.5 w-3.5" strokeWidth={2} />
            Scanner
          </button>
        </div>
      </div>

      {scannerOuvert && (
        <ScannerQR onDetection={handleScan} onFermer={() => setScannerOuvert(false)} />
      )}

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
              scout: { id: string; nom: string; prenom: string; numeroAdhesion: string | null; brancheType: string | null; autorisationCamp?: { ficheMedicale: boolean; autorisationParentale: boolean } }
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

                    {/* Autorisations de camp signées par le parent (camps uniquement, information seule) */}
                    {activite?.type === 'CAMP' && (
                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium border ${
                          p.scout.autorisationCamp?.ficheMedicale
                            ? 'bg-green-50 text-green-700 border-green-100'
                            : 'bg-orange-50 text-orange-700 border-orange-100'
                        }`}>
                          <Stethoscope className="h-3 w-3" strokeWidth={2} />
                          Fiche {p.scout.autorisationCamp?.ficheMedicale ? 'signée' : 'non signée'}
                        </span>
                        <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium border ${
                          p.scout.autorisationCamp?.autorisationParentale
                            ? 'bg-green-50 text-green-700 border-green-100'
                            : 'bg-orange-50 text-orange-700 border-orange-100'
                        }`}>
                          <FileSignature className="h-3 w-3" strokeWidth={2} />
                          Autorisation {p.scout.autorisationCamp?.autorisationParentale ? 'signée' : 'non signée'}
                        </span>
                      </div>
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
                      className="w-48 text-xs border border-gray-200 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-[var(--cp)] hidden sm:block"
                    />
                  </div>

                  {/* Commentaire mobile */}
                  <div className="mt-2 sm:hidden">
                    <input
                      type="text"
                      value={etat?.commentaire ?? ''}
                      onChange={(e) => setCommentaire(p.scout.id, e.target.value)}
                      placeholder="Commentaire (optionnel)"
                      className="w-full text-xs border border-gray-200 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-[var(--cp)]"
                    />
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Bouton sticky — z-50 : au-dessus des widgets flottants (z-40) du
          tableau de bord, pour que l'action d'enregistrement reste toujours
          cliquable sur grand écran (voir app/components/widgets/Widgets.tsx). */}
      <div className="fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-gray-200 px-4 py-4 shadow-lg">
        <div className="max-w-4xl mx-auto flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <p className="text-sm text-gray-600 font-medium">
            {nbPresents} présent(s) sur {nbTotal} scout(s)
          </p>
          <button
            onClick={handleEnregistrer}
            disabled={enregistrerPresences.isPending || scouts.length === 0}
            className="w-full sm:w-auto bg-[var(--cp)] text-white px-6 py-2 rounded-lg hover:brightness-110 disabled:opacity-50 transition-all text-sm font-medium"
          >
            {enregistrerPresences.isPending ? 'Enregistrement...' : 'Enregistrer les présences'}
          </button>
        </div>
      </div>
    </div>
  )
}
