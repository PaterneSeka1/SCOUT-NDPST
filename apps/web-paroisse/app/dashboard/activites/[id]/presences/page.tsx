'use client'

import { use, useState } from 'react'
import { toast } from 'sonner'
import {
  useActivite,
  usePresencesActivite,
  useEnregistrerPresences,
  type PresenceScout,
  type Activite,
} from '@/hooks/useActivites'
import { LABELS_BRANCHES } from '@scout/shared'
import { ScannerQR } from '@/app/components/ScannerQR'
import { decoderQrScout } from '@/lib/qr'
import { BackLink } from '@/app/components/ui/BackLink'
import { Camera, Stethoscope, FileSignature } from '@/lib/icons'
import { PERIMETRE_V1 } from '@scout/shared'

interface EtatPresence {
  scoutId: string
  present: boolean
  commentaire: string
}

export default function PagePresences({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const { data: activite } = useActivite(id)
  const { data: presencesData, isLoading, isError } = usePresencesActivite(id)
  if (isLoading)
    return (
      <div className="flex justify-center py-12">
        <span className="h-6 w-6 animate-spin rounded-full border-2 border-(--cp) border-t-transparent" />
      </div>
    )
  if (isError || !Array.isArray(presencesData))
    return <p className="text-sm text-red-700">Impossible de charger les présences.</p>
  return <FeuillePresences key={id} id={id} activite={activite} presencesData={presencesData} />
}

function FeuillePresences({
  id,
  activite,
  presencesData,
}: {
  id: string
  activite?: Activite
  presencesData: PresenceScout[]
}) {
  const enregistrerPresences = useEnregistrerPresences(id)

  const [presences, setPresences] = useState<EtatPresence[]>(() =>
    presencesData.map((p) => ({ scoutId: p.scout.id, present: p.present, commentaire: p.commentaire ?? '' })),
  )
  const [scannerOuvert, setScannerOuvert] = useState(false)

  const nbPresents = presences.filter((p) => p.present).length
  const nbTotal = presences.length

  function togglePresence(scoutId: string) {
    setPresences((prev) => prev.map((p) => (p.scoutId === scoutId ? { ...p, present: !p.present } : p)))
  }

  function setPresent(scoutId: string) {
    setPresences((prev) => prev.map((p) => (p.scoutId === scoutId ? { ...p, present: true } : p)))
  }

  function handleScan(contenu: string) {
    const scoutId = decoderQrScout(contenu)
    if (!scoutId) {
      toast.error('QR code non reconnu')
      return
    }
    const trouve = scouts.find((p: { scout: { id: string } }) => p.scout.id === scoutId)
    if (!trouve) {
      toast.error('Ce scout ne fait pas partie de cette liste')
      return
    }
    setPresent(scoutId)
    toast.success(`${trouve.scout.prenom} ${trouve.scout.nom} — présent`)
  }

  function setCommentaire(scoutId: string, commentaire: string) {
    setPresences((prev) => prev.map((p) => (p.scoutId === scoutId ? { ...p, commentaire } : p)))
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
        })),
      )
      toast.success('Présences enregistrées avec succès.')
    } catch (err) {
      toast.error((err as Error).message)
    }
  }

  const scouts = presencesData ?? []

  return (
    <div className="mx-auto max-w-4xl space-y-6 pb-32">
      {/* En-tête */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-4">
          <BackLink href={`/dashboard/activites/${id}`}>Retour</BackLink>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Feuille de présence</h1>
            {activite && (
              <p className="mt-1 text-sm text-gray-500">
                {activite.titre}
                {activite.brancheType && (
                  <span className="ml-2 text-gray-400">
                    — {LABELS_BRANCHES[activite.brancheType] ?? activite.brancheType}
                  </span>
                )}
              </p>
            )}
          </div>
        </div>

        {/* Compteur + boutons tout cocher */}
        <div className="flex shrink-0 items-center gap-3">
          <div className="text-right">
            <p className="text-2xl font-bold text-(--cp)">
              {nbPresents}/{nbTotal}
            </p>
            <p className="text-xs text-gray-500">présent(s)</p>
          </div>
          <div className="flex flex-col gap-1">
            <button
              onClick={toutCocher}
              className="rounded-lg bg-green-100 px-3 py-1 text-xs font-medium text-green-700 transition-colors hover:bg-green-200"
            >
              Tout cocher
            </button>
            <button
              onClick={toutDecocher}
              className="rounded-lg bg-gray-100 px-3 py-1 text-xs font-medium text-gray-600 transition-colors hover:bg-gray-200"
            >
              Tout décocher
            </button>
          </div>
          {/* Cartes QR hors périmètre V1 : rien à scanner. */}
          {!PERIMETRE_V1 && (
            <button
              onClick={() => setScannerOuvert(true)}
              className="flex items-center gap-1.5 rounded-lg bg-(--cp) px-3 py-2 text-xs font-medium text-white transition-all hover:brightness-110"
            >
              <Camera className="h-3.5 w-3.5" strokeWidth={2} />
              Scanner
            </button>
          )}
        </div>
      </div>

      {scannerOuvert && <ScannerQR onDetection={handleScan} onFermer={() => setScannerOuvert(false)} />}

      {/* Liste des scouts */}
      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
        {scouts.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            <p>Aucun scout trouvé pour cette activité.</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {scouts.map(
              (p: {
                present: boolean
                commentaire: string | null
                scout: {
                  id: string
                  nom: string
                  prenom: string
                  matricule: string | null
                  brancheType: string | null
                  autorisationCamp?: { ficheMedicale: boolean; autorisationParentale: boolean }
                }
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
                        aria-label={`Présence de ${p.scout.prenom} ${p.scout.nom}`}
                        aria-pressed={estPresent}
                        onClick={() => togglePresence(p.scout.id)}
                        className={`flex h-6 w-6 shrink-0 items-center justify-center rounded border-2 transition-colors ${
                          estPresent
                            ? 'border-green-500 bg-green-500 text-white'
                            : 'border-gray-300 hover:border-green-400'
                        }`}
                      >
                        {estPresent && (
                          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                          </svg>
                        )}
                      </button>

                      {/* Infos scout */}
                      <div className="min-w-0 flex-1">
                        <p className={`text-sm font-medium ${estPresent ? 'text-green-800' : 'text-gray-900'}`}>
                          {p.scout.nom} {p.scout.prenom}
                        </p>
                        {p.scout.matricule && <p className="text-xs text-gray-500">{p.scout.matricule}</p>}
                      </div>

                      {/* Autorisations de camp signées par le parent (camps uniquement, information seule) */}
                      {/* Hors périmètre V1 : sans espace parent, rien n'est jamais signé. */}
                      {!PERIMETRE_V1 && activite?.type === 'CAMP' && (
                        <div className="flex shrink-0 items-center gap-1.5">
                          <span
                            className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium ${
                              p.scout.autorisationCamp?.ficheMedicale
                                ? 'border-green-100 bg-green-50 text-green-700'
                                : 'border-orange-100 bg-orange-50 text-orange-700'
                            }`}
                          >
                            <Stethoscope className="h-3 w-3" strokeWidth={2} />
                            Fiche {p.scout.autorisationCamp?.ficheMedicale ? 'signée' : 'non signée'}
                          </span>
                          <span
                            className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium ${
                              p.scout.autorisationCamp?.autorisationParentale
                                ? 'border-green-100 bg-green-50 text-green-700'
                                : 'border-orange-100 bg-orange-50 text-orange-700'
                            }`}
                          >
                            <FileSignature className="h-3 w-3" strokeWidth={2} />
                            Autorisation {p.scout.autorisationCamp?.autorisationParentale ? 'signée' : 'non signée'}
                          </span>
                        </div>
                      )}

                      {/* Branche */}
                      {p.scout.brancheType && (
                        <span className="hidden text-xs text-gray-500 sm:inline">
                          {LABELS_BRANCHES[p.scout.brancheType] ?? p.scout.brancheType}
                        </span>
                      )}

                      {/* Commentaire */}
                      <input
                        type="text"
                        value={etat?.commentaire ?? ''}
                        onChange={(e) => setCommentaire(p.scout.id, e.target.value)}
                        aria-label={`Commentaire pour ${p.scout.prenom} ${p.scout.nom}`}
                        placeholder="Commentaire (optionnel)"
                        className="hidden w-48 rounded border border-gray-200 px-2 py-1 text-xs focus:ring-1 focus:ring-(--cp) focus:outline-none sm:block"
                      />
                    </div>

                    {/* Commentaire mobile */}
                    <div className="mt-2 sm:hidden">
                      <input
                        type="text"
                        value={etat?.commentaire ?? ''}
                        onChange={(e) => setCommentaire(p.scout.id, e.target.value)}
                        aria-label={`Commentaire pour ${p.scout.prenom} ${p.scout.nom}`}
                        placeholder="Commentaire (optionnel)"
                        className="w-full rounded border border-gray-200 px-2 py-1 text-xs focus:ring-1 focus:ring-(--cp) focus:outline-none"
                      />
                    </div>
                  </div>
                )
              },
            )}
          </div>
        )}
      </div>

      {/* Bouton sticky — z-50 : au-dessus des widgets flottants (z-40) du
          tableau de bord, pour que l'action d'enregistrement reste toujours
          cliquable sur grand écran (voir app/components/widgets/Widgets.tsx). */}
      <div className="fixed right-0 bottom-0 left-0 z-50 border-t border-gray-200 bg-white px-4 py-4 shadow-lg">
        <div className="mx-auto flex max-w-4xl flex-col items-start justify-between gap-3 sm:flex-row sm:items-center">
          <p className="text-sm font-medium text-gray-600">
            {nbPresents} présent(s) sur {nbTotal} scout(s)
          </p>
          <button
            onClick={handleEnregistrer}
            disabled={enregistrerPresences.isPending || scouts.length === 0}
            className="w-full rounded-lg bg-(--cp) px-6 py-2 text-sm font-medium text-white transition-all hover:brightness-110 disabled:opacity-50 sm:w-auto"
          >
            {enregistrerPresences.isPending ? 'Enregistrement...' : 'Enregistrer les présences'}
          </button>
        </div>
      </div>
    </div>
  )
}
