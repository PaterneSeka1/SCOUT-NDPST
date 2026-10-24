'use client'

import { useState } from 'react'
import Link from 'next/link'
import { toast } from 'sonner'
import { LABELS_BRANCHES, ORDRE_BRANCHES, ROLES_BRANCHE, ROLES_GESTION, ROLES_GROUPE } from '@scout/shared'
import {
  Alert,
  Button,
  ButtonLink,
  Card,
  CardBody,
  CardHeader,
  DataTable,
  ErrorState,
  Field,
  FilterBar,
  Input,
  Modal,
  PageHeader,
  Pagination,
  SearchInput,
  Select,
  Skeleton,
  StatusBadge,
  Tabs,
  Textarea,
  confirmer,
  type Colonne,
} from '@/components/ui'
import { useSession } from '@/lib/session-client'
import { dateHeure, valeurChampDateHeure } from '@/lib/format'
import { CheckSquare, Clock, Pencil, Plus, Trash2 } from '@/lib/icons'
import { useMaBranche } from '@/hooks/useActivites'
import {
  JOURS_SEMAINE,
  LABELS_STATUT_REUNION,
  TONS_STATUT_REUNION,
  dateEffectiveReunion,
  useConfigsReunion,
  useEnregistrerConfigReunion,
  useModifierReunion,
  useReunions,
  useSupprimerReunion,
  type ConfigReunion,
  type Reunion,
  type StatutReunion,
} from '@/hooks/useReunions'

const LIMITE = 20

function titreReunion(r: Reunion) {
  return r.titre || `Réunion ${r.brancheType ? (LABELS_BRANCHES[r.brancheType] ?? r.brancheType) : 'inter-branches'}`
}

export default function PageReunions() {
  const { data: session } = useSession()
  const role = session?.user?.role ?? ''
  const estGroupe = ROLES_GROUPE.includes(role)
  const estBranche = ROLES_BRANCHE.includes(role)
  const peutCreer = ROLES_GESTION.includes(role)
  const maBranche = useMaBranche(estBranche)

  const [onglet, setOnglet] = useState<'reunions' | 'config'>('reunions')
  const [page, setPage] = useState(1)
  const [recherche, setRecherche] = useState('')
  const [statut, setStatut] = useState('PLANIFIEE')
  const [branche, setBranche] = useState('')
  const [edition, setEdition] = useState<Reunion | null>(null)

  const { data, isLoading, isFetching, error, refetch } = useReunions({
    page,
    limite: LIMITE,
    recherche,
    statut,
    branche: estBranche ? undefined : branche,
  })
  const supprimer = useSupprimerReunion()

  // Aligné sur PATCH/DELETE /api/reunions/:id : Chef de Groupe, ou encadrement de la branche concernée.
  const peutGerer = (r: Reunion) => estGroupe || (estBranche && !!maBranche.data?.brancheType && r.brancheType === maBranche.data.brancheType)

  async function demanderSuppression(r: Reunion) {
    const ok = await confirmer({
      titre: `Supprimer « ${titreReunion(r)} » ?`,
      description: `La réunion du ${dateHeure(dateEffectiveReunion(r))} et ${r._count.presences} présence(s) enregistrée(s) seront définitivement supprimées. Pour garder l’historique, préférez « Annulée ».`,
      labelConfirmer: 'Supprimer',
      danger: true,
    })
    if (!ok) return
    try {
      await supprimer.mutateAsync(r.id)
      toast.success('Réunion supprimée.')
    } catch (e) {
      toast.error((e as Error).message)
    }
  }

  const colonnes: Colonne<Reunion>[] = [
    {
      cle: 'titre',
      titre: 'Réunion',
      principale: true,
      rendu: (r) => <span className="font-medium text-stone-900">{titreReunion(r)}</span>,
    },
    {
      cle: 'date',
      titre: 'Date',
      rendu: (r) => (
        <span>
          {dateHeure(dateEffectiveReunion(r))}
          {r.statut === 'REPORTEE' && <span className="block text-xs text-stone-500">initialement {dateHeure(r.dateHeure)}</span>}
        </span>
      ),
    },
    {
      cle: 'branche',
      titre: 'Branche',
      masquee: 'md',
      rendu: (r) => (r.brancheType ? (LABELS_BRANCHES[r.brancheType] ?? r.brancheType) : 'Inter-branches'),
    },
    { cle: 'lieu', titre: 'Lieu', masquee: 'lg', rendu: (r) => r.lieu ?? '—' },
    { cle: 'statut', titre: 'Statut', rendu: (r) => <StatusBadge valeur={r.statut} libelles={LABELS_STATUT_REUNION} tons={TONS_STATUT_REUNION} /> },
    { cle: 'presences', titre: 'Présences', masquee: 'md', rendu: (r) => <span className="tabular-nums">{r._count.presences}</span> },
  ]

  return (
    <div className="space-y-6">
      <PageHeader
        titre="Réunions"
        description="Réunions hebdomadaires des branches et feuilles de présence."
        miettes={[{ libelle: 'Tableau de bord', href: '/dashboard' }, { libelle: 'Réunions' }]}
        actions={
          peutCreer && (
            <ButtonLink href="/dashboard/reunions/nouveau" icone={Plus}>
              Planifier
            </ButtonLink>
          )
        }
      />

      <Tabs
        label="Sections des réunions"
        actif={onglet}
        onChange={setOnglet}
        onglets={[
          { valeur: 'reunions', libelle: 'Réunions' },
          { valeur: 'config', libelle: 'Jours habituels' },
        ]}
      />

      {onglet === 'config' ? (
        <ConfigurationReunions modifiable={estGroupe} />
      ) : (
        <>
          <FilterBar>
            <SearchInput
              valeur={recherche}
              onChange={(v) => {
                setRecherche(v)
                setPage(1)
              }}
              placeholder="Titre, lieu ou notes…"
              label="Rechercher une réunion"
            />
            <Select
              aria-label="Filtrer par statut"
              value={statut}
              onChange={(e) => {
                setStatut(e.target.value)
                setPage(1)
              }}
              vide="Tous les statuts"
              options={Object.entries(LABELS_STATUT_REUNION).map(([valeur, libelle]) => ({ valeur, libelle }))}
            />
            {!estBranche && (
              <Select
                aria-label="Filtrer par branche"
                value={branche}
                onChange={(e) => {
                  setBranche(e.target.value)
                  setPage(1)
                }}
                vide="Toutes les branches"
                options={ORDRE_BRANCHES.map((b) => ({ valeur: b, libelle: LABELS_BRANCHES[b] }))}
              />
            )}
          </FilterBar>

          <Card>
            <DataTable
              legende="Liste des réunions, de la plus ancienne à la plus récente"
              colonnes={colonnes}
              lignes={data?.reunions}
              cleLigne={(r) => r.id}
              chargement={isLoading || isFetching}
              erreur={error ? error.message : null}
              onReessayer={() => refetch()}
              actions={(r) => (
                <>
                  {r.statut !== 'ANNULEE' && (
                    <ButtonLink href={`/dashboard/reunions/${r.id}/presences`} variante="secondaire" taille="sm" icone={CheckSquare}>
                      Présences
                    </ButtonLink>
                  )}
                  {peutGerer(r) && (
                    <>
                      <Button variante="fantome" taille="sm" icone={Pencil} onClick={() => setEdition(r)}>
                        <span className="sr-only">Modifier {titreReunion(r)}</span>
                      </Button>
                      <Button variante="fantome" taille="sm" icone={Trash2} className="text-red-700 hover:bg-red-50" onClick={() => demanderSuppression(r)}>
                        <span className="sr-only">Supprimer {titreReunion(r)}</span>
                      </Button>
                    </>
                  )}
                </>
              )}
              vide={{
                icone: Clock,
                titre: 'Aucune réunion trouvée',
                description: statut || recherche || branche ? 'Modifiez ou effacez les filtres.' : 'Planifiez les réunions de la branche.',
                action:
                  peutCreer && !(statut || recherche || branche) ? (
                    <ButtonLink href="/dashboard/reunions/nouveau" taille="sm" icone={Plus}>
                      Planifier
                    </ButtonLink>
                  ) : undefined,
              }}
            />
          </Card>

          {data && (
            <Pagination page={page} totalPages={data.pagination.totalPages} onPageChange={setPage} total={data.pagination.total} itemLabel="réunion" />
          )}
        </>
      )}

      {edition && <ModaleReunion key={edition.id} reunion={edition} estGroupe={estGroupe} onFermer={() => setEdition(null)} />}
    </div>
  )
}

// --- Modification d'une réunion (statut, report, informations) --------------

function ModaleReunion({ reunion, estGroupe, onFermer }: { reunion: Reunion; estGroupe: boolean; onFermer: () => void }) {
  const modifier = useModifierReunion()
  const [titre, setTitre] = useState(reunion.titre ?? '')
  const [date, setDate] = useState(valeurChampDateHeure(reunion.dateHeure))
  const [duree, setDuree] = useState(reunion.dureeMinutes?.toString() ?? '')
  const [lieu, setLieu] = useState(reunion.lieu ?? '')
  const [notes, setNotes] = useState(reunion.notes ?? '')
  const [statut, setStatut] = useState<StatutReunion>(reunion.statut)
  const [dateReportee, setDateReportee] = useState(valeurChampDateHeure(reunion.dateReportee))
  const [brancheType, setBrancheType] = useState(reunion.brancheType ?? '')
  const [erreur, setErreur] = useState<string | null>(null)

  async function enregistrer() {
    if (!date) return setErreur('La date est requise.')
    if (statut === 'REPORTEE' && !dateReportee) return setErreur('Indiquez la nouvelle date pour reporter la réunion.')
    const dureeNombre = duree ? Number.parseInt(duree, 10) : null
    if (dureeNombre !== null && (!Number.isFinite(dureeNombre) || dureeNombre <= 0)) return setErreur('Durée invalide.')
    setErreur(null)

    if (statut === 'ANNULEE' && reunion.statut !== 'ANNULEE') {
      const ok = await confirmer({
        titre: 'Annuler cette réunion ?',
        description: 'La réunion sera marquée annulée et disparaîtra du calendrier. Les présences déjà enregistrées sont conservées.',
        labelConfirmer: 'Annuler la réunion',
        danger: true,
      })
      if (!ok) return
    }

    try {
      await modifier.mutateAsync({
        id: reunion.id,
        donnees: {
          titre: titre.trim() || null,
          dateHeure: new Date(date).toISOString(),
          dureeMinutes: dureeNombre,
          lieu: lieu.trim() || null,
          notes: notes.trim() || null,
          statut,
          dateReportee: statut === 'REPORTEE' ? new Date(dateReportee).toISOString() : null,
          ...(estGroupe ? { brancheType: brancheType || null } : {}),
        },
      })
      toast.success('Réunion enregistrée.')
      onFermer()
    } catch (e) {
      toast.error((e as Error).message)
    }
  }

  return (
    <Modal
      ouvert
      onFermer={onFermer}
      titre="Modifier la réunion"
      description={titreReunion(reunion)}
      taille="lg"
      pied={
        <>
          <Button variante="secondaire" onClick={onFermer}>
            Fermer
          </Button>
          <Button onClick={enregistrer} chargement={modifier.isPending}>
            Enregistrer
          </Button>
        </>
      }
    >
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {erreur && (
          <Alert niveau="critique" className="sm:col-span-2">
            {erreur}
          </Alert>
        )}
        <Field label="Titre" className="sm:col-span-2">
          {(p) => <Input {...p} value={titre} onChange={(e) => setTitre(e.target.value)} />}
        </Field>
        <Field label="Date et heure" requis>
          {(p) => <Input {...p} type="datetime-local" value={date} onChange={(e) => setDate(e.target.value)} />}
        </Field>
        <Field label="Durée (minutes)">
          {(p) => <Input {...p} type="number" min={15} max={720} step={15} value={duree} onChange={(e) => setDuree(e.target.value)} />}
        </Field>
        <Field label="Statut">
          {(p) => (
            <Select
              {...p}
              value={statut}
              onChange={(e) => setStatut(e.target.value as StatutReunion)}
              options={Object.entries(LABELS_STATUT_REUNION).map(([valeur, libelle]) => ({ valeur, libelle }))}
            />
          )}
        </Field>
        {statut === 'REPORTEE' ? (
          <Field label="Nouvelle date" requis>
            {(p) => <Input {...p} type="datetime-local" value={dateReportee} onChange={(e) => setDateReportee(e.target.value)} />}
          </Field>
        ) : (
          <div className="hidden sm:block" />
        )}
        {estGroupe && (
          <Field label="Branche">
            {(p) => (
              <Select
                {...p}
                value={brancheType}
                onChange={(e) => setBrancheType(e.target.value)}
                vide="Inter-branches"
                options={ORDRE_BRANCHES.map((b) => ({ valeur: b, libelle: LABELS_BRANCHES[b] }))}
              />
            )}
          </Field>
        )}
        <Field label="Lieu" className={estGroupe ? '' : 'sm:col-span-2'}>
          {(p) => <Input {...p} value={lieu} onChange={(e) => setLieu(e.target.value)} />}
        </Field>
        <Field label="Notes" className="sm:col-span-2">
          {(p) => <Textarea {...p} rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} />}
        </Field>
      </div>
    </Modal>
  )
}

// --- Jours de réunion habituels par branche ---------------------------------

function ConfigurationReunions({ modifiable }: { modifiable: boolean }) {
  const { data, isLoading, error, refetch } = useConfigsReunion()
  if (isLoading)
    return (
      <div className="space-y-3" role="status" aria-label="Chargement">
        {ORDRE_BRANCHES.map((b) => (
          <Skeleton key={b} className="h-16 w-full" />
        ))}
      </div>
    )
  if (error) return <ErrorState message={error.message} onReessayer={() => refetch()} />

  return (
    <div className="space-y-4">
      <p className="text-sm text-stone-500">
        Jour, heure et lieu habituels de chaque branche : ils pré-remplissent la planification des réunions.
        {!modifiable && ' Seul le Chef de Groupe peut les modifier.'}
      </p>
      <div className="grid gap-4 md:grid-cols-2">
        {ORDRE_BRANCHES.map((b) => (
          <CarteConfig key={b} branche={b} config={data?.find((c) => c.brancheType === b) ?? null} modifiable={modifiable} />
        ))}
      </div>
    </div>
  )
}

function CarteConfig({ branche, config, modifiable }: { branche: string; config: ConfigReunion | null; modifiable: boolean }) {
  const enregistrer = useEnregistrerConfigReunion()
  const [edition, setEdition] = useState(false)
  const [jour, setJour] = useState(String(config?.jourSemaine ?? 6))
  const [heure, setHeure] = useState(config?.heureDebut ?? '09:00')
  const [duree, setDuree] = useState(String(config?.dureeMinutes ?? 90))
  const [lieu, setLieu] = useState(config?.lieu ?? '')

  async function sauvegarder() {
    const dureeNombre = Number.parseInt(duree, 10)
    if (!heure || !Number.isFinite(dureeNombre) || dureeNombre <= 0) {
      toast.error('Heure et durée valides requises.')
      return
    }
    try {
      await enregistrer.mutateAsync({ brancheType: branche, jourSemaine: Number(jour), heureDebut: heure, dureeMinutes: dureeNombre, lieu: lieu.trim() || null })
      toast.success(`Jour habituel des ${LABELS_BRANCHES[branche]} enregistré.`)
      setEdition(false)
    } catch (e) {
      toast.error((e as Error).message)
    }
  }

  return (
    <Card>
      <CardHeader
        titre={LABELS_BRANCHES[branche] ?? branche}
        description={
          config
            ? `${JOURS_SEMAINE[config.jourSemaine]} à ${config.heureDebut} · ${config.dureeMinutes} min${config.lieu ? ` · ${config.lieu}` : ''}`
            : 'Non configuré'
        }
        actions={
          modifiable &&
          !edition && (
            <Button variante="fantome" taille="sm" icone={Pencil} onClick={() => setEdition(true)}>
              Modifier
            </Button>
          )
        }
      />
      {edition && (
        <CardBody className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Jour">
              {(p) => (
                <Select {...p} value={jour} onChange={(e) => setJour(e.target.value)} options={JOURS_SEMAINE.map((j, i) => ({ valeur: String(i), libelle: j }))} />
              )}
            </Field>
            <Field label="Heure">
              {(p) => <Input {...p} type="time" value={heure} onChange={(e) => setHeure(e.target.value)} />}
            </Field>
            <Field label="Durée (minutes)">
              {(p) => <Input {...p} type="number" min={15} max={720} step={15} value={duree} onChange={(e) => setDuree(e.target.value)} />}
            </Field>
            <Field label="Lieu habituel">
              {(p) => <Input {...p} value={lieu} onChange={(e) => setLieu(e.target.value)} />}
            </Field>
          </div>
          <div className="flex justify-end gap-2">
            <Button variante="secondaire" taille="sm" onClick={() => setEdition(false)}>
              Annuler
            </Button>
            <Button taille="sm" onClick={sauvegarder} chargement={enregistrer.isPending}>
              Enregistrer
            </Button>
          </div>
        </CardBody>
      )}
    </Card>
  )
}

export { titreReunion }
