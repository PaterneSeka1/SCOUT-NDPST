'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { toast } from 'sonner'
import {
  ESPACES_FAMILLES_ACTIFS,
  LABELS_BRANCHES,
  LABELS_STATUT_COTISATION,
  LABELS_TYPE_COTISATION,
  LABELS_TYPE_DOCUMENT,
  REGLE_MOT_DE_PASSE,
  ROLES_BRANCHE,
  ROLES_GROUPE_ETENDU,
  calculerAge,
  formatMontantFCFA,
  pageHorsPerimetre,
} from '@scout/shared'
import {
  useAjouterContact,
  useAjouterDocument,
  useAttribuerMatricule,
  useCreerCompteScout,
  useScout,
  useSupprimerContact,
  useSupprimerDocument,
  type DocumentScout,
} from '@/hooks/useScouts'
import { useProgressionsScout, useValiderBadge } from '@/hooks/useProgressions'
import { useSession } from '@/lib/session-client'
import { ErreurApi, televerser } from '@/lib/api'
import { dateCourte, dateLongue } from '@/lib/format'
import {
  AlertTriangle,
  ArrowRight,
  Award,
  Camera,
  Check,
  ICONES_TYPE_DOCUMENT,
  Paperclip,
  Pencil,
  Plus,
  QrCode,
  Stethoscope,
  Trash2,
  Upload,
} from '@/lib/icons'
import { PasswordInput } from '@/components/PasswordInput'
import {
  Alert,
  Badge,
  Button,
  ButtonLink,
  Card,
  CardBody,
  CardHeader,
  ChargementPage,
  Checkbox,
  EmptyState,
  ErrorState,
  Field,
  Input,
  Modal,
  PageHeader,
  Select,
  confirmer,
  type Ton,
} from '@/components/ui'

const TONS_COTISATION: Record<string, Ton> = {
  EN_ATTENTE: 'attention',
  PARTIELLEMENT_PAYEE: 'info',
  PAYEE: 'succes',
  EXONEREE: 'neutre',
}

const RELATIONS = ['Père', 'Mère', 'Tuteur', 'Tutrice', 'Autre']
const CONTACT_VIDE = { nom: '', prenom: '', telephone: '', relation: '', principal: false }

function messageErreur(e: unknown, defaut = 'Une erreur est survenue.') {
  return e instanceof Error ? e.message : defaut
}

export default function PageFicheScout() {
  const { id } = useParams<{ id: string }>()
  const { data: session } = useSession()
  const role = session?.user.role ?? ''
  const estEncadrementBranche = ROLES_BRANCHE.includes(role)
  // Aligné sur PUT /api/scouts/:id/matricule (équipe de groupe uniquement).
  const peutGererMatricule = ROLES_GROUPE_ETENDU.includes(role)

  const { data: scout, isLoading, error, refetch } = useScout(id)
  // GET /api/scouts/:id/progressions est réservé à l'encadrement de branche.
  const progressions = useProgressionsScout(id, estEncadrementBranche)

  const attribuerMatricule = useAttribuerMatricule(id)
  const ajouterContact = useAjouterContact(id)
  const supprimerContact = useSupprimerContact(id)
  const creerCompte = useCreerCompteScout(id)
  const ajouterDocument = useAjouterDocument(id)
  const supprimerDocument = useSupprimerDocument(id)
  const validerBadge = useValiderBadge(id)

  const [modaleMatricule, setModaleMatricule] = useState(false)
  const [matricule, setMatricule] = useState('')
  const [modaleContact, setModaleContact] = useState(false)
  const [contact, setContact] = useState(CONTACT_VIDE)
  const [modaleCompte, setModaleCompte] = useState(false)
  const [motDePasse, setMotDePasse] = useState('')
  const [telephoneCompte, setTelephoneCompte] = useState('')
  const [typeDocument, setTypeDocument] = useState('CERTIFICAT_MEDICAL')
  const [expirationDocument, setExpirationDocument] = useState('')
  const [envoiDocument, setEnvoiDocument] = useState(false)
  const [badgeEnCours, setBadgeEnCours] = useState<string | null>(null)
  const [maintenant] = useState(() => new Date())

  const miettes = [
    { libelle: 'Tableau de bord', href: '/dashboard' },
    { libelle: 'Scouts', href: '/dashboard/scouts' },
    { libelle: scout ? `${scout.prenom} ${scout.nom}` : 'Fiche' },
  ]

  if (isLoading) return <ChargementPage libelle="Chargement de la fiche…" />
  if (error || !scout) {
    return (
      <>
        <PageHeader titre="Fiche scout" miettes={miettes} />
        <Card>
          <ErrorState
            message={error instanceof ErreurApi && error.statut === 404 ? 'Scout introuvable.' : error?.message}
            onReessayer={() => refetch()}
          />
        </Card>
      </>
    )
  }

  const age = calculerAge(new Date(scout.dateNaissance), maintenant)

  async function enregistrerMatricule(e: React.FormEvent) {
    e.preventDefault()
    try {
      await attribuerMatricule.mutateAsync(matricule.trim())
      toast.success('Matricule enregistré.')
      setModaleMatricule(false)
      setMatricule('')
    } catch (err) {
      toast.error(messageErreur(err))
    }
  }

  async function enregistrerContact(e: React.FormEvent) {
    e.preventDefault()
    try {
      await ajouterContact.mutateAsync({
        nom: contact.nom.trim(),
        prenom: contact.prenom.trim() || undefined,
        telephone: contact.telephone.trim(),
        relation: contact.relation || undefined,
        principal: contact.principal,
      })
      toast.success('Contact ajouté.')
      setModaleContact(false)
      setContact(CONTACT_VIDE)
    } catch (err) {
      toast.error(messageErreur(err))
    }
  }

  async function retirerContact(contactId: string, nom: string) {
    const ok = await confirmer({
      titre: 'Supprimer ce contact ?',
      description: `${nom} ne sera plus joignable en cas d'urgence depuis cette fiche.`,
      labelConfirmer: 'Supprimer',
      danger: true,
    })
    if (!ok) return
    try {
      await supprimerContact.mutateAsync(contactId)
      toast.success('Contact supprimé.')
    } catch (err) {
      toast.error(messageErreur(err))
    }
  }

  async function envoyerDocument(e: React.ChangeEvent<HTMLInputElement>) {
    const fichier = e.target.files?.[0]
    e.target.value = ''
    if (!fichier) return
    setEnvoiDocument(true)
    try {
      const url = await televerser(fichier, 'privee')
      await ajouterDocument.mutateAsync({
        type: typeDocument,
        nomFichier: fichier.name,
        url,
        dateExpiration: expirationDocument || null,
      })
      toast.success('Document ajouté.')
      setExpirationDocument('')
    } catch (err) {
      toast.error(messageErreur(err, "Échec de l'envoi du document."))
    } finally {
      setEnvoiDocument(false)
    }
  }

  async function retirerDocument(doc: DocumentScout) {
    if (!scout) return
    const ok = await confirmer({
      titre: 'Supprimer ce document ?',
      description: `Le document « ${LABELS_TYPE_DOCUMENT[doc.type] ?? doc.type} » (${doc.nomFichier}) sera définitivement retiré de la fiche de ${scout.prenom} ${scout.nom}.`,
      labelConfirmer: 'Supprimer',
      danger: true,
    })
    if (!ok) return
    try {
      await supprimerDocument.mutateAsync(doc.id)
      toast.success('Document supprimé.')
    } catch (err) {
      toast.error(messageErreur(err))
    }
  }

  async function enregistrerCompte(e: React.FormEvent) {
    e.preventDefault()
    try {
      await creerCompte.mutateAsync({ password: motDePasse, telephone: telephoneCompte || undefined })
      toast.success('Compte créé.')
      setModaleCompte(false)
      setMotDePasse('')
      setTelephoneCompte('')
    } catch (err) {
      toast.error(messageErreur(err))
    }
  }

  async function valider(badgeId: string, nom: string) {
    const ok = await confirmer({
      titre: `Valider l'étape « ${nom} » ?`,
      description: 'La validation est enregistrée à votre nom et à la date du jour.',
      labelConfirmer: 'Valider',
    })
    if (!ok) return
    setBadgeEnCours(badgeId)
    try {
      await validerBadge.mutateAsync({ badgeId })
      toast.success('Étape validée.')
    } catch (err) {
      toast.error(messageErreur(err))
    } finally {
      setBadgeEnCours(null)
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        titre={`${scout.prenom} ${scout.nom}`}
        description={`${LABELS_BRANCHES[scout.brancheType] ?? scout.brancheType}${scout.equipe ? ` · Équipe ${scout.equipe.nom}` : ''} · ${age} ans`}
        miettes={miettes}
        actions={
          <>
            {!pageHorsPerimetre(`/dashboard/scouts/${id}/carte`) && (
              <ButtonLink href={`/dashboard/scouts/${id}/carte`} variante="secondaire" icone={QrCode}>
                Carte QR
              </ButtonLink>
            )}
            <ButtonLink href={`/dashboard/scouts/${id}/modifier`} icone={Pencil}>
              Modifier
            </ButtonLink>
          </>
        }
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          {/* Identité */}
          <Card>
            <CardHeader titre="Identité" />
            <CardBody>
              <dl className="grid gap-4 text-sm sm:grid-cols-2">
                <div>
                  <dt className="text-stone-500">Date de naissance</dt>
                  <dd className="text-stone-900">{dateLongue(scout.dateNaissance)}</dd>
                </div>
                <div>
                  <dt className="text-stone-500">Sexe</dt>
                  <dd className="text-stone-900">{scout.sexe === 'MASCULIN' ? 'Garçon' : 'Fille'}</dd>
                </div>
                <div>
                  <dt className="text-stone-500">Branche</dt>
                  <dd>
                    <Badge ton="primaire">{LABELS_BRANCHES[scout.brancheType] ?? scout.brancheType}</Badge>
                  </dd>
                </div>
                <div>
                  <dt className="text-stone-500">Équipe</dt>
                  <dd className="text-stone-900">{scout.equipe?.nom ?? 'Aucune équipe'}</dd>
                </div>
                <div>
                  <dt className="text-stone-500">Statut</dt>
                  <dd>
                    <Badge ton={scout.actif ? 'succes' : 'neutre'}>{scout.actif ? 'Actif' : 'Inactif'}</Badge>
                  </dd>
                </div>
                <div>
                  <dt className="text-stone-500">Matricule</dt>
                  <dd className="flex flex-wrap items-center gap-2">
                    {scout.matricule ? (
                      <span className="font-mono text-stone-900">{scout.matricule}</span>
                    ) : (
                      <span className="text-stone-500">Non attribué</span>
                    )}
                    {peutGererMatricule && (
                      <Button
                        variante="fantome"
                        taille="sm"
                        onClick={() => {
                          setMatricule(scout.matricule ?? '')
                          setModaleMatricule(true)
                        }}
                      >
                        {scout.matricule ? 'Modifier' : 'Attribuer'}
                      </Button>
                    )}
                  </dd>
                </div>
              </dl>
              <div className="mt-4 flex flex-wrap gap-2">
                <Badge ton={scout.consentementImage ? 'succes' : 'neutre'}>
                  <Camera className="h-3 w-3" aria-hidden />
                  {scout.consentementImage ? "Droit à l'image : autorisation déclarée" : "Droit à l'image non autorisé"}
                </Badge>
                <Badge ton={scout.consentementSante ? 'succes' : 'attention'}>
                  <Stethoscope className="h-3 w-3" aria-hidden />
                  {scout.consentementSante ? 'Données de santé : consentement déclaré' : 'Données de santé : consentement à recueillir'}
                </Badge>
              </div>
              <p className="mt-2 text-xs text-stone-500">
                Déclaration administrative : la preuve parentale reste à vérifier. Ces indicateurs ne constituent pas une preuve de consentement.
              </p>
            </CardBody>
          </Card>

          {/* Informations médicales — mises en avant pour une lecture rapide en cas d'urgence */}
          {(scout.allergies || scout.traitementsMedicaux) && (
            <Alert niveau="attention" titre="Informations médicales">
              {scout.allergies && (
                <p>
                  <span className="font-medium">Allergies :</span> {scout.allergies}
                </p>
              )}
              {scout.traitementsMedicaux && (
                <p>
                  <span className="font-medium">Traitements en cours :</span> {scout.traitementsMedicaux}
                </p>
              )}
            </Alert>
          )}

          {/* Progression : validation par l'encadrement de la branche */}
          <Card>
            <CardHeader
              titre="Progression pédagogique"
              description={`Étapes du référentiel de la branche ${LABELS_BRANCHES[scout.brancheType] ?? scout.brancheType}.`}
              actions={
                <ButtonLink href="/dashboard/progression" variante="fantome" taille="sm" icone={ArrowRight}>
                  Référentiel
                </ButtonLink>
              }
            />
            {!estEncadrementBranche ? (
              <CardBody>
                <p className="text-sm text-stone-500">
                  La validation des étapes est réservée à l&apos;encadrement de la branche du scout. La synthèse par branche est
                  disponible dans la rubrique Progression pédagogique.
                </p>
              </CardBody>
            ) : progressions.isLoading ? (
              <CardBody>
                <p className="text-sm text-stone-500" role="status">
                  Chargement de la progression…
                </p>
              </CardBody>
            ) : progressions.error ? (
              <ErrorState message={progressions.error.message} onReessayer={() => progressions.refetch()} />
            ) : !progressions.data || progressions.data.badges.length === 0 ? (
              <EmptyState
                icon={Award}
                title="Aucun référentiel n'a encore été saisi"
                description="Utilisez les documents officiels de la branche pour saisir les étapes dans la rubrique Progression pédagogique."
              />
            ) : (
              <ul className="divide-y divide-stone-100">
                {progressions.data.badges.map((badge) => (
                  <li key={badge.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-stone-900">{badge.nom}</p>
                      {badge.description && <p className="text-xs text-stone-500">{badge.description}</p>}
                      {badge.valide && (
                        <p className="mt-0.5 text-xs text-stone-500">
                          Validée le {dateCourte(badge.dateValidation)}
                          {badge.valideParNomComplet ? ` par ${badge.valideParNomComplet}` : ''}
                        </p>
                      )}
                    </div>
                    {badge.valide ? (
                      <Badge ton="succes">
                        <Check className="h-3 w-3" aria-hidden /> Validée
                      </Badge>
                    ) : (
                      <Button
                        taille="sm"
                        variante="secondaire"
                        chargement={badgeEnCours === badge.id}
                        onClick={() => valider(badge.id, badge.nom)}
                      >
                        Valider
                      </Button>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </Card>

          {/* Documents */}
          <Card>
            <CardHeader titre="Documents" description="Fiche médicale, autorisation parentale… conservées sur la fiche." />
            {scout.documents.length === 0 ? (
              <CardBody>
                <p className="text-sm text-stone-500">Aucun document enregistré.</p>
              </CardBody>
            ) : (
              <ul className="divide-y divide-stone-100">
                {scout.documents.map((doc) => {
                  const Icone = ICONES_TYPE_DOCUMENT[doc.type] ?? Paperclip
                  const expire = doc.dateExpiration ? new Date(doc.dateExpiration) < maintenant : false
                  return (
                    <li key={doc.id} className="flex items-center justify-between gap-3 px-5 py-3">
                      <a href={doc.url} target="_blank" rel="noopener noreferrer" className="flex min-w-0 items-center gap-3 hover:underline">
                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-sable-50 text-stone-500">
                          <Icone className="h-4 w-4" aria-hidden />
                        </span>
                        <span className="min-w-0">
                          <span className="block truncate text-sm font-medium text-stone-900">
                            {LABELS_TYPE_DOCUMENT[doc.type] ?? doc.type}
                          </span>
                          <span className="block truncate text-xs text-stone-500">{doc.nomFichier}</span>
                          {doc.dateExpiration && (
                            <span className={`block text-xs ${expire ? 'font-medium text-red-600' : 'text-stone-500'}`}>
                              {expire ? 'Expiré le ' : 'Expire le '}
                              {dateCourte(doc.dateExpiration)}
                            </span>
                          )}
                        </span>
                      </a>
                      <Button variante="fantome" taille="sm" icone={Trash2} onClick={() => retirerDocument(doc)} aria-label={`Supprimer ${doc.nomFichier}`}>
                        <span className="sr-only sm:not-sr-only">Supprimer</span>
                      </Button>
                    </li>
                  )
                })}
              </ul>
            )}
            <CardBody className="border-t border-stone-100">
              <div className="grid gap-3 sm:grid-cols-3 sm:items-end">
                <Field label="Type de document">
                  {(p) => (
                    <Select
                      {...p}
                      value={typeDocument}
                      onChange={(e) => setTypeDocument(e.target.value)}
                      options={Object.entries(LABELS_TYPE_DOCUMENT).map(([valeur, libelle]) => ({ valeur, libelle }))}
                    />
                  )}
                </Field>
                <Field label="Date d'expiration" aide="Facultative.">
                  {(p) => <Input {...p} type="date" value={expirationDocument} onChange={(e) => setExpirationDocument(e.target.value)} />}
                </Field>
                <label className="inline-flex h-10 cursor-pointer items-center justify-center gap-2 rounded-lg bg-primaire px-4 text-sm font-medium text-white shadow-sm hover:brightness-110">
                  <Upload className="h-4 w-4" aria-hidden />
                  {envoiDocument ? 'Envoi…' : 'Ajouter un fichier'}
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp,application/pdf"
                    onChange={envoyerDocument}
                    disabled={envoiDocument}
                    className="sr-only"
                  />
                </label>
              </div>
            </CardBody>
          </Card>
        </div>

        <div className="space-y-6">
          {/* Contacts d'urgence */}
          <Card>
            <CardHeader
              titre="Contacts d'urgence"
              actions={
                <Button variante="fantome" taille="sm" icone={Plus} onClick={() => setModaleContact(true)}>
                  Ajouter
                </Button>
              }
            />
            {scout.contactsUrgence.length === 0 ? (
              <CardBody>
                <Alert niveau="attention">Aucun contact d&apos;urgence enregistré.</Alert>
              </CardBody>
            ) : (
              <ul className="divide-y divide-stone-100">
                {scout.contactsUrgence.map((c) => (
                  <li key={c.id} className="flex items-start justify-between gap-2 px-5 py-3">
                    <div className="min-w-0 text-sm">
                      <p className="font-medium text-stone-900">
                        {c.prenom} {c.nom} {c.principal && <Badge ton="primaire">Principal</Badge>}
                      </p>
                      {c.relation && <p className="text-xs text-stone-500">{c.relation}</p>}
                      <a href={`tel:${c.telephone}`} className="text-stone-700 hover:underline">
                        {c.telephone}
                      </a>
                    </div>
                    {/* Au moins un contact doit rester (règle de l'API). */}
                    {scout.contactsUrgence.length > 1 && (
                      <Button
                        variante="fantome"
                        taille="sm"
                        icone={Trash2}
                        aria-label={`Supprimer le contact ${c.prenom ?? ''} ${c.nom}`}
                        onClick={() => retirerContact(c.id, `${c.prenom ?? ''} ${c.nom}`.trim())}
                      />
                    )}
                  </li>
                ))}
              </ul>
            )}
          </Card>

          {/* Cotisations */}
          <Card>
            <CardHeader
              titre="Cotisations"
              actions={
                <Link href="/dashboard/cotisations" className="inline-flex items-center gap-1 text-xs font-medium text-primaire hover:underline">
                  Voir tout <ArrowRight className="h-3 w-3" aria-hidden />
                </Link>
              }
            />
            {scout.cotisations.length === 0 ? (
              <CardBody>
                <p className="text-sm text-stone-500">Aucune cotisation enregistrée.</p>
              </CardBody>
            ) : (
              <ul className="divide-y divide-stone-100">
                {scout.cotisations.map((c) => (
                  <li key={c.id} className="flex items-center justify-between gap-2 px-5 py-3">
                    <div className="min-w-0 text-sm">
                      <p className="text-stone-900">
                        {LABELS_TYPE_COTISATION[c.type] ?? c.type}
                        {c.libelle ? ` — ${c.libelle}` : ''}
                      </p>
                      <p className="text-xs text-stone-500">
                        {c.anneeScolaire} · {formatMontantFCFA(c.montant)}
                      </p>
                    </div>
                    <Badge ton={TONS_COTISATION[c.statut] ?? 'neutre'}>{LABELS_STATUT_COTISATION[c.statut] ?? c.statut}</Badge>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          {/* Espaces familles : fermés tant que ESPACES_FAMILLES_ACTIFS vaut false. */}
          {ESPACES_FAMILLES_ACTIFS && (
            <Card>
              <CardHeader titre="Espace personnel du scout" />
              <CardBody>
                {scout.utilisateur ? (
                  <Badge ton="succes">
                    <Check className="h-3 w-3" aria-hidden /> Compte actif
                  </Badge>
                ) : !scout.matricule ? (
                  <p className="text-sm text-stone-500">Un matricule est requis avant de créer un compte.</p>
                ) : peutGererMatricule ? (
                  <Button taille="sm" onClick={() => setModaleCompte(true)}>
                    Créer un compte
                  </Button>
                ) : (
                  <p className="text-sm text-stone-500">Aucun compte.</p>
                )}
              </CardBody>
            </Card>
          )}
          {ESPACES_FAMILLES_ACTIFS && scout.liensParents.length > 0 && (
            <Card>
              <CardHeader titre="Parents avec espace personnel" />
              <ul className="divide-y divide-stone-100">
                {scout.liensParents.map((lien) => (
                  <li key={lien.parentId} className="px-5 py-3 text-sm">
                    <p className="font-medium text-stone-900">
                      {lien.parent.prenom} {lien.parent.nom}
                    </p>
                    {lien.parent.telephone && <p className="text-stone-500">{lien.parent.telephone}</p>}
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </div>
      </div>

      <Modal
        ouvert={modaleMatricule}
        onFermer={() => setModaleMatricule(false)}
        titre={scout.matricule ? 'Modifier le matricule' : 'Attribuer un matricule'}
        taille="sm"
        pied={
          <>
            <Button variante="secondaire" onClick={() => setModaleMatricule(false)}>
              Annuler
            </Button>
            <Button type="submit" form="form-matricule" chargement={attribuerMatricule.isPending}>
              Enregistrer
            </Button>
          </>
        }
      >
        <form id="form-matricule" onSubmit={enregistrerMatricule}>
          <Field label="Matricule" requis aide="Identifiant officiel unique du scout.">
            {(p) => <Input {...p} value={matricule} onChange={(e) => setMatricule(e.target.value)} className="font-mono" autoFocus />}
          </Field>
        </form>
      </Modal>

      <Modal
        ouvert={modaleContact}
        onFermer={() => setModaleContact(false)}
        titre="Ajouter un contact d'urgence"
        pied={
          <>
            <Button variante="secondaire" onClick={() => setModaleContact(false)}>
              Annuler
            </Button>
            <Button type="submit" form="form-contact" chargement={ajouterContact.isPending}>
              Ajouter
            </Button>
          </>
        }
      >
        <form id="form-contact" onSubmit={enregistrerContact} className="grid gap-4 sm:grid-cols-2">
          <Field label="Nom" requis>
            {(p) => <Input {...p} value={contact.nom} onChange={(e) => setContact((c) => ({ ...c, nom: e.target.value }))} />}
          </Field>
          <Field label="Prénom">
            {(p) => <Input {...p} value={contact.prenom} onChange={(e) => setContact((c) => ({ ...c, prenom: e.target.value }))} />}
          </Field>
          <Field label="Téléphone" requis>
            {(p) => (
              <Input {...p} type="tel" value={contact.telephone} onChange={(e) => setContact((c) => ({ ...c, telephone: e.target.value }))} />
            )}
          </Field>
          <Field label="Relation">
            {(p) => (
              <Select
                {...p}
                value={contact.relation}
                onChange={(e) => setContact((c) => ({ ...c, relation: e.target.value }))}
                vide="Sélectionner"
                options={RELATIONS.map((r) => ({ valeur: r, libelle: r }))}
              />
            )}
          </Field>
          <Checkbox
            className="sm:col-span-2"
            label="Contact principal"
            checked={contact.principal}
            onChange={(e) => setContact((c) => ({ ...c, principal: e.target.checked }))}
          />
        </form>
      </Modal>

      {ESPACES_FAMILLES_ACTIFS && (
        <Modal
          ouvert={modaleCompte}
          onFermer={() => setModaleCompte(false)}
          titre="Créer l'espace personnel du scout"
          taille="sm"
          pied={
            <>
              <Button variante="secondaire" onClick={() => setModaleCompte(false)}>
                Annuler
              </Button>
              <Button type="submit" form="form-compte" chargement={creerCompte.isPending}>
                Créer le compte
              </Button>
            </>
          }
        >
          <form id="form-compte" onSubmit={enregistrerCompte} className="space-y-4">
            <div>
              <label htmlFor="mdp-compte" className="mb-1.5 block text-sm font-medium text-stone-700">
                Mot de passe provisoire
              </label>
              <PasswordInput id="mdp-compte" value={motDePasse} onChange={(e) => setMotDePasse(e.target.value)} required placeholder={REGLE_MOT_DE_PASSE} />
            </div>
            <Field label="Téléphone">
              {(p) => <Input {...p} type="tel" value={telephoneCompte} onChange={(e) => setTelephoneCompte(e.target.value)} />}
            </Field>
            <p className="flex items-center gap-1 text-xs text-stone-500">
              <AlertTriangle className="h-3 w-3" aria-hidden /> Le scout devra changer ce mot de passe à la première connexion.
            </p>
          </form>
        </Modal>
      )}
    </div>
  )
}
