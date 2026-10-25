'use client'
import { useState } from 'react'
import { toast } from 'sonner'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Field, Input, Select } from '@/components/ui/Field'
import { useActionAdhesion } from '@/hooks/useAdhesionsNationales'
export interface ChampAction {
  nom: string
  label: string
  type?: 'text' | 'number' | 'datetime-local'
  requis?: boolean
  options?: { valeur: string; libelle: string }[]
  defaut?: string
}
export interface ActionFinanciere {
  titre: string
  description: string
  chemin: string
  champs: ChampAction[]
  fixes?: Record<string, unknown>
  method?: string
}
export function FormulaireAction({ action, fermer }: { action: ActionFinanciere; fermer: () => void }) {
  const mutation = useActionAdhesion()
  const [valeurs, setValeurs] = useState<Record<string, string>>(() =>
    Object.fromEntries(action.champs.map((c) => [c.nom, c.defaut ?? ''])),
  )
  return (
    <Modal
      ouvert
      onFermer={() => !mutation.isPending && fermer()}
      titre={action.titre}
      description={action.description}
    >
      <form
        className="space-y-4"
        onSubmit={async (e) => {
          e.preventDefault()
          if (mutation.isPending) return
          const donnees: Record<string, unknown> = { ...action.fixes }
          for (const c of action.champs) {
            const valeur = valeurs[c.nom]
            if (valeur)
              donnees[c.nom] =
                c.type === 'number'
                  ? Number(valeur)
                  : c.type === 'datetime-local'
                    ? new Date(valeur).toISOString()
                    : valeur
          }
          try {
            await mutation.mutateAsync({ chemin: action.chemin, donnees, method: action.method })
            toast.success('Opération enregistrée')
            fermer()
          } catch (err) {
            toast.error(err instanceof Error ? err.message : 'Échec de l’opération')
          }
        }}
      >
        {action.champs.map((c) => (
          <Field key={c.nom} label={c.label} requis={c.requis}>
            {(p) =>
              c.options ? (
                <Select
                  {...p}
                  value={valeurs[c.nom]}
                  onChange={(e) => setValeurs({ ...valeurs, [c.nom]: e.target.value })}
                  options={c.options}
                  vide="Choisir…"
                />
              ) : (
                <Input
                  {...p}
                  type={c.type ?? 'text'}
                  min={c.type === 'number' ? 1 : undefined}
                  step={c.type === 'number' ? 1 : undefined}
                  value={valeurs[c.nom]}
                  onChange={(e) => setValeurs({ ...valeurs, [c.nom]: e.target.value })}
                />
              )
            }
          </Field>
        ))}
        {mutation.error && (
          <p role="alert" className="text-sm text-red-700">
            {mutation.error.message}
          </p>
        )}
        <div className="flex justify-end gap-2">
          <Button variante="secondaire" onClick={fermer} disabled={mutation.isPending}>
            Annuler
          </Button>
          <Button type="submit" chargement={mutation.isPending}>
            Valider
          </Button>
        </div>
      </form>
    </Modal>
  )
}
