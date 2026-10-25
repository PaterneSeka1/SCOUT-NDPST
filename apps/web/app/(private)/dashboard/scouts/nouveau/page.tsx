'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { brancheSelonAge, calculerAge, LABELS_BRANCHES, ORDRE_CATEGORIES_SCOUTS, ROLES_BRANCHE } from '@scout/shared'
import { rechercherDoublons, useCreerScout, type CorrespondanceDoublon } from '@/hooks/useScouts'
import { useEquipes } from '@/hooks/useEquipes'
import { useMaBranche } from '@/hooks/useBranches'
import { useSession } from '@/lib/session-client'
import { dateCourte } from '@/lib/format'
import { Plus, Trash2 } from '@/lib/icons'
import {
  Alert,
  Button,
  ButtonLink,
  Card,
  CardBody,
  CardHeader,
  Checkbox,
  Field,
  FileUpload,
  Input,
  PageHeader,
  Select,
  Textarea,
} from '@/components/ui'

interface ContactForm {
  nom: string
  prenom: string
  telephone: string
  relation: string
  principal: boolean
}

type Erreurs = Partial<Record<'nom' | 'prenom' | 'dateNaissance' | 'sexe' | 'brancheType' | 'contacts', string>> & {
  contactsItems?: { nom?: string; telephone?: string }[]
}

const RELATIONS = ['Père', 'Mère', 'Tuteur', 'Tutrice', 'Autre'].map((r) => ({ valeur: r, libelle: r }))
const OPTIONS_BRANCHES = ORDRE_CATEGORIES_SCOUTS.map((b) => ({ valeur: b, libelle: LABELS_BRANCHES[b] }))
const OPTIONS_SEXE = [
  { valeur: 'MASCULIN', libelle: 'Garçon' },
  { valeur: 'FEMININ', libelle: 'Fille' },
]
const contactVide = (): ContactForm => ({ nom: '', prenom: '', telephone: '', relation: '', principal: true })

export default function PageNouveauScout() {
  const router = useRouter()
  const creer = useCreerScout()
  const { data: session } = useSession()
  const estRoleBranche = ROLES_BRANCHE.includes(session?.user.role ?? '')
  // L'encadrement de branche n'inscrit que dans sa branche (imposé par l'API).
  const maBranche = useMaBranche(estRoleBranche)
  const brancheImposee = estRoleBranche ? (maBranche.data?.brancheType ?? null) : null

  const [nom, setNom] = useState('')
  const [prenom, setPrenom] = useState('')
  const [dateNaissance, setDateNaissance] = useState('')
  const [sexe, setSexe] = useState('')
  const [brancheChoisie, setBrancheChoisie] = useState('')
  const [brancheTouchee, setBrancheTouchee] = useState(false)
  const [equipeId, setEquipeId] = useState('')
  const [photo, setPhoto] = useState<string | null>(null)
  const [allergies, setAllergies] = useState('')
  const [traitements, setTraitements] = useState('')
  const [contacts, setContacts] = useState<ContactForm[]>([contactVide()])
  const [erreurs, setErreurs] = useState<Erreurs>({})
  const [verification, setVerification] = useState(false)
  // Doublons trouvés pour l'identité saisie ; `confirme` vaut true quand
  // l'utilisateur a choisi d'inscrire malgré l'avertissement.
  const [doublons, setDoublons] = useState<{ cle: string; liste: CorrespondanceDoublon[]; confirme: boolean } | null>(null)

  const brancheType = brancheImposee ?? brancheChoisie
  const equipes = useEquipes({ brancheType: brancheType || undefined, actif: true }, Boolean(brancheType))

  const cleIdentite = `${nom.trim().toLowerCase()}|${prenom.trim().toLowerCase()}|${dateNaissance}`

  function modifierContact(index: number, champ: keyof ContactForm, valeur: string | boolean) {
    setContacts((liste) =>
      liste.map((c, i) => {
        if (i !== index) return champ === 'principal' && valeur === true ? { ...c, principal: false } : c
        return { ...c, [champ]: valeur }
      }),
    )
  }

  function valider(): boolean {
    const e: Erreurs = {}
    if (!nom.trim()) e.nom = 'Le nom est requis.'
    if (!prenom.trim()) e.prenom = 'Le prénom est requis.'
    if (!dateNaissance) e.dateNaissance = 'La date de naissance est requise.'
    if (!sexe) e.sexe = 'Le sexe est requis.'
    if (!brancheType) e.brancheType = 'La branche est requise.'
    if (contacts.length === 0) e.contacts = "Au moins un contact d'urgence est requis."
    const items = contacts.map((c) => ({
      nom: c.nom.trim() ? undefined : 'Le nom est requis.',
      telephone: c.telephone.trim() ? undefined : 'Le téléphone est requis.',
    }))
    if (items.some((i) => i.nom || i.telephone)) e.contactsItems = items
    setErreurs(e)
    return Object.keys(e).length === 0
  }

  async function soumettre(ev: React.FormEvent) {
    ev.preventDefault()
    if (!valider()) {
      toast.error('Vérifiez les champs signalés.')
      return
    }

    // Détection de doublons avant enregistrement : avertissement non bloquant.
    if (!doublons || doublons.cle !== cleIdentite || !doublons.confirme) {
      setVerification(true)
      try {
        const { correspondances } = await rechercherDoublons({ nom: nom.trim(), prenom: prenom.trim(), dateNaissance })
        if (correspondances.length > 0) {
          setDoublons({ cle: cleIdentite, liste: correspondances, confirme: false })
          return
        }
      } catch (e) {
        // La vérification est un confort : son échec ne bloque pas l'inscription.
        toast.warning(e instanceof Error ? `Vérification des doublons impossible : ${e.message}` : 'Vérification des doublons impossible.')
      } finally {
        setVerification(false)
      }
    }

    try {
      const scout = await creer.mutateAsync({
        nom: nom.trim(),
        prenom: prenom.trim(),
        dateNaissance,
        sexe,
        brancheType,
        photo,
        allergies: allergies.trim() || null,
        traitementsMedicaux: traitements.trim() || null,
        equipeId: equipeId || null,
        contactsUrgence: contacts.map((c) => ({
          nom: c.nom.trim(),
          prenom: c.prenom.trim() || undefined,
          telephone: c.telephone.trim(),
          relation: c.relation || undefined,
          principal: c.principal,
        })),
      })
      toast.success(`${scout.prenom} ${scout.nom} est inscrit(e).`)
      router.push(`/dashboard/scouts/${scout.id}`)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "L'inscription a échoué.")
    }
  }

  const doublonsAffiches = doublons && doublons.cle === cleIdentite && doublons.liste.length > 0 ? doublons : null

  return (
    <div className="space-y-6">
      <PageHeader
        titre="Inscrire un scout"
        description="Les champs marqués d'un astérisque sont obligatoires."
        miettes={[
          { libelle: 'Tableau de bord', href: '/dashboard' },
          { libelle: 'Scouts', href: '/dashboard/scouts' },
          { libelle: 'Inscription' },
        ]}
      />

      <form onSubmit={soumettre} noValidate className="space-y-6">
        <Card>
          <CardHeader titre="Identité" />
          <CardBody className="grid gap-4 sm:grid-cols-2">
            <Field label="Nom" requis erreur={erreurs.nom}>
              {(p) => <Input {...p} value={nom} onChange={(e) => setNom(e.target.value)} autoComplete="off" />}
            </Field>
            <Field label="Prénom" requis erreur={erreurs.prenom}>
              {(p) => <Input {...p} value={prenom} onChange={(e) => setPrenom(e.target.value)} autoComplete="off" />}
            </Field>
            <Field label="Date de naissance" requis erreur={erreurs.dateNaissance}>
              {(p) => (
                <Input
                  {...p}
                  type="date"
                  value={dateNaissance}
                  onChange={(e) => {
                    const valeur = e.target.value
                    setDateNaissance(valeur)
                    setErreurs((p) => ({ ...p, dateNaissance: undefined }))
                    if (brancheTouchee || brancheImposee) return
                    if (!valeur) {
                      setBrancheChoisie('')
                      setEquipeId('')
                      return
                    }

                    const naissance = new Date(`${valeur}T00:00:00`)
                    const suggestion = Number.isNaN(naissance.getTime())
                      ? null
                      : brancheSelonAge(calculerAge(naissance, new Date()))
                    setBrancheChoisie(suggestion ?? '')
                    if (suggestion) setErreurs((p) => ({ ...p, brancheType: undefined }))
                    setEquipeId('')
                  }}
                />
              )}
            </Field>
            <Field label="Sexe" requis erreur={erreurs.sexe}>
              {(p) => <Select {...p} value={sexe} onChange={(e) => setSexe(e.target.value)} vide="Sélectionner" options={OPTIONS_SEXE} />}
            </Field>
            <Field
              label="Branche"
              requis
              erreur={erreurs.brancheType}
              aide={
                estRoleBranche
                  ? 'Inscription limitée à votre branche.'
                  : !brancheTouchee && brancheChoisie
                    ? 'Suggérée à partir de la date de naissance — modifiable si besoin.'
                    : undefined
              }
            >
              {(p) => (
                <Select
                  {...p}
                  value={brancheType}
                  disabled={estRoleBranche}
                  onChange={(e) => {
                    setBrancheChoisie(e.target.value)
                    setBrancheTouchee(true)
                    setEquipeId('')
                  }}
                  vide="Sélectionner une branche"
                  options={OPTIONS_BRANCHES}
                />
              )}
            </Field>
            <Field
              label="Équipe"
              aide={
                !brancheType
                  ? 'Choisissez d’abord la branche.'
                  : equipes.data?.length === 0
                    ? 'Aucune équipe active dans cette branche.'
                    : 'Facultative.'
              }
            >
              {(p) => (
                <Select
                  {...p}
                  value={equipeId}
                  disabled={!brancheType || equipes.isLoading}
                  onChange={(e) => setEquipeId(e.target.value)}
                  vide="Aucune équipe"
                  options={(equipes.data ?? []).map((eq) => ({ valeur: eq.id, libelle: eq.nom }))}
                />
              )}
            </Field>
            <div className="sm:col-span-2">
              <FileUpload label="Photo" aide="Facultative. JPEG, PNG ou WebP, 5 Mo maximum." valeur={photo} onChange={setPhoto} visibilite="privee" />
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardHeader titre="Informations médicales" description="À connaître en cas d'urgence (activité, camp)." />
          <CardBody className="grid gap-4 sm:grid-cols-2">
            <Field label="Allergies">
              {(p) => <Textarea {...p} rows={2} value={allergies} onChange={(e) => setAllergies(e.target.value)} placeholder="Ex. : arachides, pénicilline…" />}
            </Field>
            <Field label="Traitements en cours">
              {(p) => <Textarea {...p} rows={2} value={traitements} onChange={(e) => setTraitements(e.target.value)} />}
            </Field>
          </CardBody>
        </Card>

        <Card>
          <CardHeader
            titre="Contacts d'urgence"
            description="Au moins un contact est obligatoire."
            actions={
              <Button variante="secondaire" taille="sm" icone={Plus} onClick={() => setContacts((l) => [...l, { ...contactVide(), principal: false }])}>
                Ajouter un contact
              </Button>
            }
          />
          <CardBody className="space-y-4">
            {erreurs.contacts && <Alert niveau="critique">{erreurs.contacts}</Alert>}
            {contacts.map((c, i) => (
              <fieldset key={i} className="space-y-3 rounded-lg border border-stone-200 p-4">
                <div className="flex items-center justify-between">
                  <legend className="text-xs font-semibold tracking-wide text-stone-600 uppercase">Contact {i + 1}</legend>
                  {contacts.length > 1 && (
                    <Button
                      variante="fantome"
                      taille="sm"
                      icone={Trash2}
                      onClick={() => setContacts((l) => l.filter((_, j) => j !== i))}
                      aria-label={`Retirer le contact ${i + 1}`}
                    >
                      Retirer
                    </Button>
                  )}
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="Nom" requis erreur={erreurs.contactsItems?.[i]?.nom}>
                    {(p) => <Input {...p} value={c.nom} onChange={(e) => modifierContact(i, 'nom', e.target.value)} />}
                  </Field>
                  <Field label="Prénom">
                    {(p) => <Input {...p} value={c.prenom} onChange={(e) => modifierContact(i, 'prenom', e.target.value)} />}
                  </Field>
                  <Field label="Téléphone" requis erreur={erreurs.contactsItems?.[i]?.telephone}>
                    {(p) => <Input {...p} type="tel" value={c.telephone} onChange={(e) => modifierContact(i, 'telephone', e.target.value)} />}
                  </Field>
                  <Field label="Relation">
                    {(p) => (
                      <Select {...p} value={c.relation} onChange={(e) => modifierContact(i, 'relation', e.target.value)} vide="Sélectionner" options={RELATIONS} />
                    )}
                  </Field>
                </div>
                <Checkbox label="Contact principal" checked={c.principal} onChange={(e) => modifierContact(i, 'principal', e.target.checked)} />
              </fieldset>
            ))}
          </CardBody>
        </Card>

        {doublonsAffiches && (
          <Alert niveau="attention" titre="Des fiches proches existent déjà">
            <p>Vérifiez qu&apos;il ne s&apos;agit pas du même enfant avant de poursuivre :</p>
            <ul className="mt-2 list-disc space-y-1 pl-5">
              {doublonsAffiches.liste.map((d) => (
                <li key={d.id}>
                  <Link href={`/dashboard/scouts/${d.id}`} target="_blank" className="font-medium underline">
                    {d.prenom} {d.nom}
                  </Link>{' '}
                  — {LABELS_BRANCHES[d.brancheType] ?? d.brancheType}, né(e) le {dateCourte(d.dateNaissance)}
                  {!d.actif && ' (inactif)'}
                </li>
              ))}
            </ul>
            {!doublonsAffiches.confirme && (
              <div className="mt-3">
                <Button
                  taille="sm"
                  variante="secondaire"
                  onClick={() => setDoublons({ ...doublonsAffiches, confirme: true })}
                >
                  Il s&apos;agit d&apos;un autre enfant : autoriser l&apos;inscription
                </Button>
              </div>
            )}
            {doublonsAffiches.confirme && <p className="mt-2 font-medium">Inscription autorisée : cliquez sur « Inscrire le scout ».</p>}
          </Alert>
        )}

        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <ButtonLink href="/dashboard/scouts" variante="secondaire">
            Annuler
          </ButtonLink>
          <Button type="submit" chargement={verification || creer.isPending}>
            Inscrire le scout
          </Button>
        </div>
      </form>
    </div>
  )
}
