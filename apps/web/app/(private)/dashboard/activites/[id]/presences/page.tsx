'use client'

import { useState } from 'react'
import { useParams } from 'next/navigation'
import { toast } from 'sonner'
import { LABELS_BRANCHES } from '@scout/shared'
import { Badge, Button, Card, ChargementPage, EmptyState, ErrorState, Input, PageHeader } from '@/components/ui'
import { ScannerQR } from '@/components/ScannerQR'
import { decoderQrScout } from '@/lib/qr'
import { Camera, Check, FileSignature, Stethoscope, Users } from '@/lib/icons'
import {
  useActivite,
  useEnregistrerPresences,
  usePresencesActivite,
  type Activite,
  type PresenceActivite,
} from '@/hooks/useActivites'

export default function PagePresencesActivite() {
  const { id } = useParams<{ id: string }>()
  const activite = useActivite(id)
  const presences = usePresencesActivite(id)

  if (presences.isLoading || activite.isLoading) return <ChargementPage />
  if (presences.error || !presences.data)
    return <ErrorState message={presences.error?.message} onReessayer={() => presences.refetch()} />

  return <FeuillePresences key={id} id={id} activite={activite.data} lignes={presences.data} />
}

interface Etat {
  present: boolean
  commentaire: string
}

function FeuillePresences({ id, activite, lignes }: { id: string; activite?: Activite; lignes: PresenceActivite[] }) {
  const enregistrer = useEnregistrerPresences(id)
  const [etats, setEtats] = useState<Record<string, Etat>>(() =>
    Object.fromEntries(lignes.map((l) => [l.scout.id, { present: l.present, commentaire: l.commentaire ?? '' }])),
  )
  const [modifie, setModifie] = useState(false)
  const [scanner, setScanner] = useState(false)

  const nbPresents = Object.values(etats).filter((e) => e.present).length
  const estCamp = activite?.type === 'CAMP'

  function maj(scoutId: string, partiel: Partial<Etat>) {
    setModifie(true)
    setEtats((prev) => ({ ...prev, [scoutId]: { ...prev[scoutId], ...partiel } }))
  }

  function tous(present: boolean) {
    setModifie(true)
    setEtats((prev) => Object.fromEntries(Object.entries(prev).map(([k, v]) => [k, { ...v, present }])))
  }

  function scan(contenu: string) {
    const scoutId = decoderQrScout(contenu)
    if (!scoutId) return toast.error('QR code non reconnu.')
    const ligne = lignes.find((l) => l.scout.id === scoutId)
    if (!ligne) return toast.error('Ce scout ne fait pas partie de cette liste.')
    maj(scoutId, { present: true })
    toast.success(`${ligne.scout.prenom} ${ligne.scout.nom} : présent.`)
  }

  async function sauvegarder() {
    try {
      await enregistrer.mutateAsync(
        lignes.map((l) => ({
          scoutId: l.scout.id,
          present: etats[l.scout.id]?.present ?? false,
          commentaire: etats[l.scout.id]?.commentaire.trim() || null,
        })),
      )
      setModifie(false)
      toast.success('Présences enregistrées.')
    } catch (e) {
      toast.error((e as Error).message)
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        titre="Feuille de présence"
        description={
          activite
            ? `${activite.titre} — ${activite.brancheType ? (LABELS_BRANCHES[activite.brancheType] ?? activite.brancheType) : 'inter-branches'}`
            : undefined
        }
        miettes={[
          { libelle: 'Tableau de bord', href: '/dashboard' },
          { libelle: 'Activités et camps', href: '/dashboard/activites' },
          { libelle: activite?.titre ?? 'Activité', href: `/dashboard/activites/${id}` },
          { libelle: 'Présences' },
        ]}
        actions={
          lignes.length > 0 && (
            <>
              <Button variante="secondaire" taille="sm" onClick={() => tous(true)}>
                Tous présents
              </Button>
              <Button variante="secondaire" taille="sm" onClick={() => tous(false)}>
                Tous absents
              </Button>
              <Button variante="secondaire" taille="sm" icone={Camera} onClick={() => setScanner(true)}>
                Scanner un QR
              </Button>
            </>
          )
        }
      />

      {scanner && <ScannerQR onDetection={scan} onFermer={() => setScanner(false)} />}

      <Card>
        {lignes.length === 0 ? (
          <EmptyState icon={Users} title="Aucun scout actif concerné" description="Aucun scout actif n’est rattaché à la branche de cette activité." />
        ) : (
          <ul className="divide-y divide-stone-100">
            {lignes.map((l) => {
              const etat = etats[l.scout.id]
              const nom = `${l.scout.prenom} ${l.scout.nom}`
              return (
                <li key={l.scout.id} className={`flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center ${etat?.present ? 'bg-foret-50/50' : ''}`}>
                  <div className="flex min-w-0 flex-1 items-center gap-3">
                    <button
                      type="button"
                      role="checkbox"
                      aria-checked={etat?.present ?? false}
                      aria-label={`Présence de ${nom}`}
                      onClick={() => maj(l.scout.id, { present: !etat?.present })}
                      className={`flex h-6 w-6 shrink-0 items-center justify-center rounded border-2 transition ${
                        etat?.present ? 'border-primaire bg-primaire text-white' : 'border-stone-300 hover:border-primaire'
                      }`}
                    >
                      {etat?.present && <Check className="h-4 w-4" strokeWidth={3} aria-hidden />}
                    </button>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-stone-900">
                        {l.scout.nom} {l.scout.prenom}
                      </p>
                      <p className="text-xs text-stone-500">
                        {[l.scout.matricule, l.scout.brancheType ? LABELS_BRANCHES[l.scout.brancheType] : null].filter(Boolean).join(' · ')}
                      </p>
                    </div>
                  </div>
                  {estCamp && l.scout.autorisationCamp && (
                    <div className="flex flex-wrap gap-1.5">
                      <Badge ton={l.scout.autorisationCamp.ficheMedicale ? 'succes' : 'attention'}>
                        <Stethoscope className="h-3 w-3" aria-hidden />
                        Fiche médicale {l.scout.autorisationCamp.ficheMedicale ? 'confirmée' : 'manquante'}
                      </Badge>
                      <Badge ton={l.scout.autorisationCamp.autorisationParentale ? 'succes' : 'attention'}>
                        <FileSignature className="h-3 w-3" aria-hidden />
                        Autorisation {l.scout.autorisationCamp.autorisationParentale ? 'confirmée' : 'manquante'}
                      </Badge>
                    </div>
                  )}
                  <Input
                    aria-label={`Commentaire pour ${nom}`}
                    placeholder="Commentaire (facultatif)"
                    value={etat?.commentaire ?? ''}
                    onChange={(e) => maj(l.scout.id, { commentaire: e.target.value })}
                    className="sm:w-56"
                  />
                </li>
              )
            })}
          </ul>
        )}
      </Card>

      {lignes.length > 0 && (
        <div className="sticky bottom-4 z-10 rounded-xl border border-stone-200 bg-white/95 px-4 py-3 shadow-lg backdrop-blur">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-stone-600" aria-live="polite">
              <span className="font-semibold text-stone-900 tabular-nums">{nbPresents}</span> présent{nbPresents > 1 ? 's' : ''} sur {lignes.length}
              {modifie && <span className="ml-2 text-amber-700">· modifications non enregistrées</span>}
            </p>
            <Button onClick={sauvegarder} chargement={enregistrer.isPending} disabled={!modifie}>
              Enregistrer
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
