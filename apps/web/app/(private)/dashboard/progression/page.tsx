'use client'

import { useState } from 'react'
import Link from 'next/link'
import { toast } from 'sonner'
import { LABELS_BRANCHES, ROLES_GROUPE } from '@scout/shared'
import { useSession } from '@/lib/session-client'
import { ErreurApi } from '@/lib/api'
import { accentBranche } from '@/lib/branches-visuel'
import { Award, Pencil, Plus, Trash2 } from '@/lib/icons'
import { useCreerEtape, useModifierEtape, useReferentiel, useSupprimerEtape, useSyntheseProgression, type EtapeReferentiel } from '@/hooks/useProgressions'
import { useMaBranche } from '@/hooks/useBranches'
import { Button, EmptyState, ErrorState, Field, Input, Modal, PageHeader, Skeleton, Textarea, confirmer } from '@/components/ui'

interface Brouillon {
  id?: string
  nom: string
  description: string
  ordre: number
}

function FormulaireEtape({ brancheType, brouillon, onFermer }: { brancheType: string; brouillon: Brouillon; onFermer: () => void }) {
  const [v, setV] = useState(brouillon)
  const [erreur, setErreur] = useState<string | null>(null)
  const creer = useCreerEtape()
  const modifier = useModifierEtape()

  async function enregistrer(e: React.FormEvent) {
    e.preventDefault()
    if (!v.nom.trim()) return setErreur('Indiquez le nom de l’étape.')
    if (!Number.isInteger(v.ordre) || v.ordre < 0 || v.ordre > 1000) return setErreur('L’ordre doit être un entier entre 0 et 1000.')
    setErreur(null)
    const donnees = { nom: v.nom.trim(), description: v.description.trim() || null, ordre: v.ordre }
    try {
      if (v.id) await modifier.mutateAsync({ id: v.id, ...donnees })
      else await creer.mutateAsync({ brancheType, ...donnees })
      toast.success(v.id ? 'Étape modifiée.' : 'Étape ajoutée au référentiel.')
      onFermer()
    } catch (err) {
      setErreur(err instanceof ErreurApi ? err.message : 'Enregistrement impossible.')
    }
  }

  return (
    <Modal
      ouvert
      onFermer={onFermer}
      titre={v.id ? 'Modifier l’étape' : `Nouvelle étape — ${LABELS_BRANCHES[brancheType]}`}
      description="Reprenez l’intitulé exact des documents pédagogiques officiels de la branche."
      pied={
        <>
          <Button variante="secondaire" onClick={onFermer}>
            Annuler
          </Button>
          <Button type="submit" form="formulaire-etape" chargement={creer.isPending || modifier.isPending}>
            Enregistrer
          </Button>
        </>
      }
    >
      <form id="formulaire-etape" onSubmit={enregistrer} className="space-y-4" noValidate>
        {erreur && (
          <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-800">
            {erreur}
          </p>
        )}
        <Field label="Intitulé" requis>
          {(p) => <Input {...p} maxLength={120} value={v.nom} onChange={(e) => setV({ ...v, nom: e.target.value })} />}
        </Field>
        <Field label="Description (facultatif)" aide="Objectifs, critères de validation, signes distinctifs.">
          {(p) => <Textarea {...p} rows={4} maxLength={2000} value={v.description} onChange={(e) => setV({ ...v, description: e.target.value })} />}
        </Field>
        <Field label="Position dans le parcours" aide="Les étapes sont présentées dans l’ordre croissant.">
          {(p) => <Input {...p} type="number" min={0} max={1000} className="w-32" value={Number.isNaN(v.ordre) ? '' : v.ordre} onChange={(e) => setV({ ...v, ordre: e.target.valueAsNumber })} />}
        </Field>
      </form>
    </Modal>
  )
}

export default function PageProgression() {
  const { data: session } = useSession()
  const role = session?.user?.role ?? ''
  const referentiel = useReferentiel()
  const synthese = useSyntheseProgression()
  const maBranche = useMaBranche(['RESPONSABLE_BRANCHE', 'ADJOINT_BRANCHE'].includes(role))
  const supprimer = useSupprimerEtape()
  const branches = synthese.data?.map((s) => s.brancheType) ?? []
  const [choisie, setChoisie] = useState<string | null>(null)
  const branche = choisie && branches.includes(choisie) ? choisie : (branches[0] ?? null)
  const [brouillon, setBrouillon] = useState<Brouillon | null>(null)

  // Miroir de l'API (verifierEcriture) : direction du groupe, ou responsable/adjoint de la branche.
  const peutEcrire = (bt: string) => ROLES_GROUPE.includes(role) || maBranche.data?.brancheType === bt
  const etapes = (referentiel.data ?? []).filter((e) => e.brancheType === branche).sort((a, b) => a.ordre - b.ordre)
  const resume = synthese.data?.find((s) => s.brancheType === branche)

  async function retirer(e: EtapeReferentiel) {
    if (!(await confirmer({ titre: `Supprimer « ${e.nom} » ?`, description: 'L’étape sera retirée du parcours de la branche.', labelConfirmer: 'Supprimer', danger: true }))) return
    try {
      await supprimer.mutateAsync(e.id)
      toast.success('Étape supprimée.')
    } catch (err) {
      toast.error(err instanceof ErreurApi ? err.message : 'Suppression impossible.')
    }
  }

  const erreur = referentiel.error ?? synthese.error

  return (
    <div>
      <PageHeader
        miettes={[{ libelle: 'Tableau de bord', href: '/dashboard' }, { libelle: 'Progression pédagogique' }]}
        titre="Progression pédagogique"
        description="Le parcours de chaque branche, étape par étape. Les validations se font depuis la fiche de chaque scout."
      />

      {referentiel.isPending || synthese.isPending ? (
        <Skeleton className="h-72 rounded-lg" />
      ) : erreur ? (
        <ErrorState
          message={erreur.message}
          onReessayer={() => {
            void referentiel.refetch()
            void synthese.refetch()
          }}
          className="rounded-lg border border-ligne bg-white"
        />
      ) : branches.length === 0 ? (
        <EmptyState icon={Award} title="Aucune branche n’est associée à votre compte." className="rounded-lg border border-ligne bg-white" />
      ) : (
        <div className="grid gap-6 lg:grid-cols-12">
          {/* Synthèse par branche : sert aussi de sélecteur. */}
          <nav aria-label="Branches" className="lg:col-span-4">
            <ul className="overflow-hidden rounded-lg border border-ligne bg-white">
              {synthese.data!.map((s) => {
                const actif = s.brancheType === branche
                return (
                  <li key={s.brancheType} className="border-b border-ligne last:border-0">
                    <button
                      type="button"
                      aria-current={actif ? 'true' : undefined}
                      onClick={() => setChoisie(s.brancheType)}
                      className={`flex w-full items-center gap-3 px-4 py-3 text-left transition ${actif ? 'bg-papier' : 'hover:bg-papier/60'}`}
                    >
                      <span className="h-8 w-1 shrink-0 rounded-full" style={{ backgroundColor: accentBranche(s.brancheType) }} aria-hidden />
                      <span className="min-w-0 flex-1">
                        <span className={`block font-medium ${actif ? 'text-encre' : 'text-encre-douce'}`}>{LABELS_BRANCHES[s.brancheType]}</span>
                        <span className="text-sm text-encre-pale">
                          {s.etapes} étape{s.etapes > 1 ? 's' : ''} · {s.scouts} scout{s.scouts > 1 ? 's' : ''}
                        </span>
                      </span>
                      <span className="text-right">
                        <span className="chiffre-signal block text-lg leading-none text-encre">{s.validations90j}</span>
                        <span className="text-xs text-encre-pale">validées (90 j)</span>
                      </span>
                    </button>
                  </li>
                )
              })}
            </ul>
          </nav>

          {branche && (
            <section aria-labelledby="titre-parcours" className="rounded-lg border border-ligne bg-white lg:col-span-8">
              <header className="flex flex-wrap items-center justify-between gap-3 border-b border-ligne px-5 py-4">
                <div>
                  <h2 id="titre-parcours" className="font-semibold text-encre">
                    Parcours {LABELS_BRANCHES[branche]}
                  </h2>
                  {resume && (
                    <p className="text-sm text-encre-pale">
                      {resume.validations} validation{resume.validations > 1 ? 's' : ''} enregistrée{resume.validations > 1 ? 's' : ''} pour les scouts actifs
                    </p>
                  )}
                </div>
                <div className="flex flex-wrap gap-2">
                  <Link href={`/dashboard/scouts?branche=${branche}`} className="inline-flex h-8 items-center rounded-lg border border-stone-300 px-3 text-xs font-medium text-stone-700 hover:bg-stone-50">
                    Scouts de la branche
                  </Link>
                  {peutEcrire(branche) && (
                    <Button taille="sm" icone={Plus} onClick={() => setBrouillon({ nom: '', description: '', ordre: (etapes.at(-1)?.ordre ?? 0) + 1 })}>
                      Ajouter une étape
                    </Button>
                  )}
                </div>
              </header>
              {etapes.length === 0 ? (
                <EmptyState
                  icon={Award}
                  title="Le parcours de cette branche n’est pas encore saisi."
                  description="Ajoutez les étapes à partir des documents pédagogiques officiels : aucun référentiel n’est imposé par défaut."
                />
              ) : (
                <ol className="px-5 py-2">
                  {etapes.map((e, i) => (
                    <li key={e.id} className="relative flex gap-4 py-3">
                      {i < etapes.length - 1 && <span className="absolute top-12 bottom-0 left-[1.05rem] w-px bg-ligne" aria-hidden />}
                      <span
                        className="chiffre-signal relative flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-base text-white"
                        style={{ backgroundColor: accentBranche(branche) }}
                        aria-hidden
                      >
                        {i + 1}
                      </span>
                      <div className="min-w-0 flex-1 pt-1">
                        <p className="font-medium text-encre">{e.nom}</p>
                        {e.description && <p className="mt-0.5 text-sm whitespace-pre-line text-encre-douce">{e.description}</p>}
                        <p className="mt-1 text-xs text-encre-pale">
                          {e._count?.progressions ?? 0} validation{(e._count?.progressions ?? 0) > 1 ? 's' : ''}
                        </p>
                      </div>
                      {peutEcrire(branche) && (
                        <div className="flex shrink-0 items-start gap-1">
                          <Button variante="fantome" taille="sm" icone={Pencil} onClick={() => setBrouillon({ id: e.id, nom: e.nom, description: e.description ?? '', ordre: e.ordre })}>
                            <span className="sr-only">Modifier {e.nom}</span>
                          </Button>
                          {(e._count?.progressions ?? 0) === 0 && (
                            <Button variante="fantome" taille="sm" icone={Trash2} onClick={() => void retirer(e)}>
                              <span className="sr-only">Supprimer {e.nom}</span>
                            </Button>
                          )}
                        </div>
                      )}
                    </li>
                  ))}
                </ol>
              )}
            </section>
          )}
        </div>
      )}

      {brouillon && branche && <FormulaireEtape brancheType={branche} brouillon={brouillon} onFermer={() => setBrouillon(null)} />}
    </div>
  )
}
