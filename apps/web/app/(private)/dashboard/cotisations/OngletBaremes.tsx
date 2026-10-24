'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { LABELS_BRANCHES, LABELS_TYPE_COTISATION, anneeScolaireCourante, formatMontantFCFA } from '@scout/shared'
import { Button, Card, DataTable, Field, FilterBar, Input, Modal, Select, confirmer, type Colonne } from '@/components/ui'
import { useBaremes, useEnregistrerBareme, useSupprimerBareme, type Bareme } from '@/hooks/useCotisations'
import { Coins, Pencil, Plus, Trash2 } from '@/lib/icons'
import { OPTIONS_BRANCHES, messageErreur, optionsAnnees } from './commun'

const OPTIONS_TYPES = Object.entries(LABELS_TYPE_COTISATION).map(([valeur, libelle]) => ({ valeur, libelle }))

// Barème de référence : montants saisis par la direction, jamais pré-remplis.
export function OngletBaremes() {
  const [anneeScolaire, setAnneeScolaire] = useState(anneeScolaireCourante())
  const [edition, setEdition] = useState<Bareme | 'nouveau' | null>(null)
  const requeteBaremes = useBaremes(anneeScolaire)
  const supprimer = useSupprimerBareme()

  async function retirer(b: Bareme) {
    const ok = await confirmer({
      titre: 'Supprimer ce barème ?',
      description: `Le montant de référence ${formatMontantFCFA(b.montant)} (${LABELS_TYPE_COTISATION[b.type] ?? b.type}${b.libelle ? ` — ${b.libelle}` : ''}) sera supprimé. Les cotisations déjà créées ne changent pas.`,
      labelConfirmer: 'Supprimer',
      danger: true,
    })
    if (!ok) return
    try {
      await supprimer.mutateAsync(b.id)
      toast.success('Barème supprimé.')
    } catch (e) {
      toast.error(messageErreur(e))
    }
  }

  const colonnes: Colonne<Bareme>[] = [
    {
      cle: 'type',
      titre: 'Type',
      principale: true,
      rendu: (b) => (
        <span className="font-medium text-stone-900">
          {LABELS_TYPE_COTISATION[b.type] ?? b.type}
          {b.libelle && <span className="font-normal text-stone-500"> — {b.libelle}</span>}
        </span>
      ),
    },
    { cle: 'branche', titre: 'Branche', rendu: (b) => (b.brancheType ? LABELS_BRANCHES[b.brancheType] ?? b.brancheType : 'Toutes les branches') },
    { cle: 'montant', titre: 'Montant', className: 'tabular-nums', rendu: (b) => formatMontantFCFA(b.montant) },
  ]

  return (
    <Card>
      <div className="border-b border-stone-100 p-4">
        <FilterBar
          actions={
            <Button icone={Plus} variante="secondaire" onClick={() => setEdition('nouveau')}>
              Ajouter un barème
            </Button>
          }
        >
          <Select aria-label="Année scolaire" value={anneeScolaire} onChange={(e) => setAnneeScolaire(e.target.value)} options={optionsAnnees()} />
        </FilterBar>
      </div>
      <DataTable
        legende={`Barèmes ${anneeScolaire}`}
        colonnes={colonnes}
        lignes={requeteBaremes.data?.baremes}
        cleLigne={(b) => b.id}
        chargement={requeteBaremes.isFetching}
        erreur={requeteBaremes.isError ? messageErreur(requeteBaremes.error, 'Impossible de charger les barèmes.') : null}
        onReessayer={() => requeteBaremes.refetch()}
        vide={{
          icone: Coins,
          titre: `Aucun barème pour ${anneeScolaire}`,
          description: 'Saisissez les montants décidés par le groupe ; ils seront proposés à la création des cotisations.',
        }}
        actions={(b) => (
          <>
            <Button taille="sm" variante="fantome" icone={Pencil} onClick={() => setEdition(b)}>
              Modifier
            </Button>
            <Button taille="sm" variante="fantome" icone={Trash2} onClick={() => retirer(b)} disabled={supprimer.isPending}>
              <span className="sr-only">Supprimer</span>
            </Button>
          </>
        )}
      />
      <Modal ouvert={edition !== null} onFermer={() => setEdition(null)} titre={edition === 'nouveau' ? 'Nouveau barème' : 'Modifier le barème'}>
        {edition !== null && (
          <FormulaireBareme
            key={edition === 'nouveau' ? 'nouveau' : edition.id}
            bareme={edition === 'nouveau' ? null : edition}
            anneeParDefaut={anneeScolaire}
            onFermer={() => setEdition(null)}
          />
        )}
      </Modal>
    </Card>
  )
}

function FormulaireBareme({ bareme, anneeParDefaut, onFermer }: { bareme: Bareme | null; anneeParDefaut: string; onFermer: () => void }) {
  const enregistrer = useEnregistrerBareme()
  const [anneeScolaire, setAnneeScolaire] = useState(bareme?.anneeScolaire ?? anneeParDefaut)
  const [type, setType] = useState(bareme?.type ?? 'ADHESION_ANNUELLE')
  const [brancheType, setBrancheType] = useState(bareme?.brancheType ?? '')
  const [libelle, setLibelle] = useState(bareme?.libelle ?? '')
  const [montant, setMontant] = useState(bareme ? String(bareme.montant) : '')
  const [erreur, setErreur] = useState<string | null>(null)

  async function soumettre(e: React.FormEvent) {
    e.preventDefault()
    const valeur = Number(montant)
    if (montant.trim() === '' || !Number.isInteger(valeur) || valeur < 0) {
      setErreur('Saisissez un montant entier positif ou nul.')
      return
    }
    setErreur(null)
    try {
      await enregistrer.mutateAsync({
        id: bareme?.id,
        anneeScolaire,
        type,
        brancheType: brancheType || null,
        libelle: libelle.trim() || null,
        montant: valeur,
      })
      toast.success(bareme ? 'Barème modifié.' : 'Barème ajouté.')
      onFermer()
    } catch (err) {
      toast.error(messageErreur(err))
    }
  }

  return (
    <form onSubmit={soumettre} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Année scolaire" requis>
          {(p) => <Select {...p} value={anneeScolaire} onChange={(e) => setAnneeScolaire(e.target.value)} options={optionsAnnees()} />}
        </Field>
        <Field label="Type" requis>
          {(p) => <Select {...p} value={type} onChange={(e) => setType(e.target.value)} options={OPTIONS_TYPES} />}
        </Field>
      </div>
      <Field label="Branche" aide="Laissez vide pour un montant valable pour toutes les branches.">
        {(p) => <Select {...p} value={brancheType} onChange={(e) => setBrancheType(e.target.value)} vide="Toutes les branches" options={OPTIONS_BRANCHES} />}
      </Field>
      <Field label="Libellé" aide="Facultatif, par exemple « Camp de Pâques ».">
        {(p) => <Input {...p} value={libelle} maxLength={200} onChange={(e) => setLibelle(e.target.value)} />}
      </Field>
      <Field label="Montant (FCFA)" requis erreur={erreur}>
        {(p) => <Input {...p} type="number" min={0} step={1} inputMode="numeric" value={montant} onChange={(e) => setMontant(e.target.value)} />}
      </Field>
      <div className="flex justify-end gap-2 pt-2">
        <Button variante="secondaire" onClick={onFermer}>
          Annuler
        </Button>
        <Button type="submit" chargement={enregistrer.isPending}>
          Enregistrer
        </Button>
      </div>
    </form>
  )
}
