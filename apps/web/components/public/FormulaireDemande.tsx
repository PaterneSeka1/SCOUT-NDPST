'use client'

import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import { LABELS_BRANCHES, ORDRE_BRANCHES } from '@scout/shared'
import { api, ErreurApi } from '@/lib/api'
import { Alert, Button, Checkbox, Field, Input, Select, Textarea } from '@/components/ui'
import { CheckCircle2, Send } from '@/lib/icons'
import type { Parcours, TypeDemande } from './parcours'

interface Valeurs {
  type: TypeDemande
  prenomContact: string
  nomContact: string
  telephone: string
  email: string
  prenomJeune: string
  nomJeune: string
  dateNaissanceJeune: string
  brancheSouhaitee: string
  message: string
  consentement: boolean
  siteWeb: string
}

type Erreurs = Partial<Record<keyof Valeurs, string>>

const TELEPHONE = /^\+?[0-9 .-]{8,20}$/
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

// Branches proposées à l'inscription d'un jeune (pas les adultes).
const BRANCHES_JEUNES = ORDRE_BRANCHES.filter((b) => b !== 'RESSOURCES_ADULTES')

function valider(v: Valeurs): Erreurs {
  const e: Erreurs = {}
  if (!v.prenomContact.trim()) e.prenomContact = 'Indiquez votre prénom.'
  if (!v.nomContact.trim()) e.nomContact = 'Indiquez votre nom.'
  if (!TELEPHONE.test(v.telephone.trim())) e.telephone = 'Indiquez un numéro de téléphone valide (8 chiffres au moins).'
  if (v.email.trim() && !EMAIL.test(v.email.trim())) e.email = 'Adresse e-mail invalide.'
  if (v.type === 'INSCRIPTION_JEUNE') {
    if (!v.prenomJeune.trim()) e.prenomJeune = 'Indiquez le prénom du jeune.'
    if (!v.nomJeune.trim()) e.nomJeune = 'Indiquez le nom du jeune.'
    if (!/^\d{4}-\d{2}-\d{2}$/.test(v.dateNaissanceJeune) || new Date(v.dateNaissanceJeune).getTime() >= Date.now()) {
      e.dateNaissanceJeune = 'Indiquez une date de naissance valide.'
    }
  }
  if (v.type === 'INFORMATION' && !v.message.trim()) e.message = 'Écrivez votre message.'
  if (!v.consentement) e.consentement = 'Votre accord est nécessaire pour que nous puissions vous répondre.'
  return e
}

/**
 * Formulaire public « Nous rejoindre » → POST /api/public/demandes, pour un
 * parcours choisi sur la page (inscription, engagement, information,
 * contact). Aucune donnée de santé, aucun compte créé ; anti-spam par champ
 * piège (siteWeb) et horodatage d'ouverture (ouvertLe).
 */
export function FormulaireDemande({ parcours }: { parcours: Parcours }) {
  const [valeurs, setValeurs] = useState<Valeurs>({
    type: parcours.type,
    prenomContact: '',
    nomContact: '',
    telephone: '',
    email: '',
    prenomJeune: '',
    nomJeune: '',
    dateNaissanceJeune: '',
    brancheSouhaitee: '',
    message: '',
    consentement: false,
    siteWeb: '',
  })
  const [erreurs, setErreurs] = useState<Erreurs>({})
  const [erreurServeur, setErreurServeur] = useState<string | null>(null)
  const [envoi, setEnvoi] = useState(false)
  const [recue, setRecue] = useState(false)
  const ouvertLe = useRef<number | null>(null)
  const resume = useRef<HTMLDivElement>(null)
  const confirmation = useRef<HTMLDivElement>(null)

  // Horodatage d'ouverture (anti-robot), fixé au montage côté navigateur.
  useEffect(() => {
    ouvertLe.current = Date.now()
  }, [])

  useEffect(() => {
    if (recue) confirmation.current?.focus()
  }, [recue])

  const maj = <K extends keyof Valeurs>(cle: K, valeur: Valeurs[K]) => {
    setValeurs((v) => ({ ...v, [cle]: valeur }))
    if (erreurs[cle]) setErreurs((e) => ({ ...e, [cle]: undefined }))
  }

  const jeune = valeurs.type === 'INSCRIPTION_JEUNE'

  async function soumettre(e: React.FormEvent) {
    e.preventDefault()
    setErreurServeur(null)
    const trouvees = valider(valeurs)
    setErreurs(trouvees)
    if (Object.keys(trouvees).length > 0) {
      requestAnimationFrame(() => resume.current?.focus())
      return
    }
    setEnvoi(true)
    try {
      await api('/api/public/demandes', {
        method: 'POST',
        json: {
          type: valeurs.type,
          prenomContact: valeurs.prenomContact.trim(),
          nomContact: valeurs.nomContact.trim(),
          telephone: valeurs.telephone.trim(),
          email: valeurs.email.trim() || null,
          ...(jeune
            ? {
                prenomJeune: valeurs.prenomJeune.trim(),
                nomJeune: valeurs.nomJeune.trim(),
                dateNaissanceJeune: valeurs.dateNaissanceJeune,
                brancheSouhaitee: valeurs.brancheSouhaitee || null,
              }
            : {}),
          message: valeurs.message.trim() || null,
          consentement: true,
          siteWeb: valeurs.siteWeb,
          ouvertLe: ouvertLe.current ?? undefined,
        },
      })
      setRecue(true)
    } catch (erreur) {
      if (erreur instanceof ErreurApi && erreur.statut === 429) {
        setErreurServeur('Trop de demandes ont été envoyées depuis votre connexion. Réessayez plus tard ou contactez-nous directement.')
      } else if (erreur instanceof ErreurApi && erreur.statut === 403) {
        setErreurServeur(
          'Les inscriptions sont actuellement fermées. Vous pouvez choisir « Demande d’information » pour être tenu informé de leur réouverture.',
        )
      } else {
        setErreurServeur(erreur instanceof ErreurApi ? erreur.message : 'Envoi impossible. Vérifiez votre connexion puis réessayez.')
      }
    } finally {
      setEnvoi(false)
    }
  }

  if (recue) {
    return (
      <div
        ref={confirmation}
        tabIndex={-1}
        role="status"
        className="rounded-lg border border-ligne bg-white p-8 text-center focus:outline-none"
      >
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-foret-50 text-foret-600">
          <CheckCircle2 className="h-7 w-7" aria-hidden />
        </div>
        <h2 className="titre-display mt-4 text-2xl font-semibold text-encre">Votre demande a bien été reçue</h2>
        <p className="mx-auto mt-3 max-w-md leading-relaxed text-stone-600">
          Votre demande a bien été reçue et sera examinée par la direction du groupe, qui vous recontactera par téléphone
          {valeurs.email.trim() ? ' ou par e-mail' : ''}. Aucun compte n&apos;est créé à cette étape.
        </p>
        <Link href="/" className="mt-6 inline-flex font-semibold text-primaire underline-offset-4 hover:underline">
          Retour à l&apos;accueil
        </Link>
      </div>
    )
  }

  const listeErreurs = Object.entries(erreurs).filter(([, m]) => m) as [keyof Valeurs, string][]

  return (
    <form noValidate onSubmit={soumettre} className="space-y-7 rounded-lg border border-ligne bg-white p-5 sm:p-8">
      {listeErreurs.length > 0 && (
        <div ref={resume} tabIndex={-1} className="focus:outline-none">
          <Alert niveau="critique" titre="Le formulaire contient des erreurs">
            <ul className="mt-1 list-disc pl-5">
              {listeErreurs.map(([cle, message]) => (
                <li key={cle}>{message}</li>
              ))}
            </ul>
          </Alert>
        </div>
      )}
      {erreurServeur && <Alert niveau="critique">{erreurServeur}</Alert>}

      <fieldset className="space-y-4">
        <legend className="titre-display text-xl font-semibold text-encre">
          {jeune ? 'Vos coordonnées (parent ou tuteur)' : 'Vos coordonnées'}
        </legend>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Prénom" requis erreur={erreurs.prenomContact}>
            {(p) => <Input {...p} autoComplete="given-name" maxLength={100} value={valeurs.prenomContact} onChange={(e) => maj('prenomContact', e.target.value)} />}
          </Field>
          <Field label="Nom" requis erreur={erreurs.nomContact}>
            {(p) => <Input {...p} autoComplete="family-name" maxLength={100} value={valeurs.nomContact} onChange={(e) => maj('nomContact', e.target.value)} />}
          </Field>
          <Field label="Téléphone" requis erreur={erreurs.telephone} aide="Exemple : 07 00 00 00 00">
            {(p) => <Input {...p} type="tel" inputMode="tel" autoComplete="tel" maxLength={20} value={valeurs.telephone} onChange={(e) => maj('telephone', e.target.value)} />}
          </Field>
          <Field label="E-mail (facultatif)" erreur={erreurs.email}>
            {(p) => <Input {...p} type="email" autoComplete="email" maxLength={200} value={valeurs.email} onChange={(e) => maj('email', e.target.value)} />}
          </Field>
        </div>
      </fieldset>

      {jeune && (
        <fieldset className="space-y-4">
          <legend className="titre-display text-xl font-semibold text-encre">Le jeune à inscrire</legend>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Prénom du jeune" requis erreur={erreurs.prenomJeune}>
              {(p) => <Input {...p} autoComplete="off" maxLength={100} value={valeurs.prenomJeune} onChange={(e) => maj('prenomJeune', e.target.value)} />}
            </Field>
            <Field label="Nom du jeune" requis erreur={erreurs.nomJeune}>
              {(p) => <Input {...p} autoComplete="off" maxLength={100} value={valeurs.nomJeune} onChange={(e) => maj('nomJeune', e.target.value)} />}
            </Field>
            <Field label="Date de naissance" requis erreur={erreurs.dateNaissanceJeune}>
              {(p) => (
                <Input
                  {...p}
                  type="date"
                  max={new Date().toISOString().slice(0, 10)}
                  value={valeurs.dateNaissanceJeune}
                  onChange={(e) => maj('dateNaissanceJeune', e.target.value)}
                />
              )}
            </Field>
            <Field label="Branche souhaitée (facultatif)" aide="La direction confirmera la branche selon l’âge.">
              {(p) => (
                <Select
                  {...p}
                  vide="Je ne sais pas"
                  value={valeurs.brancheSouhaitee}
                  onChange={(e) => maj('brancheSouhaitee', e.target.value)}
                  options={BRANCHES_JEUNES.map((b) => ({ valeur: b, libelle: LABELS_BRANCHES[b] }))}
                />
              )}
            </Field>
          </div>
        </fieldset>
      )}

      <Field
        label={
          valeurs.type === 'INFORMATION'
            ? 'Votre message'
            : valeurs.type === 'ENGAGEMENT_ADULTE'
              ? 'Votre parcours et vos motivations (facultatif)'
              : 'Message (facultatif)'
        }
        requis={valeurs.type === 'INFORMATION'}
        erreur={erreurs.message}
        aide="N’indiquez aucune information médicale : elle vous sera demandée plus tard, si nécessaire, par un canal adapté."
      >
        {(p) => <Textarea {...p} rows={5} maxLength={2000} value={valeurs.message} onChange={(e) => maj('message', e.target.value)} />}
      </Field>

      {/* Champ piège anti-robot : invisible et ignoré par les humains. */}
      <div aria-hidden="true" className="absolute -left-[9999px] h-px w-px overflow-hidden">
        <label htmlFor="champ-site-web">Site web</label>
        <input
          id="champ-site-web"
          type="text"
          name="siteWeb"
          tabIndex={-1}
          autoComplete="off"
          value={valeurs.siteWeb}
          onChange={(e) => maj('siteWeb', e.target.value)}
        />
      </div>

      <div className="rounded-md bg-papier p-4 text-sm leading-relaxed text-encre-douce">
        <p>
          Les informations saisies servent uniquement à traiter votre demande. Elles sont consultées par la direction du groupe et ne
          sont jamais publiées. Pour en savoir plus et exercer vos droits, consultez notre{' '}
          <Link href="/confidentialite" className="font-medium text-primaire underline underline-offset-2">
            page sur les données personnelles
          </Link>
          .
        </p>
        <div className="mt-3">
          <Checkbox
            label="J’accepte que ces informations soient utilisées pour traiter ma demande."
            checked={valeurs.consentement}
            onChange={(e) => maj('consentement', e.target.checked)}
            aria-invalid={erreurs.consentement ? true : undefined}
            aria-errormessage={erreurs.consentement ? 'erreur-consentement' : undefined}
            required
          />
          {erreurs.consentement && (
            <p id="erreur-consentement" className="mt-1 pl-7 text-xs text-red-600">
              {erreurs.consentement}
            </p>
          )}
        </div>
      </div>

      <div className="flex flex-col-reverse items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-encre-pale">
          Les champs marqués d&apos;un astérisque (<span aria-hidden>*</span>
          <span className="sr-only">astérisque</span>) sont obligatoires.
        </p>
        <Button type="submit" variante="accent" taille="lg" icone={Send} chargement={envoi} className="w-full rounded-full sm:w-auto">
          {envoi ? 'Envoi en cours…' : 'Envoyer ma demande'}
        </Button>
      </div>
    </form>
  )
}
