'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { LABELS_BRANCHES, ORDRE_BRANCHES, ROLES_BRANCHE } from '@scout/shared'
import { useSession } from '@/lib/session-client'
import { ErreurApi } from '@/lib/api'
import { accentBranche } from '@/lib/branches-visuel'
import { Pencil, Plus, UsersRound } from '@/lib/icons'
import { peutGererEquipes, useCreerEquipe, useEquipes, useModifierEquipe, type Equipe } from '@/hooks/useEquipes'
import { useMaBranche } from '@/hooks/useBranches'
import { Badge, Button, EmptyState, ErrorState, Field, Input, Modal, PageHeader, Select, Skeleton, Tabs, Textarea, confirmer } from '@/components/ui'

// Équipes : sous-groupes d'une branche (sizaines, patrouilles, équipes…).
// Branches « jeunes » seulement : les ressources adultes n'ont pas d'équipes.
const BRANCHES_EQUIPES = ORDRE_BRANCHES.filter((b) => b !== 'RESSOURCES_ADULTES')

interface Brouillon {
  id?: string
  nom: string
  brancheType: string
  description: string
}

function FormulaireEquipe({ brouillon, branches, onFermer }: { brouillon: Brouillon; branches: string[]; onFermer: () => void }) {
  const [v, setV] = useState(brouillon)
  const [erreurs, setErreurs] = useState<{ nom?: string; brancheType?: string; serveur?: string }>({})
  const creer = useCreerEquipe()
  const modifier = useModifierEquipe()
  const edition = !!v.id

  async function enregistrer(e: React.FormEvent) {
    e.preventDefault()
    const trouvees: typeof erreurs = {}
    if (!v.nom.trim()) trouvees.nom = 'Indiquez le nom de l’équipe.'
    else if (v.nom.trim().length > 80) trouvees.nom = '80 caractères au plus.'
    if (!edition && !v.brancheType) trouvees.brancheType = 'Choisissez une branche.'
    setErreurs(trouvees)
    if (Object.keys(trouvees).length) return
    try {
      if (edition) await modifier.mutateAsync({ id: v.id!, nom: v.nom.trim(), description: v.description.trim() || null })
      else await creer.mutateAsync({ nom: v.nom.trim(), brancheType: v.brancheType, description: v.description.trim() || null })
      toast.success(edition ? 'Équipe modifiée.' : 'Équipe créée.')
      onFermer()
    } catch (err) {
      setErreurs({ serveur: err instanceof ErreurApi ? err.message : 'Enregistrement impossible.' })
    }
  }

  return (
    <Modal
      ouvert
      onFermer={onFermer}
      titre={edition ? 'Modifier l’équipe' : 'Nouvelle équipe'}
      pied={
        <>
          <Button variante="secondaire" onClick={onFermer}>
            Annuler
          </Button>
          <Button type="submit" form="formulaire-equipe" chargement={creer.isPending || modifier.isPending}>
            Enregistrer
          </Button>
        </>
      }
    >
      <form id="formulaire-equipe" onSubmit={enregistrer} className="space-y-4" noValidate>
        {erreurs.serveur && (
          <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-800">
            {erreurs.serveur}
          </p>
        )}
        <Field label="Nom" requis erreur={erreurs.nom} aide="Ex. : Sizaine des Gris, Patrouille Aigle.">
          {(p) => <Input {...p} maxLength={80} value={v.nom} onChange={(e) => setV({ ...v, nom: e.target.value })} />}
        </Field>
        <Field label="Branche" requis erreur={erreurs.brancheType} aide={edition ? 'La branche d’une équipe ne change pas.' : undefined}>
          {(p) => (
            <Select
              {...p}
              disabled={edition || branches.length === 1}
              vide={branches.length > 1 ? 'Choisir…' : undefined}
              value={v.brancheType}
              onChange={(e) => setV({ ...v, brancheType: e.target.value })}
              options={branches.map((b) => ({ valeur: b, libelle: LABELS_BRANCHES[b] ?? b }))}
            />
          )}
        </Field>
        <Field label="Description (facultatif)">
          {(p) => <Textarea {...p} rows={3} maxLength={500} value={v.description} onChange={(e) => setV({ ...v, description: e.target.value })} />}
        </Field>
      </form>
    </Modal>
  )
}

export default function PageEquipes() {
  const { data: session } = useSession()
  const role = session?.user?.role ?? ''
  const estBranche = ROLES_BRANCHE.includes(role)
  const gestion = peutGererEquipes(role)
  const [statut, setStatut] = useState<'actives' | 'archivees'>('actives')
  const equipes = useEquipes({ actif: statut === 'actives' })
  const maBranche = useMaBranche(estBranche)
  const modifier = useModifierEquipe()
  const [brouillon, setBrouillon] = useState<Brouillon | null>(null)

  const branchesGerees = estBranche ? (maBranche.data?.brancheType ? [maBranche.data.brancheType] : []) : BRANCHES_EQUIPES
  const liste = equipes.data ?? []
  const parBranche = BRANCHES_EQUIPES.map((b) => ({ brancheType: b, equipes: liste.filter((e) => e.brancheType === b) })).filter(
    (g) => g.equipes.length > 0 || (statut === 'actives' && branchesGerees.includes(g.brancheType)),
  )

  async function basculer(e: Equipe) {
    if (e.actif && !(await confirmer({ titre: `Archiver « ${e.nom} » ?`, description: 'Les scouts restent dans leur branche ; l’équipe n’est plus proposée.', labelConfirmer: 'Archiver' }))) return
    try {
      await modifier.mutateAsync({ id: e.id, actif: !e.actif })
      toast.success(e.actif ? 'Équipe archivée.' : 'Équipe réactivée.')
    } catch (err) {
      toast.error(err instanceof ErreurApi ? err.message : 'Modification impossible.')
    }
  }

  return (
    <div>
      <PageHeader
        miettes={[{ libelle: 'Tableau de bord', href: '/dashboard' }, { libelle: 'Équipes' }]}
        titre="Équipes"
        description="Les petites unités de vie de chaque branche : sizaines, patrouilles, équipes."
        actions={
          gestion && branchesGerees.length > 0 ? (
            <Button icone={Plus} onClick={() => setBrouillon({ nom: '', brancheType: branchesGerees.length === 1 ? branchesGerees[0] : '', description: '' })}>
              Nouvelle équipe
            </Button>
          ) : undefined
        }
      />
      <div className="mb-6">
        <Tabs
          label="Statut des équipes"
          actif={statut}
          onChange={setStatut}
          onglets={[
            { valeur: 'actives', libelle: 'Actives' },
            { valeur: 'archivees', libelle: 'Archivées' },
          ]}
        />
      </div>

      {equipes.isPending ? (
        <div className="grid gap-6 md:grid-cols-2">
          <Skeleton className="h-40 rounded-lg" />
          <Skeleton className="h-40 rounded-lg" />
        </div>
      ) : equipes.isError ? (
        <ErrorState message={equipes.error.message} onReessayer={() => void equipes.refetch()} className="rounded-lg border border-ligne bg-white" />
      ) : parBranche.length === 0 ? (
        <EmptyState
          icon={UsersRound}
          title={statut === 'actives' ? 'Aucune équipe pour le moment.' : 'Aucune équipe archivée.'}
          description={statut === 'actives' && gestion ? 'Créez la première équipe pour répartir les scouts de la branche.' : undefined}
          className="rounded-lg border border-ligne bg-white"
        />
      ) : (
        <div className="grid gap-6 md:grid-cols-2">
          {parBranche.map((g) => (
            <section key={g.brancheType} className="rounded-lg border border-ligne bg-white" style={{ borderTop: `4px solid ${accentBranche(g.brancheType)}` }} aria-labelledby={`b-${g.brancheType}`}>
              <h2 id={`b-${g.brancheType}`} className="px-5 pt-4 font-semibold text-encre">
                {LABELS_BRANCHES[g.brancheType]}
              </h2>
              {g.equipes.length === 0 ? (
                <p className="px-5 pt-2 pb-5 text-sm text-encre-pale">Aucune équipe dans cette branche.</p>
              ) : (
                <ul className="divide-y divide-ligne px-5 pb-2">
                  {g.equipes.map((e) => (
                    <li key={e.id} className="flex flex-wrap items-center gap-x-3 gap-y-2 py-3">
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-encre">{e.nom}</p>
                        {e.description && <p className="text-sm text-encre-pale">{e.description}</p>}
                      </div>
                      <Badge ton={e._count.scouts > 0 ? 'primaire' : 'neutre'}>
                        {e._count.scouts} scout{e._count.scouts > 1 ? 's' : ''}
                      </Badge>
                      {gestion && branchesGerees.includes(e.brancheType) && (
                        <div className="flex gap-1">
                          <Button
                            variante="fantome"
                            taille="sm"
                            icone={Pencil}
                            onClick={() => setBrouillon({ id: e.id, nom: e.nom, brancheType: e.brancheType, description: e.description ?? '' })}
                          >
                            Modifier<span className="sr-only"> {e.nom}</span>
                          </Button>
                          <Button variante="fantome" taille="sm" onClick={() => void basculer(e)}>
                            {e.actif ? 'Archiver' : 'Réactiver'}
                            <span className="sr-only"> {e.nom}</span>
                          </Button>
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </section>
          ))}
        </div>
      )}

      {brouillon && <FormulaireEquipe brouillon={brouillon} branches={branchesGerees} onFermer={() => setBrouillon(null)} />}
    </div>
  )
}
