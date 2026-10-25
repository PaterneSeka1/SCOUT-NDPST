'use client'
import { useState } from 'react'
import { LABELS_BRANCHES, PERMISSIONS_ADHESION } from '@scout/shared'
import { useComptes } from '@/hooks/useComptesAdmin'
import { useAdhesionsQuery } from '@/hooks/useAdhesionsNationales'
import { FormulaireAction, type ActionFinanciere } from '@/components/adhesions/FormulaireAction'
import { PageHeader } from '@/components/ui/PageHeader'
import { Button } from '@/components/ui/Button'
import { Field, Input } from '@/components/ui/Field'
interface Droit {
  id: string
  permission: string
  brancheType: string | null
  motif: string
  utilisateur: { nom: string; prenom: string }
}
export default function Page() {
  const [recherche, setRecherche] = useState('')
  const [action, setAction] = useState<ActionFinanciere | null>(null)
  const comptes = useComptes({ page: 1, recherche, actif: 'true' })
  const droits = useAdhesionsQuery<Droit[]>('/habilitations')
  return (
    <div className="space-y-5">
      <PageHeader
        titre="Habilitations financières"
        description="Attribuez chaque permission explicitement. Une habilitation sur une branche ne permet pas de gérer les lots du groupe."
      />
      <Field label="Rechercher le compte à habiliter">
        {(p) => (
          <Input
            {...p}
            value={recherche}
            onChange={(e) => setRecherche(e.target.value)}
            placeholder="Nom ou matricule"
          />
        )}
      </Field>
      {comptes.error && <p role="alert">{comptes.error.message}</p>}
      <Button
        disabled={!comptes.data?.utilisateurs.length}
        onClick={() =>
          setAction({
            titre: 'Attribuer une habilitation',
            description:
              'Cette action est nominative et journalisée. La lecture des dossiers du périmètre est incluse.',
            chemin: '/habilitations',
            champs: [
              {
                nom: 'utilisateurId',
                label: 'Compte',
                requis: true,
                options: comptes.data!.utilisateurs.map((u) => ({ valeur: u.id, libelle: `${u.prenom} ${u.nom}` })),
              },
              {
                nom: 'permission',
                label: 'Permission',
                requis: true,
                options: PERMISSIONS_ADHESION.map((p) => ({ valeur: p, libelle: p })),
              },
              {
                nom: 'brancheType',
                label: 'Périmètre (vide : tout le groupe)',
                options: Object.entries(LABELS_BRANCHES).map(([valeur, libelle]) => ({ valeur, libelle })),
              },
              { nom: 'motif', label: 'Justification', requis: true },
            ],
          })
        }
      >
        Attribuer une permission
      </Button>
      {droits.isLoading && <p role="status">Chargement…</p>}
      {droits.error && <p role="alert">{droits.error.message}</p>}
      <ul className="divide-y rounded-lg border bg-white p-4">
        {droits.data?.map((d) => (
          <li key={d.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
            <p>
              {d.utilisateur.prenom} {d.utilisateur.nom} · {d.permission} ·{' '}
              {d.brancheType ? LABELS_BRANCHES[d.brancheType] : 'Tout le groupe'}
              <span className="block text-sm text-stone-500">{d.motif}</span>
            </p>
            <Button
              variante="danger"
              taille="sm"
              onClick={() =>
                setAction({
                  titre: 'Révoquer l’habilitation',
                  description: 'Les prochaines opérations seront refusées pour cette permission et ce périmètre.',
                  chemin: `/habilitations/${d.id}/revoquer`,
                  champs: [{ nom: 'motif', label: 'Motif du retrait', requis: true }],
                })
              }
            >
              Révoquer
            </Button>
          </li>
        ))}
      </ul>
      {action && <FormulaireAction key={action.chemin} action={action} fermer={() => setAction(null)} />}
    </div>
  )
}
