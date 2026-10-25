'use client'

import { useState } from 'react'
import {
  LABELS_BRANCHES,
  LABELS_ROLES,
  LABELS_STATUT_ACTIVITE,
  LABELS_TYPE_ACTIVITE,
  ORDRE_CATEGORIES_SCOUTS,
  ROLES_BRANCHE,
} from '@scout/shared'
import { Alert, Button, ButtonLink, Card, CardBody, CardHeader, Field, Input, Select, Switch, Textarea, confirmer } from '@/components/ui'
import { useSession } from '@/lib/session-client'
import { valeurChampDateHeure } from '@/lib/format'
import { Globe } from '@/lib/icons'
import { useMaBranche, useMembresMaitrise, type Activite, type DonneesActivite, type StatutActivite } from '@/hooks/useActivites'

interface Erreurs {
  titre?: string
  dateDebut?: string
  dateFin?: string
  descriptionPublique?: string
}

/** Convertit une saisie datetime-local (heure locale) en ISO ; '' → null. */
function versIso(valeur: string): string | null {
  return valeur ? new Date(valeur).toISOString() : null
}

/**
 * Formulaire commun à la création et à la modification d'une activité.
 * Le texte public est distinct de la description interne : il est le seul
 * contenu descriptif affiché sur le site public lorsque l'activité est publiée.
 */
export function FormulaireActivite({
  initiale,
  enCours,
  onSoumettre,
  annulerHref,
}: {
  initiale?: Activite
  enCours: boolean
  onSoumettre: (donnees: DonneesActivite) => Promise<void>
  annulerHref: string
}) {
  const { data: session } = useSession()
  const estBranche = ROLES_BRANCHE.includes(session?.user?.role ?? '')
  const maBranche = useMaBranche(estBranche)
  const maitrise = useMembresMaitrise()

  const [titre, setTitre] = useState(initiale?.titre ?? '')
  const [type, setType] = useState(initiale?.type ?? 'REUNION')
  const [brancheType, setBrancheType] = useState(initiale?.brancheType ?? '')
  const [dateDebut, setDateDebut] = useState(valeurChampDateHeure(initiale?.dateDebut))
  const [dateFin, setDateFin] = useState(valeurChampDateHeure(initiale?.dateFin))
  const [lieu, setLieu] = useState(initiale?.lieu ?? '')
  const [description, setDescription] = useState(initiale?.description ?? '')
  const [statut, setStatut] = useState<StatutActivite>(initiale?.statut ?? 'PREVUE')
  const [responsableId, setResponsableId] = useState(initiale?.responsableId ?? '')
  const [bilan, setBilan] = useState(initiale?.bilan ?? '')
  const [publique, setPublique] = useState(initiale?.publique ?? false)
  const [descriptionPublique, setDescriptionPublique] = useState(initiale?.descriptionPublique ?? '')
  const [erreurs, setErreurs] = useState<Erreurs>({})

  const membres = maitrise.data ?? []
  // Le responsable actuel reste sélectionnable même s'il n'est plus dans la maîtrise active.
  const responsableAbsent =
    initiale?.responsable && !membres.some((m) => m.id === initiale.responsable?.id) ? initiale.responsable : null

  function valider(): Erreurs {
    const e: Erreurs = {}
    if (!titre.trim()) e.titre = 'Le titre est requis.'
    if (!dateDebut) e.dateDebut = 'La date de début est requise.'
    if (dateDebut && dateFin && new Date(dateFin) <= new Date(dateDebut)) e.dateFin = 'La date de fin doit être après la date de début.'
    if (publique && !descriptionPublique.trim()) e.descriptionPublique = 'Un texte public est requis pour publier l’activité.'
    return e
  }

  async function soumettre(e: React.FormEvent) {
    e.preventDefault()
    const errs = valider()
    setErreurs(errs)
    if (Object.keys(errs).length > 0) return

    // Publication explicite : confirmation lorsqu'elle est activée maintenant.
    if (publique && !initiale?.publique) {
      const ok = await confirmer({
        titre: 'Publier cette activité sur le site public ?',
        description:
          'Le titre, les dates, le lieu, la branche, le statut et le texte public seront visibles par tous les visiteurs du site, sans connexion. La description interne et le bilan restent privés.',
        labelConfirmer: 'Publier',
      })
      if (!ok) return
    }

    const donnees: DonneesActivite = {
      titre: titre.trim(),
      type,
      dateDebut: versIso(dateDebut)!,
      dateFin: versIso(dateFin),
      lieu: lieu.trim() || null,
      description: description.trim() || null,
      statut,
      responsableId: responsableId || null,
      publique,
      descriptionPublique: descriptionPublique.trim() || null,
      ...(initiale ? { bilan: bilan.trim() || null } : {}),
      // Un rôle de branche ne choisit pas la branche : l'API impose la sienne.
      ...(estBranche ? {} : { brancheType: brancheType || null }),
    }
    await onSoumettre(donnees)
  }

  const brancheAffichee = initiale ? initiale.brancheType : maBranche.data?.brancheType

  return (
    <form onSubmit={soumettre} noValidate className="space-y-6">
      <Card>
        <CardHeader titre="Informations" description="Les champs marqués d’un astérisque sont obligatoires." />
        <CardBody className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Titre" requis erreur={erreurs.titre} className="sm:col-span-2">
            {(p) => <Input {...p} value={titre} onChange={(e) => setTitre(e.target.value)} placeholder="Ex. Sortie découverte Louveteaux" maxLength={200} />}
          </Field>
          <Field label="Type" requis>
            {(p) => (
              <Select
                {...p}
                value={type}
                onChange={(e) => setType(e.target.value)}
                options={Object.entries(LABELS_TYPE_ACTIVITE).map(([valeur, libelle]) => ({ valeur, libelle }))}
              />
            )}
          </Field>
          <Field
            label="Branche"
            aide={estBranche ? 'Les activités de branche sont rattachées à votre branche.' : 'Laisser vide pour une activité inter-branches.'}
          >
            {(p) =>
              estBranche ? (
                <Input {...p} disabled value={brancheAffichee ? (LABELS_BRANCHES[brancheAffichee] ?? brancheAffichee) : 'Inter-branches'} readOnly />
              ) : (
                <Select
                  {...p}
                  value={brancheType}
                  onChange={(e) => setBrancheType(e.target.value)}
                  vide="Inter-branches (toutes)"
                  options={ORDRE_CATEGORIES_SCOUTS.map((b) => ({ valeur: b, libelle: LABELS_BRANCHES[b] }))}
                />
              )
            }
          </Field>
          <Field label="Début" requis erreur={erreurs.dateDebut}>
            {(p) => <Input {...p} type="datetime-local" value={dateDebut} onChange={(e) => setDateDebut(e.target.value)} />}
          </Field>
          <Field label="Fin" erreur={erreurs.dateFin}>
            {(p) => <Input {...p} type="datetime-local" value={dateFin} onChange={(e) => setDateFin(e.target.value)} />}
          </Field>
          <Field label="Lieu" className="sm:col-span-2">
            {(p) => <Input {...p} value={lieu} onChange={(e) => setLieu(e.target.value)} maxLength={200} />}
          </Field>
          <Field label="Description interne" aide="Réservée à la maîtrise, jamais publiée." className="sm:col-span-2">
            {(p) => <Textarea {...p} value={description} onChange={(e) => setDescription(e.target.value)} rows={4} />}
          </Field>
        </CardBody>
      </Card>

      <Card>
        <CardHeader titre="Suivi" />
        <CardBody className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Statut">
            {(p) => (
              <Select
                {...p}
                value={statut}
                onChange={(e) => setStatut(e.target.value as StatutActivite)}
                options={Object.entries(LABELS_STATUT_ACTIVITE).map(([valeur, libelle]) => ({ valeur, libelle }))}
              />
            )}
          </Field>
          <Field
            label="Responsable"
            aide={maitrise.isError ? 'Liste de la maîtrise indisponible.' : 'Membre de la maîtrise chargé de l’activité.'}
          >
            {(p) => (
              <Select {...p} value={responsableId} onChange={(e) => setResponsableId(e.target.value)} disabled={maitrise.isLoading} vide="Aucun responsable désigné">
                {responsableAbsent && (
                  <option value={responsableAbsent.id}>
                    {responsableAbsent.prenom} {responsableAbsent.nom}
                  </option>
                )}
                {membres.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.prenom} {m.nom} — {LABELS_ROLES[m.role] ?? m.role}
                    {m.brancheType ? ` (${LABELS_BRANCHES[m.brancheType] ?? m.brancheType})` : ''}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          {initiale && (
            <Field label="Bilan" aide="Déroulement, points forts, points à améliorer. Interne à la maîtrise." className="sm:col-span-2">
              {(p) => <Textarea {...p} value={bilan} onChange={(e) => setBilan(e.target.value)} rows={5} />}
            </Field>
          )}
        </CardBody>
      </Card>

      <Card>
        <CardHeader titre="Publication sur le site public" />
        <CardBody className="space-y-4">
          <Switch
            checked={publique}
            onChange={setPublique}
            label="Publier cette activité"
            description="Désactivé par défaut. Une activité annulée n’apparaît jamais sur le site public."
          />
          {publique && (
            <>
              <Alert niveau="attention" titre="Visible sur le site public">
                Le titre, les dates, le lieu, la branche, le statut et le texte ci-dessous seront visibles par tous les visiteurs, sans connexion.
                N’y mettez aucune donnée personnelle (noms d’enfants, téléphones, informations de santé).
              </Alert>
              <Field label="Texte public" requis erreur={erreurs.descriptionPublique} aide="Distinct de la description interne.">
                {(p) => <Textarea {...p} value={descriptionPublique} onChange={(e) => setDescriptionPublique(e.target.value)} rows={4} />}
              </Field>
            </>
          )}
          {!publique && initiale?.publique && (
            <Alert niveau="info">L’activité sera retirée du site public à l’enregistrement.</Alert>
          )}
        </CardBody>
      </Card>

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <ButtonLink href={annulerHref} variante="secondaire">
          Annuler
        </ButtonLink>
        <Button type="submit" chargement={enCours} icone={publique ? Globe : undefined}>
          {initiale ? 'Enregistrer les modifications' : 'Créer l’activité'}
        </Button>
      </div>
    </form>
  )
}
