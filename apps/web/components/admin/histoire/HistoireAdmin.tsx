'use client'

import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { LABELS_TYPE_EVENEMENT_HISTORIQUE } from '@scout/shared'
import {
  Alert,
  Badge,
  Button,
  Card,
  ChargementPage,
  EmptyState,
  ErrorState,
  PageHeader,
  confirmer,
} from '@/components/ui'
import { api } from '@/lib/api'
import { dateLongue } from '@/lib/format'
import { Pencil, Plus, ScrollText, Trash2 } from '@/lib/icons'
import { messageErreur, miettesAdmin } from '@/components/admin/commun'
import { FormulaireEvenement, type EvenementHistorique } from './FormulaireEvenement'

const CLE = ['admin', 'histoire'] as const

export function HistoireAdmin() {
  const client = useQueryClient()
  const requete = useQuery({
    queryKey: CLE,
    queryFn: () => api<EvenementHistorique[]>('/api/admin/histoire'),
  })
  // null : fermé ; 'nouveau' : création ; sinon l'événement modifié.
  const [edition, setEdition] = useState<EvenementHistorique | 'nouveau' | null>(null)

  const suppression = useMutation({
    mutationFn: (id: string) => api(`/api/admin/histoire/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      toast.success('Événement supprimé.')
      client.invalidateQueries({ queryKey: CLE })
    },
    onError: (e) => toast.error(messageErreur(e)),
  })

  async function supprimer(evenement: EvenementHistorique) {
    const ok = await confirmer({
      titre: 'Supprimer cet événement ?',
      description: `« ${evenement.titre} » (${evenement.annee}) sera définitivement retiré de la frise, y compris du site public s'il y était publié. Cette action est irréversible.`,
      labelConfirmer: 'Supprimer',
      danger: true,
    })
    if (ok) suppression.mutate(evenement.id)
  }

  const evenements = requete.data
    ? [...requete.data].sort((a, b) => a.annee - b.annee || a.ordre - b.ordre)
    : undefined

  return (
    <div className="space-y-6">
      <PageHeader
        titre="Histoire du groupe"
        description="Frise chronologique du groupe : chaque fait cite sa source et n'est publié qu'après décision explicite."
        miettes={miettesAdmin({ libelle: 'Histoire du groupe' })}
        actions={
          <Button icone={Plus} onClick={() => setEdition('nouveau')}>
            Ajouter un événement
          </Button>
        }
      />

      <Alert niveau="info" titre="Fiabilité de la mémoire du groupe">
        Un événement « À vérifier » peut être publié, mais le site signale qu&apos;il reste à confirmer. Marquez-le « Validé » uniquement
        lorsqu&apos;une source (archive, témoignage recueilli, document) le confirme.
      </Alert>

      {requete.isPending ? (
        <ChargementPage libelle="Chargement de la frise…" />
      ) : requete.isError ? (
        <Card>
          <ErrorState message={messageErreur(requete.error)} onReessayer={() => requete.refetch()} />
        </Card>
      ) : !evenements || evenements.length === 0 ? (
        <Card>
          <EmptyState
            icon={ScrollText}
            title="La frise est vide"
            description="Ajoutez le premier fait marquant : l'arrivée du scoutisme dans la paroisse, la fondation du groupe, un camp historique…"
            action={
              <Button icone={Plus} onClick={() => setEdition('nouveau')}>
                Ajouter un événement
              </Button>
            }
          />
        </Card>
      ) : (
        <ol className="relative space-y-4 border-l-2 border-sable-200 pl-6" aria-label="Frise chronologique">
          {evenements.map((e) => (
            <li key={e.id} className="relative">
              <span className="absolute top-5 -left-[31px] h-3 w-3 rounded-full border-2 border-white bg-primaire ring-2 ring-sable-200" aria-hidden />
              <Card as="article" className="p-4 sm:p-5">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-primaire tabular-nums">
                      {e.annee}
                      {e.date && <span className="ml-2 font-normal text-stone-500">{dateLongue(e.date)}</span>}
                    </p>
                    <h2 className="mt-0.5 text-base font-semibold text-stone-900">{e.titre}</h2>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      <Badge ton="neutre">{LABELS_TYPE_EVENEMENT_HISTORIQUE[e.type] ?? e.type}</Badge>
                      {e.statutValidation === 'VALIDE' ? (
                        <Badge ton="succes">Validé</Badge>
                      ) : (
                        <Badge ton="attention">À vérifier</Badge>
                      )}
                      {e.publie ? <Badge ton="primaire">Publié</Badge> : <Badge ton="neutre">Non publié</Badge>}
                    </div>
                    {e.source && (
                      <p className="mt-2 line-clamp-2 text-xs text-stone-500">
                        <span className="font-medium">Source :</span> {e.source}
                      </p>
                    )}
                  </div>
                  <div className="flex shrink-0 gap-1">
                    <Button variante="secondaire" taille="sm" icone={Pencil} onClick={() => setEdition(e)}>
                      Modifier
                    </Button>
                    <Button
                      variante="fantome"
                      taille="sm"
                      icone={Trash2}
                      aria-label={`Supprimer « ${e.titre} »`}
                      chargement={suppression.isPending && suppression.variables === e.id}
                      onClick={() => supprimer(e)}
                    />
                  </div>
                </div>
              </Card>
            </li>
          ))}
        </ol>
      )}

      {edition !== null && (
        <FormulaireEvenement
          key={edition === 'nouveau' ? 'nouveau' : `${edition.id}-${edition.updatedAt}`}
          evenement={edition === 'nouveau' ? null : edition}
          onFermer={() => setEdition(null)}
        />
      )}
    </div>
  )
}
