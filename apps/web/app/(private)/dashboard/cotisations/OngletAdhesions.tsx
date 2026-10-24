'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { toast } from 'sonner'
import { LABELS_BRANCHES, ROLES_BRANCHE, ROLES_GROUPE, anneeScolaireCourante } from '@scout/shared'
import { Badge, Card, DataTable, FilterBar, KpiCard, Select, Switch, type Colonne } from '@/components/ui'
import { useDefinirStatutCotisant, useStatutsCotisation, type ScoutStatutCotisation } from '@/hooks/useCotisations'
import { Wallet } from '@/lib/icons'
import { OPTIONS_BRANCHES, messageErreur, optionsAnnees } from './commun'

type FiltreSituation = '' | 'cotisants' | 'non-cotisants'

// Situation d'adhésion annuelle (ADHESION_ANNUELLE payée ou exonérée) par
// scout actif. Seul le Chef de Groupe bascule la situation (PUT /statuts).
export function OngletAdhesions({ role }: { role: string }) {
  const peutModifier = ROLES_GROUPE.includes(role)
  const estBranche = ROLES_BRANCHE.includes(role)

  const [anneeScolaire, setAnneeScolaire] = useState(anneeScolaireCourante())
  const [branche, setBranche] = useState('')
  const [situation, setSituation] = useState<FiltreSituation>('')

  const requeteStatuts = useStatutsCotisation(anneeScolaire, branche || undefined)
  const definir = useDefinirStatutCotisant()
  const scouts = useMemo(() => requeteStatuts.data?.scouts ?? [], [requeteStatuts.data])

  const cotisants = scouts.filter((s) => s.cotisant).length
  const affiches = useMemo(
    () =>
      situation === 'cotisants'
        ? scouts.filter((s) => s.cotisant)
        : situation === 'non-cotisants'
          ? scouts.filter((s) => !s.cotisant)
          : scouts,
    [scouts, situation],
  )

  async function basculer(s: ScoutStatutCotisation, cotisant: boolean) {
    try {
      await definir.mutateAsync({ scoutId: s.id, cotisant, anneeScolaire })
      toast.success(`${s.prenom} ${s.nom} : ${cotisant ? 'cotisant' : 'non cotisant'}.`)
    } catch (e) {
      toast.error(messageErreur(e))
    }
  }

  const colonnes: Colonne<ScoutStatutCotisation>[] = [
    {
      cle: 'scout',
      titre: 'Scout',
      principale: true,
      rendu: (s) => (
        <Link href={`/dashboard/scouts/${s.id}`} className="font-medium text-stone-900 hover:text-primaire hover:underline">
          {s.prenom} {s.nom}
        </Link>
      ),
    },
    { cle: 'matricule', titre: 'Matricule', masquee: 'md', rendu: (s) => s.matricule ?? '—' },
    { cle: 'branche', titre: 'Branche', rendu: (s) => LABELS_BRANCHES[s.brancheType] ?? s.brancheType },
    {
      cle: 'situation',
      titre: 'Adhésion',
      rendu: (s) =>
        peutModifier ? (
          <Switch
            checked={s.cotisant}
            onChange={(v) => basculer(s, v)}
            disabled={definir.isPending}
            label={s.cotisant ? 'Cotisant' : 'Non cotisant'}
          />
        ) : (
          <Badge ton={s.cotisant ? 'succes' : 'attention'}>{s.cotisant ? 'Cotisant' : 'Non cotisant'}</Badge>
        ),
    },
  ]

  return (
    <div className="space-y-4">
      {requeteStatuts.data && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <KpiCard libelle="Cotisants" valeur={cotisants} detail={`Adhésion ${anneeScolaire}`} />
          <KpiCard libelle="Non cotisants" valeur={scouts.length - cotisants} />
          <KpiCard libelle="Scouts actifs" valeur={scouts.length} />
        </div>
      )}
      <Card>
        <div className="border-b border-stone-100 p-4">
          <FilterBar>
            <Select aria-label="Année scolaire" value={anneeScolaire} onChange={(e) => setAnneeScolaire(e.target.value)} options={optionsAnnees()} />
            {!estBranche && (
              <Select aria-label="Branche" value={branche} onChange={(e) => setBranche(e.target.value)} vide="Toutes les branches" options={OPTIONS_BRANCHES} />
            )}
            <Select
              aria-label="Situation"
              value={situation}
              onChange={(e) => setSituation(e.target.value as FiltreSituation)}
              vide="Toutes les situations"
              options={[
                { valeur: 'cotisants', libelle: 'Cotisants' },
                { valeur: 'non-cotisants', libelle: 'Non cotisants' },
              ]}
            />
          </FilterBar>
          {!peutModifier && (
            <p className="mt-3 text-xs text-stone-500">Seul le Chef de Groupe peut modifier la situation d’adhésion.</p>
          )}
        </div>
        <DataTable
          legende={`Adhésions ${anneeScolaire}`}
          colonnes={colonnes}
          lignes={requeteStatuts.data ? affiches : undefined}
          cleLigne={(s) => s.id}
          chargement={requeteStatuts.isFetching}
          erreur={requeteStatuts.isError ? messageErreur(requeteStatuts.error, 'Impossible de charger les adhésions.') : null}
          onReessayer={() => requeteStatuts.refetch()}
          vide={{ icone: Wallet, titre: 'Aucun scout pour ces critères' }}
        />
      </Card>
    </div>
  )
}
