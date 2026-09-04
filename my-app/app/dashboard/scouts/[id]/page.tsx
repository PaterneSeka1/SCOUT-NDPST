'use client'

import { useState } from 'react'
import { useParams } from 'next/navigation'
import { useSession } from 'next-auth/react'
import Link from 'next/link'
import { toast } from 'sonner'
import { useScout, useAttribuerMatricule, useAjouterContact, useSupprimerContact, useCreerCompteScout, useAjouterDocument, useSupprimerDocument, type DocumentScout } from '@/hooks/useScouts'
import { useProgressionsScout, useValiderBadge } from '@/hooks/useProgressions'
import { LABELS_BRANCHES, COULEURS_BRANCHES } from '@/lib/branches'
import { LABELS_TYPE_DOCUMENT } from '@/lib/documents'
import { ICONES_TYPE_DOCUMENT, Camera, AlertTriangle, Check, Paperclip, ArrowRight } from '@/lib/icons'
import { LABELS_TYPE_COTISATION, LABELS_STATUT_COTISATION, COULEURS_STATUT_COTISATION, formatMontantFCFA } from '@/lib/cotisations'
import { ROLES_BRANCHE } from '@/lib/roles'
import { PasswordInput } from '@/app/components/PasswordInput'
import { REGLE_MOT_DE_PASSE } from '@/lib/password'
import { confirmer } from '@/app/components/ConfirmDialog'
import { BackLink } from '@/app/components/ui/BackLink'

export default function FicheScoutPage() {
  const { id } = useParams<{ id: string }>()
  const { data: session } = useSession()
  const { data: scout, isLoading, isError } = useScout(id)
  const { data: progressions } = useProgressionsScout(id)

  const { mutateAsync: attribuerMatricule, isPending: matriculeEnCours } = useAttribuerMatricule(id)
  const { mutateAsync: ajouterContact, isPending: contactEnCours } = useAjouterContact(id)
  const { mutateAsync: supprimerContact } = useSupprimerContact(id)
  const { mutateAsync: creerCompte, isPending: compteEnCours } = useCreerCompteScout(id)
  const { mutateAsync: ajouterDocument } = useAjouterDocument(id)
  const { mutateAsync: supprimerDocument } = useSupprimerDocument(id)
  const { mutateAsync: validerBadge, isPending: validationEnCours } = useValiderBadge(id)
  const [badgeEnCours, setBadgeEnCours] = useState<string | null>(null)

  const peutValiderBadges = Boolean(session?.user?.role && ROLES_BRANCHE.includes(session.user.role))

  const handleValiderBadge = async (badgeId: string) => {
    setBadgeEnCours(badgeId)
    try {
      await validerBadge({ badgeId })
      toast.success('Badge validé.')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erreur')
    } finally {
      setBadgeEnCours(null)
    }
  }

  const [typeDocument, setTypeDocument] = useState('CERTIFICAT_MEDICAL')
  const [dateExpirationDocument, setDateExpirationDocument] = useState('')
  const [uploadDocumentEnCours, setUploadDocumentEnCours] = useState(false)

  const changerTypeDocument = (type: string) => {
    setTypeDocument(type)
    // Suggestion par défaut pour une fiche médicale : valable 1 an.
    if (type === 'CERTIFICAT_MEDICAL' && !dateExpirationDocument) {
      const dans1An = new Date()
      dans1An.setFullYear(dans1An.getFullYear() + 1)
      setDateExpirationDocument(dans1An.toISOString().slice(0, 10))
    }
  }

  const [afficherFormulaireMatricule, setAfficherFormulaireMatricule] = useState(false)
  const [nouveauMatricule, setNouveauMatricule] = useState('')

  const [afficherFormulaireContact, setAfficherFormulaireContact] = useState(false)
  const [nouveauContact, setNouveauContact] = useState({ nom: '', prenom: '', telephone: '', relation: '', principal: false })

  const [afficherFormulaireCompte, setAfficherFormulaireCompte] = useState(false)
  const [passwordCompte, setPasswordCompte] = useState('')
  const [telephoneCompte, setTelephoneCompte] = useState('')
  const [referenceDate] = useState(() => Date.now())

  if (isLoading) return (
    <div className="flex items-center justify-center h-48">
      <div className="w-6 h-6 border-2 border-[var(--cp)] border-t-transparent rounded-full animate-spin" />
    </div>
  )

  if (isError || !scout) return (
    <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md">
      Scout introuvable.
    </div>
  )

  const age = Math.floor((referenceDate - new Date(scout.dateNaissance).getTime()) / (1000 * 60 * 60 * 24 * 365))

  const handleAttribuerMatricule = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      await attribuerMatricule(nouveauMatricule.trim())
      toast.success('Matricule enregistré.')
      setAfficherFormulaireMatricule(false)
      setNouveauMatricule('')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erreur')
    }
  }

  const handleAjouterContact = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      await ajouterContact(nouveauContact)
      toast.success('Contact ajouté.')
      setAfficherFormulaireContact(false)
      setNouveauContact({ nom: '', prenom: '', telephone: '', relation: '', principal: false })
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erreur')
    }
  }

  const handleSupprimerContact = async (contactId: string) => {
    try {
      await supprimerContact(contactId)
      toast.success('Contact supprimé.')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erreur')
    }
  }

  const handleUploadDocument = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const fichier = e.target.files?.[0]
    if (!fichier) return
    setUploadDocumentEnCours(true)
    try {
      const fd = new FormData()
      fd.append('fichier', fichier)
      const res = await fetch('/api/upload', { method: 'POST', body: fd })
      const data = await res.json()
      if (!res.ok) { toast.error(data.erreur ?? 'Erreur upload'); return }
      await ajouterDocument({
        type: typeDocument,
        nomFichier: fichier.name,
        url: data.url,
        dateExpiration: dateExpirationDocument || null,
      })
      toast.success('Document ajouté.')
      setDateExpirationDocument('')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur lors de l'envoi du document")
    } finally {
      setUploadDocumentEnCours(false)
      e.target.value = ''
    }
  }

  const handleSupprimerDocument = async (doc: DocumentScout) => {
    const ok = await confirmer({
      titre: 'Supprimer ce document ?',
      description: `Le document "${LABELS_TYPE_DOCUMENT[doc.type] ?? doc.type}" (${doc.nomFichier}) sera définitivement supprimé de la fiche de ${scout.prenom} ${scout.nom}. Cette action est irréversible.`,
      labelConfirmer: 'Supprimer',
      danger: true,
    })
    if (!ok) return
    try {
      await supprimerDocument(doc.id)
      toast.success('Document supprimé.')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erreur')
    }
  }

  const handleCreerCompte = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      await creerCompte({ password: passwordCompte, telephone: telephoneCompte || undefined })
      toast.success('Compte créé avec succès.')
      setAfficherFormulaireCompte(false)
      setPasswordCompte('')
      setTelephoneCompte('')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erreur')
    }
  }

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      {/* En-tête */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <BackLink href="/dashboard/scouts">Retour à la liste</BackLink>
        <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
          <Link
            href={`/dashboard/scouts/${id}/carte`}
            className="inline-flex items-center justify-center border border-gray-300 text-gray-700 px-4 py-2 rounded-md text-sm hover:bg-gray-50 transition-colors"
          >
            Carte QR
          </Link>
          <Link
            href={`/dashboard/scouts/${id}/modifier`}
            className="inline-flex items-center justify-center bg-[var(--cp)] text-white px-4 py-2 rounded-md text-sm hover:brightness-110 transition-all"
          >
            Modifier
          </Link>
        </div>
      </div>

      {/* Infos principales */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="flex items-start gap-4">
          <div className="w-16 h-16 rounded-full bg-[var(--cp)]/10 flex items-center justify-center text-2xl font-bold text-[var(--cp)]">
            {scout.nom[0]}{scout.prenom[0]}
          </div>
          <div className="flex-1">
            <h1 className="text-2xl font-bold text-gray-900">{scout.prenom} {scout.nom}</h1>
            <div className="flex flex-wrap items-center gap-2 mt-2">
              <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${COULEURS_BRANCHES[scout.brancheType] ?? 'bg-gray-100 text-gray-700'}`}>
                {LABELS_BRANCHES[scout.brancheType] ?? scout.brancheType}
              </span>
              <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${scout.actif ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-500'}`}>
                {scout.actif ? 'Actif' : 'Inactif'}
              </span>
              <span className="text-sm text-gray-500">{age} ans — {scout.sexe === 'MASCULIN' ? 'Garçon' : 'Fille'}</span>
              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${scout.consentementImage ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-500'}`}>
                <Camera className="h-3 w-3" strokeWidth={2} />
                {scout.consentementImage ? "Droit à l'image autorisé" : "Droit à l'image non autorisé"}
              </span>
            </div>
            <p className="text-sm text-gray-500 mt-1">
              Né(e) le {new Date(scout.dateNaissance).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}
            </p>
          </div>
        </div>
      </div>

      {/* Informations médicales — mises en avant pour une lecture rapide en cas d'urgence */}
      {(scout.allergies || scout.traitementsMedicaux) && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 sm:p-6">
          <h2 className="text-base font-semibold text-amber-900 mb-2 flex items-center gap-2">
            <AlertTriangle className="h-4 w-4" strokeWidth={2} />
            Informations médicales
          </h2>
          {scout.allergies && (
            <p className="text-sm text-amber-800"><span className="font-medium">Allergies :</span> {scout.allergies}</p>
          )}
          {scout.traitementsMedicaux && (
            <p className="text-sm text-amber-800 mt-1"><span className="font-medium">Traitements en cours :</span> {scout.traitementsMedicaux}</p>
          )}
        </div>
      )}

      {/* Matricule */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h2 className="text-base font-semibold text-gray-900 mb-3">Matricule</h2>
        {scout.matricule ? (
          <div className="flex items-center gap-3">
            <span className="font-mono text-lg font-bold text-[var(--cp)] bg-[var(--cp)]/5 px-3 py-1 rounded">
              {scout.matricule}
            </span>
            <button onClick={() => setAfficherFormulaireMatricule(!afficherFormulaireMatricule)} className="text-sm text-gray-500 underline hover:text-gray-700">
              Modifier
            </button>
          </div>
        ) : (
          <p className="text-sm text-gray-500 mb-2">Aucun matricule attribué pour l&apos;instant.</p>
        )}

        {!scout.matricule && !afficherFormulaireMatricule && (
          <button
            onClick={() => setAfficherFormulaireMatricule(true)}
            className="mt-2 text-sm bg-[var(--cp)] text-white px-3 py-1.5 rounded-md hover:brightness-110 transition-all"
          >
            Attribuer un matricule
          </button>
        )}

        {afficherFormulaireMatricule && (
          <form onSubmit={handleAttribuerMatricule} className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-start">
            <div className="w-full sm:w-auto">
              <input
                type="text" value={nouveauMatricule} onChange={e => setNouveauMatricule(e.target.value)}
                placeholder="Ex : 0545247O" required
                className="w-full border border-gray-300 rounded-md px-3 py-1.5 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-[var(--cp)] sm:w-auto"
              />
            </div>
            <button type="submit" disabled={matriculeEnCours} className="bg-[var(--cp)] text-white px-3 py-1.5 rounded-md text-sm hover:brightness-110 transition-all disabled:opacity-60">
              {matriculeEnCours ? '…' : 'Enregistrer'}
            </button>
            <button type="button" onClick={() => setAfficherFormulaireMatricule(false)} className="text-sm text-gray-500 px-2 py-1.5 hover:text-gray-700">
              Annuler
            </button>
          </form>
        )}
      </div>

      {/* Compte utilisateur */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h2 className="text-base font-semibold text-gray-900 mb-3">Espace personnel</h2>

        {scout.utilisateur ? (
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1 bg-green-100 text-green-800 text-xs font-medium px-2 py-0.5 rounded-full">
              <Check className="h-3 w-3" strokeWidth={2.5} />
              Compte actif
            </span>
            <span className="text-sm text-gray-500">Matricule : {scout.utilisateur.matricule}</span>
          </div>
        ) : (
          <>
            {!scout.matricule ? (
              <p className="text-sm text-gray-500">Un matricule est requis avant de créer un compte.</p>
            ) : (
              <>
                <p className="text-sm text-gray-500 mb-2">Ce scout n&apos;a pas encore d&apos;espace personnel.</p>
                {!afficherFormulaireCompte && (
                  <button onClick={() => setAfficherFormulaireCompte(true)} className="text-sm bg-[var(--cp)] text-white px-3 py-1.5 rounded-md hover:brightness-110 transition-all">
                    Créer un compte
                  </button>
                )}
                {afficherFormulaireCompte && (
                  <form onSubmit={handleCreerCompte} className="space-y-3 mt-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">Mot de passe <span className="text-red-500">*</span></label>
                      <PasswordInput value={passwordCompte} onChange={e => setPasswordCompte(e.target.value)} required placeholder={REGLE_MOT_DE_PASSE}
                        className="border border-gray-300 rounded-md px-3 py-1.5 text-sm w-full focus:outline-none focus:ring-2 focus:ring-[var(--cp)]" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">Téléphone <span className="text-gray-400">(optionnel)</span></label>
                      <input type="tel" value={telephoneCompte} onChange={e => setTelephoneCompte(e.target.value)} placeholder="0712345678"
                        className="border border-gray-300 rounded-md px-3 py-1.5 text-sm w-full focus:outline-none focus:ring-2 focus:ring-[var(--cp)]" />
                    </div>
                    <div className="flex flex-col gap-2 sm:flex-row">
                      <button type="submit" disabled={compteEnCours} className="bg-[var(--cp)] text-white px-3 py-1.5 rounded-md text-sm hover:brightness-110 transition-all disabled:opacity-60">
                        {compteEnCours ? 'Création…' : 'Créer le compte'}
                      </button>
                      <button type="button" onClick={() => setAfficherFormulaireCompte(false)} className="text-sm text-gray-500 px-2 hover:text-gray-700">Annuler</button>
                    </div>
                  </form>
                )}
              </>
            )}
          </>
        )}
      </div>

      {/* Contacts d'urgence */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold text-gray-900">Contacts d&apos;urgence</h2>
          <button onClick={() => setAfficherFormulaireContact(!afficherFormulaireContact)} className="text-sm text-[var(--cp)] font-medium hover:underline">
            + Ajouter
          </button>
        </div>

        {scout.contactsUrgence.length === 0 && (
          <p className="text-sm text-gray-500">Aucun contact d&apos;urgence enregistré.</p>
        )}

        <ul className="space-y-3">
          {scout.contactsUrgence.map((contact) => (
            <li key={contact.id} className="flex items-start justify-between border border-gray-100 rounded-md p-3">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-gray-900">{contact.prenom} {contact.nom}</span>
                  {contact.principal && <span className="bg-[var(--cp)] text-white text-xs px-1.5 py-0.5 rounded">Principal</span>}
                  {contact.relation && <span className="text-xs text-gray-500">{contact.relation}</span>}
                </div>
                <p className="text-sm text-gray-600 mt-0.5">{contact.telephone}</p>
              </div>
              {scout.contactsUrgence.length > 1 && (
                <button
                  onClick={() => handleSupprimerContact(contact.id)}
                  className="text-xs text-red-500 hover:text-red-700 ml-2 mt-0.5"
                >
                  Supprimer
                </button>
              )}
            </li>
          ))}
        </ul>

        {afficherFormulaireContact && (
          <form onSubmit={handleAjouterContact} className="mt-4 border-t pt-4 space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Nom <span className="text-red-500">*</span></label>
                <input type="text" value={nouveauContact.nom} onChange={e => setNouveauContact(p => ({ ...p, nom: e.target.value }))} required
                  className="w-full border border-gray-300 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--cp)]" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Prénom</label>
                <input type="text" value={nouveauContact.prenom} onChange={e => setNouveauContact(p => ({ ...p, prenom: e.target.value }))}
                  className="w-full border border-gray-300 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--cp)]" />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Téléphone <span className="text-red-500">*</span></label>
                <input type="tel" value={nouveauContact.telephone} onChange={e => setNouveauContact(p => ({ ...p, telephone: e.target.value }))} required
                  className="w-full border border-gray-300 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--cp)]" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Relation</label>
                <select value={nouveauContact.relation} onChange={e => setNouveauContact(p => ({ ...p, relation: e.target.value }))}
                  className="w-full border border-gray-300 rounded-md px-3 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[var(--cp)]">
                  <option value="">Sélectionner</option>
                  <option>Père</option><option>Mère</option><option>Tuteur</option><option>Tutrice</option><option>Autre</option>
                </select>
              </div>
            </div>
            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input type="checkbox" checked={nouveauContact.principal} onChange={e => setNouveauContact(p => ({ ...p, principal: e.target.checked }))} />
              Contact principal
            </label>
            <div className="flex flex-col gap-2 sm:flex-row">
              <button type="submit" disabled={contactEnCours} className="bg-[var(--cp)] text-white px-3 py-1.5 rounded-md text-sm hover:brightness-110 transition-all disabled:opacity-60">
                {contactEnCours ? '…' : 'Ajouter'}
              </button>
              <button type="button" onClick={() => setAfficherFormulaireContact(false)} className="text-sm text-gray-500 px-2 hover:text-gray-700">Annuler</button>
            </div>
          </form>
        )}
      </div>

      {/* Cotisations */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-1">
          <h2 className="text-base font-semibold text-gray-900">Cotisations</h2>
          <Link href="/dashboard/cotisations" className="inline-flex items-center gap-1 text-xs hover:underline" style={{ color: 'var(--cp)' }}>
            Gérer les cotisations
            <ArrowRight className="h-3 w-3" strokeWidth={2} />
          </Link>
        </div>
        {scout.cotisations.length === 0 ? (
          <p className="text-sm text-gray-500">Aucune cotisation enregistrée.</p>
        ) : (
          <ul className="space-y-2">
            {scout.cotisations.map((c) => (
              <li key={c.id} className="flex items-center justify-between border border-gray-100 rounded-md p-3">
                <div className="min-w-0">
                  <p className="text-sm text-gray-900">
                    {LABELS_TYPE_COTISATION[c.type] ?? c.type}{c.libelle ? ` — ${c.libelle}` : ''}
                  </p>
                  <p className="text-xs text-gray-500 mt-0.5">{c.anneeScolaire} · {formatMontantFCFA(c.montant)}</p>
                </div>
                <span className={`flex-shrink-0 text-xs px-2 py-0.5 rounded-full ${COULEURS_STATUT_COTISATION[c.statut]}`}>
                  {LABELS_STATUT_COTISATION[c.statut] ?? c.statut}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Documents */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h2 className="text-base font-semibold text-gray-900 mb-1">Documents</h2>
        <p className="text-sm text-gray-500 mb-4">
          Fiche médicale, autorisation parentale… stockées une fois pour toutes, sans besoin de les redemander à chaque activité.
        </p>

        {scout.documents.length === 0 ? (
          <p className="text-sm text-gray-500 mb-3">Aucun document enregistré.</p>
        ) : (
          <ul className="space-y-2 mb-4">
            {scout.documents.map((doc) => (
              <li key={doc.id} className="flex items-center justify-between border border-gray-100 rounded-md p-3">
                <a href={doc.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 min-w-0 hover:underline">
                  {(() => {
                    const IconeDocument = ICONES_TYPE_DOCUMENT[doc.type] ?? Paperclip
                    return (
                      <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-gray-50 text-gray-500">
                        <IconeDocument className="h-4 w-4" strokeWidth={2} />
                      </span>
                    )
                  })()}
                  <span className="min-w-0">
                    <span className="block text-sm font-medium text-gray-900 truncate">{LABELS_TYPE_DOCUMENT[doc.type] ?? doc.type}</span>
                    <span className="block text-xs text-gray-500 truncate">{doc.nomFichier}</span>
                    {doc.dateExpiration && (
                      <span className={`block text-xs mt-0.5 ${new Date(doc.dateExpiration) < new Date() ? 'text-red-600 font-medium' : 'text-gray-400'}`}>
                        {new Date(doc.dateExpiration) < new Date() ? 'Expiré le ' : "Expire le "}
                        {new Date(doc.dateExpiration).toLocaleDateString('fr-FR')}
                      </span>
                    )}
                  </span>
                </a>
                <button onClick={() => handleSupprimerDocument(doc)} className="text-xs text-red-500 hover:text-red-700 ml-2 flex-shrink-0">
                  Supprimer
                </button>
              </li>
            ))}
          </ul>
        )}

        <div className="flex flex-col sm:flex-row gap-2 items-start sm:items-center border-t border-gray-100 pt-4">
          <select value={typeDocument} onChange={(e) => changerTypeDocument(e.target.value)}
            className="w-full border border-gray-300 rounded-md px-3 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[var(--cp)] sm:w-auto">
            {Object.entries(LABELS_TYPE_DOCUMENT).map(([val, label]) => (
              <option key={val} value={val}>{label}</option>
            ))}
          </select>
          <input
            type="date"
            value={dateExpirationDocument}
            onChange={(e) => setDateExpirationDocument(e.target.value)}
            title="Date d'expiration (optionnelle)"
            className="w-full border border-gray-300 rounded-md px-3 py-1.5 text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-[var(--cp)] sm:w-auto"
          />
          <label className="inline-flex w-full items-center justify-center text-sm bg-[var(--cp)] text-white px-3 py-1.5 rounded-md hover:brightness-110 transition-all cursor-pointer sm:w-auto">
            {uploadDocumentEnCours ? 'Envoi…' : '+ Ajouter un fichier'}
            <input type="file" accept="image/jpeg,image/png,image/webp,image/gif,application/pdf"
              onChange={handleUploadDocument} disabled={uploadDocumentEnCours} className="hidden" />
          </label>
        </div>
      </div>

      {/* Progression / Badges */}
      {progressions && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h2 className="text-base font-semibold text-gray-900 mb-1">Progression / Badges</h2>
          <p className="text-sm text-gray-500 mb-4">
            Parcours de badges de la branche {LABELS_BRANCHES[progressions.scout.brancheType] ?? progressions.scout.brancheType}.
          </p>

          {progressions.badges.length === 0 ? (
            <p className="text-sm text-gray-500">Aucun badge défini pour cette branche.</p>
          ) : (
            <ul className="space-y-2">
              {progressions.badges.map((badge) => (
                <li key={badge.id} className="flex items-center justify-between border border-gray-100 rounded-md p-3">
                  <div className="flex items-start gap-2 min-w-0">
                    {badge.valide && <span className="mt-1.5 w-2 h-2 rounded-full bg-green-500 flex-shrink-0" />}
                    <div className="min-w-0">
                      <span className="block text-sm font-medium text-gray-900 truncate">{badge.nom}</span>
                      {badge.description && <span className="block text-xs text-gray-500 truncate">{badge.description}</span>}
                      {badge.valide && (
                        <span className="block text-xs text-gray-400 mt-0.5">
                          {badge.dateValidation && new Date(badge.dateValidation).toLocaleDateString('fr-FR')}
                          {badge.valideParNomComplet ? ` — validé par ${badge.valideParNomComplet}` : ''}
                        </span>
                      )}
                    </div>
                  </div>
                  {!badge.valide && peutValiderBadges && (
                    <button
                      onClick={() => handleValiderBadge(badge.id)}
                      disabled={validationEnCours && badgeEnCours === badge.id}
                      className="text-sm bg-[var(--cp)] text-white px-3 py-1.5 rounded-md hover:brightness-110 transition-all disabled:opacity-60 flex-shrink-0 ml-2"
                    >
                      {validationEnCours && badgeEnCours === badge.id ? '…' : 'Valider'}
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* Parents avec comptes */}
      {scout.liensParents.length > 0 && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h2 className="text-base font-semibold text-gray-900 mb-3">Parents avec espace personnel</h2>
          <ul className="space-y-2">
            {scout.liensParents.map((lien) => (
              <li key={lien.parentId} className="flex items-center justify-between border border-gray-100 rounded-md p-3">
                <div>
                  <span className="text-sm font-medium text-gray-900">{lien.parent.prenom} {lien.parent.nom}</span>
                  {lien.parent.telephone && <p className="text-sm text-gray-500">{lien.parent.telephone}</p>}
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
