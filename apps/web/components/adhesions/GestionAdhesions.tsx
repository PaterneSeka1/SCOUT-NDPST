'use client'
import { useState } from 'react'
import { toast } from 'sonner'
import {
  anneeScolaireCourante,
  formatMontantFCFA as argent,
  LABELS_BRANCHES,
  type PermissionAdhesion,
} from '@scout/shared'
import { PageHeader } from '@/components/ui/PageHeader'
import { Button } from '@/components/ui/Button'
import { Field, Input, Select, Checkbox } from '@/components/ui/Field'
import { DataTable } from '@/components/ui/DataTable'
import { KpiCard } from '@/components/ui/KpiCard'
import { Pagination } from '@/components/ui/Pagination'
import { Modal } from '@/components/ui/Modal'
import { confirmer } from '@/components/ConfirmDialog'
import { NavIcon } from '@/lib/icons'
import { useSession } from '@/lib/session-client'
import { api, requete } from '@/lib/api'
import {
  useAdhesionsQuery,
  useActionAdhesion,
  type ListeAdhesions,
  type AdhesionVue,
  type BaremeAdhesionVue,
  type IndicateursAdhesion,
  type MembreAdhesionVue,
  type LotNationalVue,
  type ListeLotsNationaux,
  RACINE_ADHESIONS,
} from '@/hooks/useAdhesionsNationales'
import { FormulaireAction, type ActionFinanciere } from './FormulaireAction'

const VUES = [
  'Vue générale',
  'Scouts',
  'Chefs',
  'Encaissements',
  'À reverser',
  'Reversements nationaux',
  'Barèmes',
  'Rapports',
] as const
const branches = Object.entries(LABELS_BRANCHES).map(([valeur, libelle]) => ({ valeur, libelle }))
export function nomAdhesion(a: AdhesionVue) {
  const m = a.personne.utilisateur ?? a.personne.scout
  return m ? `${m.prenom} ${m.nom}` : 'Identité à vérifier'
}
const etat = (v: string) => v.replaceAll('_', ' ').toLocaleLowerCase('fr')
const zone = 'rounded-xl border border-stone-200 bg-white p-4 shadow-sm'

export function GestionAdhesions() {
  const { data: session } = useSession()
  const droits = session?.user.habilitationsAdhesion ?? []
  const peut = (permission: PermissionAdhesion, branche?: string | null) =>
    droits.some(
      (d) =>
        d.permission === permission && (d.brancheType === null || (branche !== undefined && d.brancheType === branche)),
    )
  const [vue, setVue] = useState<(typeof VUES)[number]>('Vue générale')
  const [annee, setAnnee] = useState(anneeScolaireCourante)
  const [recherche, setRecherche] = useState('')
  const [branche, setBranche] = useState('')
  const [page, setPage] = useState(1)
  const [tri, setTri] = useState<{ cle: 'createdAt' | 'montantDu'; sens: 'asc' | 'desc' }>({
    cle: 'createdAt',
    sens: 'desc',
  })
  const [selection, setSelection] = useState<AdhesionVue[]>([])
  const [detailId, setDetailId] = useState<string | null>(null)
  const [exclusionsConfirmation, setExclusionsConfirmation] = useState<string[]>([])
  const [lotId, setLotId] = useState<string | null>(null)
  const [creation, setCreation] = useState(false)
  const [action, setAction] = useState<ActionFinanciere | null>(null)
  const [exportEnCours, setExportEnCours] = useState(false)
  const params = {
    annee,
    branche: branche || undefined,
    recherche: recherche || undefined,
    categorie: vue === 'Scouts' ? 'SCOUT' : vue === 'Chefs' ? 'CHEF' : undefined,
    aReverser: vue === 'À reverser' ? true : undefined,
    page,
    limite: 25,
    tri: tri.cle,
    ordre: tri.sens,
  }
  const liste = useAdhesionsQuery<ListeAdhesions>('', params)
  const indicateurs = useAdhesionsQuery<IndicateursAdhesion>('/indicateurs', { annee, branche: branche || undefined })
  const baremes = useAdhesionsQuery<BaremeAdhesionVue[]>('/baremes', { annee })
  const lots = useAdhesionsQuery<ListeLotsNationaux>(
    '/lots-reversement',
    { annee, page, recherche, ordre: tri.sens },
    droits.some((d) => d.brancheType === null),
  )
  const detail = useAdhesionsQuery<AdhesionVue>(`/${detailId}`, {}, !!detailId)
  const lot = useAdhesionsQuery<LotNationalVue>(`/lots-reversement/${lotId}`, {}, !!lotId)
  const mutation = useActionAdhesion()
  const changement = () => {
    setPage(1)
    setSelection([])
  }
  const paiement = (a: AdhesionVue) =>
    setAction({
      titre: `Encaisser — ${nomAdhesion(a)}`,
      description: `Dû : ${argent(a.montantDu)} · Reçu : ${argent(a.montantEncaisse)} · Solde : ${argent(a.solde)}. Le national restera non confirmé.`,
      chemin: `/${a.id}/encaissements`,
      fixes: { idempotence: crypto.randomUUID() },
      champs: [
        { nom: 'montant', label: 'Montant reçu en FCFA', type: 'number', requis: true, defaut: String(a.solde) },
        { nom: 'mode', label: 'Mode (espèces, mobile money, virement ou autre)', requis: true },
        { nom: 'encaisseLe', label: 'Date réelle de réception', type: 'datetime-local', requis: true },
        { nom: 'reference', label: 'Référence du paiement' },
        { nom: 'note', label: 'Observation' },
      ],
    })
  async function exporter() {
    setExportEnCours(true)
    try {
      const texte = await api<string>(
        `${RACINE_ADHESIONS}/export${requete({ ...params, page: undefined, limite: undefined })}`,
      )
      const url = URL.createObjectURL(new Blob(['\uFEFF', texte], { type: 'text/csv;charset=utf-8;' }))
      const lien = document.createElement('a')
      lien.href = url
      lien.download = `adhesions-${annee}.csv`
      lien.click()
      URL.revokeObjectURL(url)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Export impossible')
    } finally {
      setExportEnCours(false)
    }
  }
  async function preparer() {
    if (!selection.length || mutation.isPending) return
    const total = selection.reduce((s, a) => s + a.montantDu, 0)
    if (
      !(await confirmer({
        titre: 'Préparer le lot national',
        description: `${selection.length} membre(s), ${argent(total)} : ${selection.map(nomAdhesion).join(', ')}. Cette préparation ne déclare aucun versement.`,
      }))
    )
      return
    try {
      await mutation.mutateAsync({
        chemin: '/lots-reversement',
        donnees: { annee, adhesionIds: selection.map((a) => a.id) },
      })
      setSelection([])
      setVue('Reversements nationaux')
      toast.success('Lot préparé')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Échec de préparation')
    }
  }
  const synthese = indicateurs.data
  return (
    <div className="space-y-5">
      <PageHeader
        titre="Adhésions nationales"
        description="La collecte paroissiale, le reversement et la confirmation nationale sont suivis séparément."
        actions={
          <>
            {droits.some((d) => d.permission === 'CREER') && (
              <Button onClick={() => setCreation(true)}>Créer une adhésion</Button>
            )}
            <Button variante="secondaire" chargement={exportEnCours} onClick={exporter}>
              Exporter CSV
            </Button>
          </>
        }
      />
      <div className="flex flex-wrap gap-3">
        <Field label="Année scoute">
          {(p) => (
            <Input
              {...p}
              value={annee}
              pattern="[0-9]{4}-[0-9]{4}"
              onChange={(e) => {
                setAnnee(e.target.value)
                changement()
              }}
            />
          )}
        </Field>
        <Field label="Rechercher un membre">
          {(p) => (
            <Input
              {...p}
              value={recherche}
              onChange={(e) => {
                setRecherche(e.target.value)
                changement()
              }}
              placeholder="Nom, prénom, matricule…"
            />
          )}
        </Field>
        <Field label="Branche">
          {(p) => (
            <Select
              {...p}
              value={branche}
              onChange={(e) => {
                setBranche(e.target.value)
                changement()
              }}
              options={branches}
              vide="Toutes les branches autorisées"
            />
          )}
        </Field>
      </div>
      <nav aria-label="Vues des adhésions" className="flex flex-wrap gap-2">
        {VUES.map((v) => (
          <Button
            key={v}
            variante={vue === v ? 'primaire' : 'secondaire'}
            onClick={() => {
              setVue(v)
              changement()
            }}
            aria-pressed={vue === v}
          >
            {v}
          </Button>
        ))}
      </nav>
      {indicateurs.error && (
        <p role="alert" className="text-red-700">
          {indicateurs.error.message}
        </p>
      )}
      {synthese && (vue === 'Vue générale' || vue === 'Rapports') && (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {[
            ['Attendu', argent(synthese.attendu)],
            ['Encaissé localement', argent(synthese.encaisse)],
            ['Reste à collecter', argent(synthese.restant)],
            ['Fonds locaux non reversés', argent(synthese.aReverser)],
            ['Reversements déclarés', argent(synthese.reverse)],
            ['Montant national confirmé', argent(synthese.confirme)],
            ['Membres à jour localement', synthese.aJourLocalement],
            ['Cotisants nationaux confirmés', synthese.cotisantsConfirmes],
            ['Dossiers à vérifier', synthese.aVerifier],
            ['Adhésions annuelles', synthese.membres],
          ].map(([libelle, valeur]) => (
            <KpiCard key={libelle} libelle={String(libelle)} valeur={valeur} />
          ))}
        </div>
      )}
      {vue === 'À reverser' && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-amber-50 p-3">
          <p>
            {selection.length} sélectionnée(s) · {argent(selection.reduce((s, a) => s + a.montantDu, 0))}
          </p>
          {peut('REVERSER') && (
            <Button disabled={!selection.length} chargement={mutation.isPending} onClick={preparer}>
              Préparer un lot
            </Button>
          )}
        </div>
      )}
      {!['Barèmes', 'Reversements nationaux'].includes(vue) && (
        <div className={zone}>
          <DataTable<AdhesionVue>
            legende={
              vue === 'Encaissements' ? 'Adhésions et historique des encaissements' : 'Suivi des adhésions annuelles'
            }
            lignes={liste.data?.adhesions}
            chargement={liste.isFetching}
            erreur={liste.error?.message}
            onReessayer={() => liste.refetch()}
            cleLigne={(a) => a.id}
            tri={tri}
            onTri={(t) => {
              setTri({ cle: t.cle as 'createdAt' | 'montantDu', sens: t.sens })
              setPage(1)
            }}
            vide={{
              icone: NavIcon.cotisations,
              titre: 'Aucune adhésion',
              description: 'Modifiez les filtres ou créez les adhésions annuelles.',
            }}
            colonnes={[
              ...(vue === 'À reverser'
                ? [
                    {
                      cle: 'selection',
                      titre: 'Sélection',
                      rendu: (a: AdhesionVue) => (
                        <Checkbox
                          label={`Sélectionner ${nomAdhesion(a)}`}
                          checked={selection.some((s) => s.id === a.id)}
                          onChange={(e) =>
                            setSelection(e.target.checked ? [...selection, a] : selection.filter((s) => s.id !== a.id))
                          }
                        />
                      ),
                    },
                  ]
                : []),
              {
                cle: 'membre',
                titre: 'Membre',
                principale: true,
                rendu: (a) => (
                  <>
                    <strong>{nomAdhesion(a)}</strong>
                    <p className="text-xs">
                      {a.categorie === 'CHEF' ? 'Chef' : 'Scout'} ·{' '}
                      {a.brancheType ? LABELS_BRANCHES[a.brancheType] : 'Groupe'} ·{' '}
                      {a.personne.scout?.matricule ?? a.personne.utilisateur?.matricule ?? 'Sans matricule'}
                    </p>
                  </>
                ),
              },
              {
                cle: 'du',
                titre: 'Dû',
                tri: 'montantDu',
                rendu: (a) => (
                  <>
                    {argent(a.montantDu)}
                    <p className="text-xs">{a.bareme?.libelle ?? 'Reprise historique'}</p>
                  </>
                ),
              },
              {
                cle: 'local',
                titre: 'Collecte locale',
                rendu: (a) => (
                  <>
                    {argent(a.montantEncaisse)}
                    <p className="text-xs">
                      {etat(a.situationLocale)} · reste {argent(a.solde)}
                    </p>
                  </>
                ),
              },
              { cle: 'reversement', titre: 'Reversement', rendu: (a) => etat(a.situationReversement) },
              {
                cle: 'national',
                titre: 'National',
                rendu: (a) => (
                  <span
                    className={
                      a.statutNational === 'COTISANT_CONFIRME' ? 'font-semibold text-green-800' : 'text-amber-900'
                    }
                  >
                    {etat(a.statutNational)}
                  </span>
                ),
              },
              ...(vue === 'Encaissements'
                ? [
                    {
                      cle: 'historique',
                      titre: 'Écritures',
                      rendu: (a: AdhesionVue) => (
                        <ul>
                          {a.encaissements.map((e) => (
                            <li key={e.id}>
                              {e.encaisseLe
                                ? new Date(e.encaisseLe).toLocaleDateString('fr-FR')
                                : 'Date historique inconnue'}{' '}
                              · {argent(e.montant)} · {e.mode}
                              {e.annulation ? ' (annulé)' : ''}
                            </li>
                          ))}
                        </ul>
                      ),
                    },
                  ]
                : []),
            ]}
            actions={(a) => (
              <>
                <Button taille="sm" variante="secondaire" onClick={() => setDetailId(a.id)}>
                  Dossier
                </Button>
                {a.solde > 0 && peut('ENCAISSER', a.brancheType) && (
                  <Button taille="sm" onClick={() => paiement(a)}>
                    Encaisser
                  </Button>
                )}
              </>
            )}
          />
          {liste.data && <Pagination {...liste.data.pagination} onPageChange={setPage} itemLabel="adhésion" />}
        </div>
      )}
      {vue === 'Barèmes' && (
        <div className={zone}>
          <p className="mb-3 text-sm text-stone-600">
            Un nouveau tarif s’applique aux nouvelles adhésions. Les montants déjà dus restent inchangés.
          </p>
          {peut('BAREMES') && (
            <Button
              onClick={() =>
                setAction({
                  titre: 'Nouveau barème',
                  description: 'Tarif annuel en FCFA. Désactivez le précédent si nécessaire.',
                  chemin: '/baremes',
                  fixes: { annee },
                  champs: [
                    {
                      nom: 'categorie',
                      label: 'Catégorie',
                      requis: true,
                      options: [
                        { valeur: 'SCOUT', libelle: 'Scout' },
                        { valeur: 'CHEF', libelle: 'Chef' },
                      ],
                    },
                    { nom: 'brancheType', label: 'Branche (vide : tout le groupe)', options: branches },
                    { nom: 'montant', label: 'Montant FCFA', type: 'number', requis: true },
                    { nom: 'libelle', label: 'Libellé', requis: true },
                    { nom: 'debutValidite', label: 'Début de validité', type: 'datetime-local', requis: true },
                    { nom: 'finValidite', label: 'Fin de validité', type: 'datetime-local' },
                  ],
                })
              }
            >
              Ajouter un barème
            </Button>
          )}
          {baremes.error && <p role="alert">{baremes.error.message}</p>}
          <ul className="mt-4 divide-y">
            {baremes.data?.map((b) => (
              <li key={b.id} className="flex flex-wrap items-center justify-between gap-2 py-3">
                <p>
                  {b.libelle} · {b.categorie} · {b.brancheType ? LABELS_BRANCHES[b.brancheType] : 'Toutes branches'} ·{' '}
                  {argent(b.montant)} · {b.actif ? 'actif' : 'inactif'}
                </p>
                {b.actif && peut('BAREMES', b.brancheType) && (
                  <Button
                    taille="sm"
                    variante="secondaire"
                    onClick={() =>
                      setAction({
                        titre: 'Désactiver le barème',
                        description: 'Les adhésions existantes conservent ce tarif.',
                        chemin: `/baremes/${b.id}/desactiver`,
                        champs: [],
                      })
                    }
                  >
                    Désactiver
                  </Button>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
      {vue === 'Reversements nationaux' && (
        <div className={zone}>
          {lots.error && <p role="alert">{lots.error.message}</p>}
          {!droits.some((d) => d.brancheType === null) && (
            <p>La consultation des lots exige une habilitation sur le groupe.</p>
          )}
          <DataTable<LotNationalVue>
            tri={{ cle: 'createdAt', sens: tri.sens }}
            onTri={(t) => {
              setTri({ cle: 'createdAt', sens: t.sens })
              setPage(1)
            }}
            legende="Lots de reversement national"
            lignes={lots.data?.lots}
            chargement={lots.isFetching}
            cleLigne={(l) => l.id}
            vide={{ icone: NavIcon.cotisations, titre: 'Aucun lot national' }}
            colonnes={[
              { cle: 'id', titre: 'Lot', principale: true, rendu: (l) => l.id },
              { cle: 'statut', titre: 'Situation', rendu: (l) => etat(l.statut) },
              { cle: 'montant', titre: 'Total', rendu: (l) => argent(l.montantTotal) },
              {
                cle: 'date',
                titre: 'Création',
                tri: 'createdAt',
                rendu: (l) => new Date(l.createdAt).toLocaleDateString('fr-FR'),
              },
              { cle: 'ref', titre: 'Référence', rendu: (l) => l.reference ?? 'Non déclaré' },
            ]}
            actions={(l) => (
              <Button
                taille="sm"
                onClick={() => {
                  setLotId(l.id)
                  setExclusionsConfirmation([])
                }}
              >
                Consulter
              </Button>
            )}
          />
          {lots.data && <Pagination {...lots.data.pagination} onPageChange={setPage} itemLabel="lot" />}
        </div>
      )}
      {creation && <CreationAdhesion annee={annee} fermer={() => setCreation(false)} baremes={baremes.data ?? []} />}
      {detailId && (
        <Modal ouvert onFermer={() => setDetailId(null)} titre="Dossier d’adhésion" taille="lg">
          {detail.error && <p role="alert">{detail.error.message}</p>}
          {detail.data ? (
            <div className="space-y-4">
              <h3 className="font-semibold">
                {nomAdhesion(detail.data)} · {detail.data.annee}
              </h3>
              <p>
                {etat(detail.data.statutNational)} · Dû {argent(detail.data.montantDu)} · Encaissé{' '}
                {argent(detail.data.montantEncaisse)} · Solde {argent(detail.data.solde)}
              </p>
              {detail.data.aVerifier && (
                <p role="alert" className="text-amber-800">
                  À vérifier : {detail.data.motifVerification}
                </p>
              )}
              {peut('CORRIGER', detail.data.brancheType) && (
                <Button
                  variante="secondaire"
                  onClick={() => {
                    setDetailId(null)
                    setAction({
                      titre: 'Examiner le dossier',
                      description: `${nomAdhesion(detail.data!)}. La validation locale ne confirme jamais le national.`,
                      chemin: `/${detailId}/examen`,
                      champs: [
                        {
                          nom: 'decision',
                          label: 'Décision locale',
                          requis: true,
                          options: [
                            { valeur: 'RAPPROCHER_LOCAL', libelle: 'Valider le rapprochement des montants locaux' },
                            { valeur: 'EXONERER', libelle: 'Accorder une exonération locale' },
                            { valeur: 'ANNULER_EXONERATION', libelle: 'Retirer une exonération locale' },
                          ],
                        },
                        { nom: 'motif', label: 'Justification du contrôle', requis: true },
                      ],
                    })
                  }}
                >
                  Examiner / exonérer
                </Button>
              )}
              <h4 className="font-semibold">Historique des encaissements</h4>
              {detail.data.encaissements.length === 0 && <p>Aucun encaissement enregistré.</p>}
              <ul className="space-y-3">
                {detail.data.encaissements.map((e) => (
                  <li key={e.id} className="rounded border p-3">
                    <p>
                      {argent(e.montant)} · {e.mode} · reçu le{' '}
                      {e.encaisseLe ? new Date(e.encaisseLe).toLocaleString('fr-FR') : 'date inconnue'} · référence{' '}
                      {e.reference ?? 'absente'}
                    </p>
                    <p className="text-xs">Saisi par {e.acteurId}</p>
                    {e.annulation ? (
                      <p>Annulé : {e.annulation.motif}</p>
                    ) : (
                      peut('CORRIGER', detail.data!.brancheType) && (
                        <Button
                          taille="sm"
                          variante="danger"
                          onClick={() => {
                            setDetailId(null)
                            setAction({
                              titre: 'Annuler cet encaissement',
                              description: `${argent(e.montant)}. L’écriture sera conservée et le solde recalculé.`,
                              chemin: `/${detailId}/encaissements/${e.id}/annuler`,
                              champs: [{ nom: 'motif', label: 'Justification', requis: true }],
                            })
                          }}
                        >
                          Annuler l’écriture
                        </Button>
                      )
                    )}
                  </li>
                ))}
              </ul>
              <h4 className="font-semibold">Confirmations nationales</h4>
              <ul>
                {detail.data.confirmations.map((c) => (
                  <li key={c.id}>
                    {new Date(c.createdAt).toLocaleString('fr-FR')} · {c.reference ?? 'Sans référence'} · par{' '}
                    {c.acteurId}
                    {c.correction ? ` · invalidée : ${c.correction.motif}` : ''}
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <p role="status">Chargement…</p>
          )}
        </Modal>
      )}
      {lotId && (
        <Modal ouvert onFermer={() => setLotId(null)} titre="Reversement national" taille="lg">
          {lot.error && <p role="alert">{lot.error.message}</p>}
          {lot.data ? (
            <div className="space-y-4">
              <p>
                {lot.data.id} · {etat(lot.data.statut)} · {argent(lot.data.montantTotal)}
              </p>
              <p>
                {lot.data.reference} {lot.data.justification}
              </p>
              <ul className="space-y-2">
                {lot.data.lignes?.map((l) => (
                  <li key={l.id}>
                    {nomAdhesion(l.adhesion)} · {argent(l.montant)} ·{' '}
                    {l.adhesion.confirmations.some((c) => !c.correction) ? 'confirmé' : 'non confirmé'}
                    {['DECLARE', 'PARTIELLEMENT_CONFIRME'].includes(lot.data!.statut) &&
                      !l.adhesion.confirmations.some((c) => !c.correction) &&
                      peut('CONFIRMER') && (
                        <Checkbox
                          label={`Confirmer ${nomAdhesion(l.adhesion)}`}
                          checked={!exclusionsConfirmation.includes(l.adhesionId)}
                          onChange={(e) =>
                            setExclusionsConfirmation(
                              e.target.checked
                                ? exclusionsConfirmation.filter((id) => id !== l.adhesionId)
                                : [...exclusionsConfirmation, l.adhesionId],
                            )
                          }
                        />
                      )}
                  </li>
                ))}
              </ul>
              <div className="flex flex-wrap gap-2">
                {lot.data.statut === 'PREPARE' && peut('REVERSER') && (
                  <Button
                    onClick={() => {
                      setLotId(null)
                      setAction({
                        titre: 'Déclarer le versement effectué',
                        description: `Lot ${lot.data!.id}, ${argent(lot.data!.montantTotal)}. Déclarer seulement après le paiement effectif sur la plateforme nationale.`,
                        chemin: `/lots-reversement/${lotId}/declarer`,
                        champs: [
                          {
                            nom: 'verseLe',
                            label: 'Date effective du versement',
                            type: 'datetime-local',
                            requis: true,
                          },
                          { nom: 'reference', label: 'Référence du versement', requis: true },
                          { nom: 'justification', label: 'Justification ou observation' },
                        ],
                      })
                    }}
                  >
                    Déclarer reversé
                  </Button>
                )}
                {['DECLARE', 'PARTIELLEMENT_CONFIRME'].includes(lot.data.statut) && peut('CONFIRMER') && (
                  <Button
                    disabled={
                      !lot.data.lignes?.some(
                        (l) =>
                          !l.adhesion.confirmations.some((c) => !c.correction) &&
                          !exclusionsConfirmation.includes(l.adhesionId),
                      )
                    }
                    onClick={() => {
                      const lignes =
                        lot.data!.lignes?.filter(
                          (l) =>
                            !l.adhesion.confirmations.some((c) => !c.correction) &&
                            !exclusionsConfirmation.includes(l.adhesionId),
                        ) ?? []
                      setLotId(null)
                      setAction({
                        titre: 'Confirmer le national',
                        description: `${lignes.length} adhésion(s), ${argent(lignes.reduce((s, l) => s + l.montant, 0))} : ${lignes.map((l) => nomAdhesion(l.adhesion)).join(', ')}. Cette validation explicite attribuera le statut cotisant national.`,
                        chemin: `/lots-reversement/${lotId}/confirmer`,
                        fixes: { adhesionIds: lignes.map((l) => l.adhesionId) },
                        champs: [
                          { nom: 'reference', label: 'Référence nationale' },
                          { nom: 'commentaire', label: 'Commentaire' },
                        ],
                      })
                    }}
                  >
                    Confirmer la sélection
                  </Button>
                )}
                {!['ANNULE', 'ANOMALIE'].includes(lot.data.statut) && peut('CORRIGER') && (
                  <Button
                    variante="danger"
                    onClick={() => {
                      setLotId(null)
                      setAction({
                        titre:
                          lot.data!.statut === 'PREPARE'
                            ? 'Annuler le lot préparé'
                            : 'Signaler une anomalie du versement',
                        description:
                          'Les confirmations seront invalidées avec conservation de leur historique. Un lot déclaré restera bloqué pour rapprochement.',
                        chemin: `/lots-reversement/${lotId}/anomalie`,
                        champs: [{ nom: 'motif', label: 'Justification', requis: true }],
                      })
                    }}
                  >
                    Annulation / anomalie
                  </Button>
                )}
              </div>
            </div>
          ) : (
            <p role="status">Chargement…</p>
          )}
        </Modal>
      )}
      {action && <FormulaireAction key={action.chemin} action={action} fermer={() => setAction(null)} />}
    </div>
  )
}

function CreationAdhesion({
  annee,
  baremes,
  fermer,
}: {
  annee: string
  baremes: BaremeAdhesionVue[]
  fermer: () => void
}) {
  const [categorie, setCategorie] = useState<'SCOUT' | 'CHEF'>('SCOUT')
  const [recherche, setRecherche] = useState('')
  const [membreId, setMembreId] = useState('')
  const [baremeId, setBaremeId] = useState('')
  const membres = useAdhesionsQuery<MembreAdhesionVue[]>('/membres', { categorie, recherche })
  const mutation = useActionAdhesion()
  return (
    <Modal
      ouvert
      onFermer={fermer}
      titre="Créer une adhésion annuelle"
      description="Une seule adhésion nationale par personne et par année, même en cas de cumul de fonctions."
    >
      <form
        className="space-y-4"
        onSubmit={async (e) => {
          e.preventDefault()
          if (mutation.isPending) return
          try {
            await mutation.mutateAsync({
              chemin: '',
              donnees: { annee, baremeId, [categorie === 'CHEF' ? 'utilisateurId' : 'scoutId']: membreId },
            })
            toast.success('Adhésion créée')
            fermer()
          } catch (err) {
            toast.error(err instanceof Error ? err.message : 'Création impossible')
          }
        }}
      >
        <Field label="Catégorie">
          {(p) => (
            <Select
              {...p}
              value={categorie}
              onChange={(e) => {
                setCategorie(e.target.value as 'SCOUT' | 'CHEF')
                setMembreId('')
                setBaremeId('')
              }}
              options={[
                { valeur: 'SCOUT', libelle: 'Scout' },
                { valeur: 'CHEF', libelle: 'Chef / maîtrise' },
              ]}
            />
          )}
        </Field>
        <Field label="Rechercher">
          {(p) => (
            <Input
              {...p}
              value={recherche}
              onChange={(e) => {
                setRecherche(e.target.value)
                setMembreId('')
              }}
              placeholder="Nom ou matricule (50 premiers résultats)"
            />
          )}
        </Field>
        <Field label="Membre" requis>
          {(p) => (
            <Select
              {...p}
              value={membreId}
              onChange={(e) => setMembreId(e.target.value)}
              vide="Sélectionner un membre"
              options={membres.data?.map((m) => ({
                valeur: m.id,
                libelle: `${m.prenom} ${m.nom} · ${m.matricule ?? 'sans matricule'}`,
              }))}
            />
          )}
        </Field>
        {membres.error && <p role="alert">{membres.error.message}</p>}
        <Field label="Barème annuel" requis>
          {(p) => (
            <Select
              {...p}
              value={baremeId}
              onChange={(e) => setBaremeId(e.target.value)}
              vide="Sélectionner le tarif"
              options={baremes
                .filter((b) => b.actif && b.categorie === categorie)
                .map((b) => ({
                  valeur: b.id,
                  libelle: `${b.libelle} · ${argent(b.montant)} · ${b.brancheType ? LABELS_BRANCHES[b.brancheType] : 'Groupe'}`,
                }))}
            />
          )}
        </Field>
        <Button type="submit" chargement={mutation.isPending} disabled={!membreId || !baremeId}>
          Créer pour {annee}
        </Button>
      </form>
    </Modal>
  )
}
