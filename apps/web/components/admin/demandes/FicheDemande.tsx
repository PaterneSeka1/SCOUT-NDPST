'use client'

import { useState } from 'react'
import { useParams } from 'next/navigation'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { LABELS_BRANCHES, LABELS_STATUT_DEMANDE, LABELS_TYPE_DEMANDE } from '@scout/shared'
import {
  Alert,
  Button,
  ButtonLink,
  Card,
  CardBody,
  CardHeader,
  ErrorState,
  Field,
  PageHeader,
  Select,
  StatusBadge,
  Textarea,
  confirmer,
} from '@/components/ui'
import { api } from '@/lib/api'
import { dateCourte, dateHeure, dateLongue } from '@/lib/format'
import { ArrowLeft, Mail, Phone } from '@/lib/icons'
import { TONS_STATUT_DEMANDE, messageErreur, miettesAdmin, texteOuNull } from '@/components/admin/commun'
import { ChargementFormulaire } from '@/components/admin/ChargementFormulaire'

interface Demande {
  id: string
  type: string
  statut: string
  nomContact: string
  prenomContact: string
  telephone: string
  email: string | null
  nomJeune: string | null
  prenomJeune: string | null
  dateNaissanceJeune: string | null
  brancheSouhaitee: string | null
  message: string | null
  consentementLe: string
  notesInternes: string | null
  traiteeLe: string | null
  traiteePar: { prenom: string; nom: string } | null
  createdAt: string
  updatedAt: string
}

const OPTIONS_STATUT = Object.entries(LABELS_STATUT_DEMANDE).map(([valeur, libelle]) => ({ valeur, libelle }))

function Info({ libelle, children }: { libelle: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs font-medium tracking-wide text-stone-500 uppercase">{libelle}</dt>
      <dd className="mt-0.5 text-sm break-words text-stone-900">{children || <span className="text-stone-400">—</span>}</dd>
    </div>
  )
}

export function FicheDemande() {
  const { id } = useParams<{ id: string }>()
  const requete = useQuery({
    queryKey: ['admin', 'demandes', 'detail', id],
    queryFn: () => api<Demande>(`/api/admin/demandes/${encodeURIComponent(id)}`),
    enabled: !!id,
  })
  const d = requete.data

  const miettes = miettesAdmin({ libelle: "Demandes d'adhésion", href: '/admin/demandes' }, { libelle: 'Demande' })

  if (requete.isPending) {
    return (
      <div>
        <PageHeader titre="Demande" miettes={miettes} />
        <ChargementFormulaire libelle="Chargement de la demande…" />
      </div>
    )
  }
  if (requete.isError || !d) {
    return (
      <div>
        <PageHeader titre="Demande" miettes={miettes} />
        <Card>
          <ErrorState message={messageErreur(requete.error)} onReessayer={() => requete.refetch()} />
        </Card>
      </div>
    )
  }

  const jeune = d.type === 'INSCRIPTION_JEUNE' || d.nomJeune || d.prenomJeune

  return (
    <div className="space-y-6">
      <PageHeader
        titre={`${d.prenomContact} ${d.nomContact}`}
        description={`${LABELS_TYPE_DEMANDE[d.type] ?? d.type} — reçue le ${dateLongue(d.createdAt)}`}
        miettes={miettes}
        actions={
          <ButtonLink href="/admin/demandes" variante="secondaire" icone={ArrowLeft}>
            Retour à la liste
          </ButtonLink>
        }
      />

      <Alert niveau="info">
        Une demande ne crée jamais de compte : l&apos;inscription effective se fait ensuite dans la gestion du groupe.
      </Alert>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader titre="Contact" actions={<StatusBadge valeur={d.statut} libelles={LABELS_STATUT_DEMANDE} tons={TONS_STATUT_DEMANDE} />} />
            <CardBody>
              <dl className="grid gap-4 sm:grid-cols-2">
                <Info libelle="Nom">{d.nomContact}</Info>
                <Info libelle="Prénom">{d.prenomContact}</Info>
                <Info libelle="Téléphone">
                  <a href={`tel:${d.telephone.replace(/[^+\d]/g, '')}`} className="inline-flex items-center gap-1 text-primaire hover:underline">
                    <Phone className="h-3.5 w-3.5" aria-hidden /> {d.telephone}
                  </a>
                </Info>
                <Info libelle="E-mail">
                  {d.email && (
                    <a href={`mailto:${d.email}`} className="inline-flex items-center gap-1 text-primaire hover:underline">
                      <Mail className="h-3.5 w-3.5" aria-hidden /> {d.email}
                    </a>
                  )}
                </Info>
                <Info libelle="Type de demande">{LABELS_TYPE_DEMANDE[d.type] ?? d.type}</Info>
                <Info libelle="Accord de traitement des données">{dateHeure(d.consentementLe)}</Info>
              </dl>
            </CardBody>
          </Card>

          {jeune && (
            <Card>
              <CardHeader titre="Jeune concerné" />
              <CardBody>
                <dl className="grid gap-4 sm:grid-cols-2">
                  <Info libelle="Nom">{d.nomJeune}</Info>
                  <Info libelle="Prénom">{d.prenomJeune}</Info>
                  <Info libelle="Date de naissance">{d.dateNaissanceJeune ? dateCourte(d.dateNaissanceJeune) : null}</Info>
                  <Info libelle="Branche souhaitée">{d.brancheSouhaitee ? (LABELS_BRANCHES[d.brancheSouhaitee] ?? d.brancheSouhaitee) : null}</Info>
                </dl>
              </CardBody>
            </Card>
          )}

          <Card>
            <CardHeader titre="Message" />
            <CardBody>
              {d.message ? (
                <p className="text-sm whitespace-pre-line text-stone-800">{d.message}</p>
              ) : (
                <p className="text-sm text-stone-400">Aucun message.</p>
              )}
            </CardBody>
          </Card>
        </div>

        <FormulaireTraitement key={d.updatedAt} demande={d} />
      </div>
    </div>
  )
}

function FormulaireTraitement({ demande }: { demande: Demande }) {
  const client = useQueryClient()
  const [statut, setStatut] = useState(demande.statut)
  const [notes, setNotes] = useState(demande.notesInternes ?? '')
  const [erreurServeur, setErreurServeur] = useState<string | null>(null)
  const notesTropLongues = notes.length > 4000

  const traitement = useMutation({
    mutationFn: (corps: { statut?: string; notesInternes?: string | null }) =>
      api<Demande>(`/api/admin/demandes/${demande.id}`, { method: 'PATCH', json: corps }),
    onSuccess: () => {
      toast.success('Demande mise à jour.')
      client.invalidateQueries({ queryKey: ['admin', 'demandes'] })
    },
    onError: (e) => setErreurServeur(messageErreur(e)),
  })

  const corps: { statut?: string; notesInternes?: string | null } = {}
  if (statut !== demande.statut) corps.statut = statut
  if (texteOuNull(notes) !== (demande.notesInternes ?? null)) corps.notesInternes = texteOuNull(notes)
  const modifie = Object.keys(corps).length > 0

  async function soumettre(e: React.FormEvent) {
    e.preventDefault()
    setErreurServeur(null)
    if (notesTropLongues || !modifie) return
    if (corps.statut === 'REFUSEE' || corps.statut === 'ARCHIVEE') {
      const ok = await confirmer({
        titre: corps.statut === 'REFUSEE' ? 'Refuser cette demande ?' : 'Archiver cette demande ?',
        description:
          corps.statut === 'REFUSEE'
            ? 'La demande sera marquée « Refusée ». Aucun message n’est envoyé automatiquement : pensez à informer la famille ou la personne.'
            : 'La demande sera archivée et n’apparaîtra plus dans la liste par défaut (filtre « Archivée » pour la retrouver).',
        labelConfirmer: corps.statut === 'REFUSEE' ? 'Refuser' : 'Archiver',
        danger: corps.statut === 'REFUSEE',
      })
      if (!ok) return
    }
    traitement.mutate(corps)
  }

  return (
    <Card className="h-fit lg:sticky lg:top-4">
      <CardHeader titre="Traitement" description="Visible uniquement par l'équipe de gestion." />
      <CardBody>
        <form onSubmit={soumettre} noValidate className="space-y-4">
          {erreurServeur && <Alert niveau="critique">{erreurServeur}</Alert>}
          <Field label="Statut">
            {(p) => <Select {...p} options={OPTIONS_STATUT} value={statut} onChange={(e) => setStatut(e.target.value)} />}
          </Field>
          <Field
            label="Notes internes"
            erreur={notesTropLongues ? '4 000 caractères au maximum.' : null}
            aide={`${notes.length.toLocaleString('fr-FR')} / 4 000 caractères. N'y consignez aucune donnée de santé.`}
          >
            {(p) => <Textarea {...p} rows={6} value={notes} onChange={(e) => setNotes(e.target.value)} />}
          </Field>
          <Button type="submit" className="w-full" chargement={traitement.isPending} disabled={!modifie || notesTropLongues}>
            Enregistrer
          </Button>
          <dl className="space-y-2 border-t border-stone-100 pt-4 text-sm">
            <div>
              <dt className="text-xs text-stone-500">Dernier changement de statut</dt>
              <dd className="text-stone-800">{demande.traiteeLe ? dateHeure(demande.traiteeLe) : 'Pas encore traitée'}</dd>
            </div>
            <div>
              <dt className="text-xs text-stone-500">Par</dt>
              <dd className="text-stone-800">{demande.traiteePar ? `${demande.traiteePar.prenom} ${demande.traiteePar.nom}` : '—'}</dd>
            </div>
          </dl>
        </form>
      </CardBody>
    </Card>
  )
}
