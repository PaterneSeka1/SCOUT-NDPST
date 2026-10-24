'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { LABELS_TYPE_COTISATION, formatMontantFCFA } from '@scout/shared'
import { Button, Field, Input, Modal, Select, Textarea } from '@/components/ui'
import { useModifierCotisation, type Cotisation } from '@/hooks/useCotisations'
import { messageErreur } from './commun'

const OPTIONS = [
  { valeur: 'PAYEE', libelle: 'Payée intégralement' },
  { valeur: 'PARTIELLEMENT_PAYEE', libelle: 'Paiement partiel' },
  { valeur: 'EN_ATTENTE', libelle: 'En attente (annuler le paiement)' },
]

/** Enregistrement d'un paiement (total ou partiel) sur une cotisation. */
export function ModalePaiement({ cotisation, onFermer }: { cotisation: Cotisation | null; onFermer: () => void }) {
  return (
    <Modal
      ouvert={!!cotisation}
      onFermer={onFermer}
      titre="Enregistrer un paiement"
      description={
        cotisation
          ? `${cotisation.scout.prenom} ${cotisation.scout.nom} — ${cotisation.libelle || LABELS_TYPE_COTISATION[cotisation.type] || cotisation.type}, ${formatMontantFCFA(cotisation.montant)} dus`
          : undefined
      }
    >
      {/* Le formulaire est remonté à chaque cotisation pour repartir de ses valeurs. */}
      {cotisation && <FormulairePaiement key={cotisation.id} cotisation={cotisation} onFermer={onFermer} />}
    </Modal>
  )
}

function FormulairePaiement({ cotisation, onFermer }: { cotisation: Cotisation; onFermer: () => void }) {
  const modifier = useModifierCotisation()
  const [statut, setStatut] = useState(cotisation.statut === 'PARTIELLEMENT_PAYEE' ? 'PARTIELLEMENT_PAYEE' : 'PAYEE')
  const [montantPaye, setMontantPaye] = useState(cotisation.montantPaye > 0 ? String(cotisation.montantPaye) : '')
  const [modePaiement, setModePaiement] = useState(cotisation.modePaiement ?? '')
  const [notes, setNotes] = useState(cotisation.notes ?? '')
  const [erreur, setErreur] = useState<string | null>(null)

  async function enregistrer(e: React.FormEvent) {
    e.preventDefault()
    setErreur(null)
    let montant: number | undefined
    if (statut === 'PARTIELLEMENT_PAYEE') {
      montant = Number(montantPaye)
      if (!Number.isInteger(montant) || montant <= 0 || montant >= cotisation.montant) {
        setErreur(`Saisissez un montant entier entre 1 et ${formatMontantFCFA(cotisation.montant - 1)}.`)
        return
      }
    }
    try {
      await modifier.mutateAsync({
        id: cotisation.id,
        statut,
        ...(montant !== undefined ? { montantPaye: montant } : {}),
        modePaiement: modePaiement.trim() || null,
        notes: notes.trim() || null,
      })
      toast.success(statut === 'EN_ATTENTE' ? 'Paiement annulé.' : 'Paiement enregistré.')
      onFermer()
    } catch (err) {
      toast.error(messageErreur(err))
    }
  }

  return (
    <form onSubmit={enregistrer} className="space-y-4">
      <Field label="Situation" requis>
        {(p) => <Select {...p} value={statut} onChange={(e) => setStatut(e.target.value)} options={OPTIONS} />}
      </Field>
      {statut === 'PARTIELLEMENT_PAYEE' && (
        <Field label="Montant total déjà payé (FCFA)" requis erreur={erreur} aide="Cumul des versements, inférieur au montant dû.">
          {(p) => <Input {...p} type="number" min={1} step={1} inputMode="numeric" value={montantPaye} onChange={(e) => setMontantPaye(e.target.value)} />}
        </Field>
      )}
      <Field label="Mode de paiement" aide="Par exemple : espèces, Mobile Money, virement.">
        {(p) => <Input {...p} value={modePaiement} maxLength={100} onChange={(e) => setModePaiement(e.target.value)} />}
      </Field>
      <Field label="Notes">{(p) => <Textarea {...p} rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />}</Field>
      <div className="flex justify-end gap-2 pt-2">
        <Button variante="secondaire" onClick={onFermer}>
          Annuler
        </Button>
        <Button type="submit" chargement={modifier.isPending}>
          Enregistrer
        </Button>
      </div>
    </form>
  )
}
