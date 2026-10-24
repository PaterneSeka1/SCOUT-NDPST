'use client'

import { useState } from 'react'
import Link from 'next/link'
import { toast } from 'sonner'
import {
  LABELS_BRANCHES,
  LABELS_STATUT_COTISATION,
  LABELS_TYPE_COTISATION,
  ROLES_BRANCHE,
  ROLES_GESTION,
  ROLES_GROUPE,
  anneeScolaireCourante,
  formatMontantFCFA,
} from '@scout/shared'
import {
  Button,
  Card,
  DataTable,
  FilterBar,
  Pagination,
  SearchInput,
  Select,
  StatusBadge,
  confirmer,
  type Colonne,
} from '@/components/ui'
import { useCotisations, useModifierCotisation, useSupprimerCotisation, type Cotisation } from '@/hooks/useCotisations'
import { dateCourte } from '@/lib/format'
import { Coins, Trash2, Wallet } from '@/lib/icons'
import { ModalePaiement } from './ModalePaiement'
import { OPTIONS_BRANCHES, TONS_STATUT_COTISATION, messageErreur, optionsAnnees } from './commun'

const LIMITE = 20

const OPTIONS_STATUTS = Object.entries(LABELS_STATUT_COTISATION).map(([valeur, libelle]) => ({ valeur, libelle }))

export function OngletListe({ role }: { role: string }) {
  const peutEncaisser = ROLES_GESTION.includes(role)
  const peutSupprimer = ROLES_GROUPE.includes(role)
  const estBranche = ROLES_BRANCHE.includes(role)

  const [anneeScolaire, setAnneeScolaire] = useState(anneeScolaireCourante())
  const [statut, setStatut] = useState('')
  const [branche, setBranche] = useState('')
  const [recherche, setRecherche] = useState('')
  const [page, setPage] = useState(1)
  const [paiement, setPaiement] = useState<Cotisation | null>(null)

  const requeteListe = useCotisations({ anneeScolaire, statut, branche, recherche, page, limite: LIMITE })
  const modifier = useModifierCotisation()
  const supprimer = useSupprimerCotisation()

  const filtrer = <T,>(setter: (v: T) => void) => (v: T) => {
    setter(v)
    setPage(1)
  }

  async function exonerer(c: Cotisation) {
    const ok = await confirmer({
      titre: 'Exonérer cette cotisation ?',
      description: `${c.scout.prenom} ${c.scout.nom} sera dispensé(e) de cette cotisation de ${formatMontantFCFA(c.montant)}. Tout paiement déjà enregistré sur cette ligne sera remis à zéro.`,
      labelConfirmer: 'Exonérer',
    })
    if (!ok) return
    try {
      await modifier.mutateAsync({ id: c.id, statut: 'EXONEREE' })
      toast.success('Cotisation exonérée.')
    } catch (e) {
      toast.error(messageErreur(e))
    }
  }

  async function retirer(c: Cotisation) {
    const ok = await confirmer({
      titre: 'Supprimer cette cotisation ?',
      description: `La cotisation « ${c.libelle || LABELS_TYPE_COTISATION[c.type] || c.type} » de ${c.scout.prenom} ${c.scout.nom} (${formatMontantFCFA(c.montant)}) sera définitivement supprimée. À réserver aux saisies erronées.`,
      labelConfirmer: 'Supprimer',
      danger: true,
    })
    if (!ok) return
    try {
      await supprimer.mutateAsync(c.id)
      toast.success('Cotisation supprimée.')
    } catch (e) {
      toast.error(messageErreur(e))
    }
  }

  const colonnes: Colonne<Cotisation>[] = [
    {
      cle: 'scout',
      titre: 'Scout',
      principale: true,
      rendu: (c) => (
        <Link href={`/dashboard/scouts/${c.scout.id}`} className="font-medium text-stone-900 hover:text-primaire hover:underline">
          {c.scout.prenom} {c.scout.nom}
        </Link>
      ),
    },
    { cle: 'branche', titre: 'Branche', masquee: 'lg', rendu: (c) => LABELS_BRANCHES[c.scout.brancheType] ?? c.scout.brancheType },
    {
      cle: 'objet',
      titre: 'Objet',
      rendu: (c) => (
        <span>
          {LABELS_TYPE_COTISATION[c.type] ?? c.type}
          {c.libelle && <span className="text-stone-500"> — {c.libelle}</span>}
          {c.activite && <span className="block text-xs text-stone-500">{c.activite.titre}</span>}
        </span>
      ),
    },
    {
      cle: 'montant',
      titre: 'Payé / dû',
      className: 'tabular-nums',
      rendu: (c) =>
        c.statut === 'EXONEREE' ? (
          <span className="text-stone-500">{formatMontantFCFA(c.montant)} (exonéré)</span>
        ) : (
          <span>
            {formatMontantFCFA(c.montantPaye)} / {formatMontantFCFA(c.montant)}
          </span>
        ),
    },
    {
      cle: 'statut',
      titre: 'Statut',
      rendu: (c) => <StatusBadge valeur={c.statut} libelles={LABELS_STATUT_COTISATION} tons={TONS_STATUT_COTISATION} />,
    },
    {
      cle: 'paiement',
      titre: 'Paiement',
      masquee: 'md',
      rendu: (c) =>
        c.datePaiement ? (
          <span className="text-xs">
            {dateCourte(c.datePaiement)}
            {c.modePaiement && ` · ${c.modePaiement}`}
            {c.enregistrePar && <span className="block text-stone-500">par {c.enregistrePar.prenom} {c.enregistrePar.nom}</span>}
          </span>
        ) : (
          '—'
        ),
    },
  ]

  const donnees = requeteListe.data
  return (
    <Card>
      <div className="border-b border-stone-100 p-4">
        <FilterBar>
          <SearchInput valeur={recherche} onChange={filtrer(setRecherche)} placeholder="Nom, prénom ou matricule…" />
          <Select aria-label="Année scolaire" value={anneeScolaire} onChange={(e) => filtrer(setAnneeScolaire)(e.target.value)} options={optionsAnnees()} />
          <Select aria-label="Statut" value={statut} onChange={(e) => filtrer(setStatut)(e.target.value)} vide="Tous les statuts" options={OPTIONS_STATUTS} />
          {!estBranche && (
            <Select aria-label="Branche" value={branche} onChange={(e) => filtrer(setBranche)(e.target.value)} vide="Toutes les branches" options={OPTIONS_BRANCHES} />
          )}
        </FilterBar>
      </div>

      <DataTable
        legende={`Cotisations ${anneeScolaire}`}
        colonnes={colonnes}
        lignes={donnees?.cotisations}
        cleLigne={(c) => c.id}
        chargement={requeteListe.isFetching}
        erreur={requeteListe.isError ? messageErreur(requeteListe.error, 'Impossible de charger les cotisations.') : null}
        onReessayer={() => requeteListe.refetch()}
        vide={{
          icone: Wallet,
          titre: 'Aucune cotisation pour ces critères',
          description: 'Les cotisations sont créées par le Chef de Groupe, individuellement ou pour toute une branche.',
        }}
        actions={
          peutEncaisser || peutSupprimer
            ? (c) => (
                <>
                  {peutEncaisser && c.statut !== 'PAYEE' && c.statut !== 'EXONEREE' && (
                    <Button taille="sm" variante="secondaire" icone={Coins} onClick={() => setPaiement(c)}>
                      Paiement
                    </Button>
                  )}
                  {peutEncaisser && c.statut === 'PAYEE' && (
                    <Button taille="sm" variante="fantome" onClick={() => setPaiement(c)}>
                      Corriger
                    </Button>
                  )}
                  {peutEncaisser && c.statut !== 'EXONEREE' && (
                    <Button taille="sm" variante="fantome" onClick={() => exonerer(c)} disabled={modifier.isPending}>
                      Exonérer
                    </Button>
                  )}
                  {peutSupprimer && (
                    <Button taille="sm" variante="fantome" icone={Trash2} aria-label="Supprimer" onClick={() => retirer(c)} disabled={supprimer.isPending}>
                      <span className="sr-only">Supprimer</span>
                    </Button>
                  )}
                </>
              )
            : undefined
        }
      />

      {donnees && (
        <div className="border-t border-stone-100 px-4 py-3">
          <Pagination
            page={donnees.pagination.page}
            totalPages={donnees.pagination.totalPages}
            total={donnees.pagination.total}
            itemLabel="cotisation"
            onPageChange={setPage}
          />
        </div>
      )}

      <ModalePaiement cotisation={paiement} onFermer={() => setPaiement(null)} />
    </Card>
  )
}
