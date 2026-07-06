'use client'

import { useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { useScout, useAttribuerMatricule, useAjouterContact, useSupprimerContact, useCreerCompteScout, useAjouterDocument, useSupprimerDocument } from '@/hooks/useScouts'
import { LABELS_BRANCHES, COULEURS_BRANCHES } from '@/lib/branches'
import { LABELS_TYPE_DOCUMENT, ICONES_TYPE_DOCUMENT } from '@/lib/documents'
import { PasswordInput } from '@/app/components/PasswordInput'
import { REGLE_MOT_DE_PASSE } from '@/lib/password'

export default function FicheScoutPage() {
  const { id } = useParams<{ id: string }>()
  const { data: scout, isLoading, isError } = useScout(id)

  const { mutateAsync: attribuerMatricule, isPending: matriculeEnCours } = useAttribuerMatricule(id)
  const { mutateAsync: ajouterContact, isPending: contactEnCours } = useAjouterContact(id)
  const { mutateAsync: supprimerContact } = useSupprimerContact(id)
  const { mutateAsync: creerCompte, isPending: compteEnCours } = useCreerCompteScout(id)
  const { mutateAsync: ajouterDocument } = useAjouterDocument(id)
  const { mutateAsync: supprimerDocument } = useSupprimerDocument(id)

  const [typeDocument, setTypeDocument] = useState('CERTIFICAT_MEDICAL')
  const [uploadDocumentEnCours, setUploadDocumentEnCours] = useState(false)
  const [erreurDocument, setErreurDocument] = useState('')

  const [afficherFormulaireMatricule, setAfficherFormulaireMatricule] = useState(false)
  const [nouveauMatricule, setNouveauMatricule] = useState('')
  const [erreurMatricule, setErreurMatricule] = useState('')

  const [afficherFormulaireContact, setAfficherFormulaireContact] = useState(false)
  const [nouveauContact, setNouveauContact] = useState({ nom: '', prenom: '', telephone: '', relation: '', principal: false })
  const [erreurContact, setErreurContact] = useState('')

  const [afficherFormulaireCompte, setAfficherFormulaireCompte] = useState(false)
  const [passwordCompte, setPasswordCompte] = useState('')
  const [telephoneCompte, setTelephoneCompte] = useState('')
  const [erreurCompte, setErreurCompte] = useState('')
  const [succesCompte, setSuccesCompte] = useState('')
  const [referenceDate] = useState(() => Date.now())

  if (isLoading) return (
    <div className="flex items-center justify-center h-48">
      <div className="w-6 h-6 border-2 border-[#1a4731] border-t-transparent rounded-full animate-spin" />
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
    setErreurMatricule('')
    try {
      await attribuerMatricule(nouveauMatricule.trim())
      setAfficherFormulaireMatricule(false)
      setNouveauMatricule('')
    } catch (err) {
      setErreurMatricule(err instanceof Error ? err.message : 'Erreur')
    }
  }

  const handleAjouterContact = async (e: React.FormEvent) => {
    e.preventDefault()
    setErreurContact('')
    try {
      await ajouterContact(nouveauContact)
      setAfficherFormulaireContact(false)
      setNouveauContact({ nom: '', prenom: '', telephone: '', relation: '', principal: false })
    } catch (err) {
      setErreurContact(err instanceof Error ? err.message : 'Erreur')
    }
  }

  const handleUploadDocument = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const fichier = e.target.files?.[0]
    if (!fichier) return
    setErreurDocument('')
    setUploadDocumentEnCours(true)
    try {
      const fd = new FormData()
      fd.append('fichier', fichier)
      const res = await fetch('/api/upload', { method: 'POST', body: fd })
      const data = await res.json()
      if (!res.ok) { setErreurDocument(data.erreur ?? 'Erreur upload'); return }
      await ajouterDocument({ type: typeDocument, nomFichier: fichier.name, url: data.url })
    } catch (err) {
      setErreurDocument(err instanceof Error ? err.message : "Erreur lors de l'envoi du document")
    } finally {
      setUploadDocumentEnCours(false)
      e.target.value = ''
    }
  }

  const handleSupprimerDocument = async (documentId: string) => {
    if (!confirm('Supprimer ce document ?')) return
    try {
      await supprimerDocument(documentId)
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Erreur')
    }
  }

  const handleCreerCompte = async (e: React.FormEvent) => {
    e.preventDefault()
    setErreurCompte('')
    setSuccesCompte('')
    try {
      await creerCompte({ password: passwordCompte, telephone: telephoneCompte || undefined })
      setSuccesCompte('Compte créé avec succès.')
      setAfficherFormulaireCompte(false)
      setPasswordCompte('')
      setTelephoneCompte('')
    } catch (err) {
      setErreurCompte(err instanceof Error ? err.message : 'Erreur')
    }
  }

  return (
    <div className="space-y-6 max-w-3xl">
      {/* En-tête */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link href="/dashboard/scouts" className="text-sm text-gray-500 hover:text-gray-700">
          ← Retour à la liste
        </Link>
        <Link
          href={`/dashboard/scouts/${id}/modifier`}
          className="bg-[#1a4731] text-white px-4 py-2 rounded-md text-sm hover:bg-[#163d29] transition-colors"
        >
          Modifier
        </Link>
      </div>

      {/* Infos principales */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="flex items-start gap-4">
          <div className="w-16 h-16 rounded-full bg-[#1a4731]/10 flex items-center justify-center text-2xl font-bold text-[#1a4731]">
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
            </div>
            <p className="text-sm text-gray-500 mt-1">
              Né(e) le {new Date(scout.dateNaissance).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}
            </p>
          </div>
        </div>
      </div>

      {/* Matricule */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h2 className="text-base font-semibold text-gray-900 mb-3">Matricule</h2>
        {scout.matricule ? (
          <div className="flex items-center gap-3">
            <span className="font-mono text-lg font-bold text-[#1a4731] bg-[#1a4731]/5 px-3 py-1 rounded">
              {scout.matricule}
            </span>
            <button onClick={() => setAfficherFormulaireMatricule(!afficherFormulaireMatricule)} className="text-sm text-gray-500 underline">
              Modifier
            </button>
          </div>
        ) : (
          <p className="text-sm text-gray-500 mb-2">Aucun matricule attribué pour l&apos;instant.</p>
        )}

        {!scout.matricule && !afficherFormulaireMatricule && (
          <button
            onClick={() => setAfficherFormulaireMatricule(true)}
            className="mt-2 text-sm bg-[#1a4731] text-white px-3 py-1.5 rounded-md hover:bg-[#163d29] transition-colors"
          >
            Attribuer un matricule
          </button>
        )}

        {afficherFormulaireMatricule && (
          <form onSubmit={handleAttribuerMatricule} className="mt-3 flex gap-2 items-start">
            <div>
              <input
                type="text" value={nouveauMatricule} onChange={e => setNouveauMatricule(e.target.value)}
                placeholder="Ex : 0545247O" required
                className="border border-gray-300 rounded-md px-3 py-1.5 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-[#1a4731]"
              />
              {erreurMatricule && <p className="text-xs text-red-600 mt-1">{erreurMatricule}</p>}
            </div>
            <button type="submit" disabled={matriculeEnCours} className="bg-[#1a4731] text-white px-3 py-1.5 rounded-md text-sm disabled:opacity-60">
              {matriculeEnCours ? '…' : 'Enregistrer'}
            </button>
            <button type="button" onClick={() => setAfficherFormulaireMatricule(false)} className="text-sm text-gray-500 px-2 py-1.5">
              Annuler
            </button>
          </form>
        )}
      </div>

      {/* Compte utilisateur */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h2 className="text-base font-semibold text-gray-900 mb-3">Espace personnel</h2>
        {succesCompte && <div className="mb-3 bg-green-50 border border-green-200 text-green-700 px-3 py-2 rounded text-sm">{succesCompte}</div>}

        {scout.utilisateur ? (
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1 bg-green-100 text-green-800 text-xs font-medium px-2 py-0.5 rounded-full">
              ✓ Compte actif
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
                  <button onClick={() => setAfficherFormulaireCompte(true)} className="text-sm bg-[#1a4731] text-white px-3 py-1.5 rounded-md hover:bg-[#163d29] transition-colors">
                    Créer un compte
                  </button>
                )}
                {afficherFormulaireCompte && (
                  <form onSubmit={handleCreerCompte} className="space-y-3 mt-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">Mot de passe <span className="text-red-500">*</span></label>
                      <PasswordInput value={passwordCompte} onChange={e => setPasswordCompte(e.target.value)} required placeholder={REGLE_MOT_DE_PASSE}
                        className="border border-gray-300 rounded-md px-3 py-1.5 text-sm w-full focus:outline-none focus:ring-2 focus:ring-[#1a4731]" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">Téléphone <span className="text-gray-400">(optionnel)</span></label>
                      <input type="tel" value={telephoneCompte} onChange={e => setTelephoneCompte(e.target.value)} placeholder="0712345678"
                        className="border border-gray-300 rounded-md px-3 py-1.5 text-sm w-full focus:outline-none focus:ring-2 focus:ring-[#1a4731]" />
                    </div>
                    {erreurCompte && <p className="text-xs text-red-600">{erreurCompte}</p>}
                    <div className="flex gap-2">
                      <button type="submit" disabled={compteEnCours} className="bg-[#1a4731] text-white px-3 py-1.5 rounded-md text-sm disabled:opacity-60">
                        {compteEnCours ? 'Création…' : 'Créer le compte'}
                      </button>
                      <button type="button" onClick={() => setAfficherFormulaireCompte(false)} className="text-sm text-gray-500 px-2">Annuler</button>
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
          <button onClick={() => setAfficherFormulaireContact(!afficherFormulaireContact)} className="text-sm text-[#1a4731] font-medium hover:underline">
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
                  {contact.principal && <span className="bg-[#1a4731] text-white text-xs px-1.5 py-0.5 rounded">Principal</span>}
                  {contact.relation && <span className="text-xs text-gray-500">{contact.relation}</span>}
                </div>
                <p className="text-sm text-gray-600 mt-0.5">{contact.telephone}</p>
              </div>
              {scout.contactsUrgence.length > 1 && (
                <button
                  onClick={() => supprimerContact(contact.id)}
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
                  className="w-full border border-gray-300 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1a4731]" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Prénom</label>
                <input type="text" value={nouveauContact.prenom} onChange={e => setNouveauContact(p => ({ ...p, prenom: e.target.value }))}
                  className="w-full border border-gray-300 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1a4731]" />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Téléphone <span className="text-red-500">*</span></label>
                <input type="tel" value={nouveauContact.telephone} onChange={e => setNouveauContact(p => ({ ...p, telephone: e.target.value }))} required
                  className="w-full border border-gray-300 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1a4731]" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Relation</label>
                <select value={nouveauContact.relation} onChange={e => setNouveauContact(p => ({ ...p, relation: e.target.value }))}
                  className="w-full border border-gray-300 rounded-md px-3 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#1a4731]">
                  <option value="">Sélectionner</option>
                  <option>Père</option><option>Mère</option><option>Tuteur</option><option>Tutrice</option><option>Autre</option>
                </select>
              </div>
            </div>
            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input type="checkbox" checked={nouveauContact.principal} onChange={e => setNouveauContact(p => ({ ...p, principal: e.target.checked }))} />
              Contact principal
            </label>
            {erreurContact && <p className="text-xs text-red-600">{erreurContact}</p>}
            <div className="flex gap-2">
              <button type="submit" disabled={contactEnCours} className="bg-[#1a4731] text-white px-3 py-1.5 rounded-md text-sm disabled:opacity-60">
                {contactEnCours ? '…' : 'Ajouter'}
              </button>
              <button type="button" onClick={() => setAfficherFormulaireContact(false)} className="text-sm text-gray-500 px-2">Annuler</button>
            </div>
          </form>
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
                  <span className="text-lg flex-shrink-0">{ICONES_TYPE_DOCUMENT[doc.type] ?? '📎'}</span>
                  <span className="min-w-0">
                    <span className="block text-sm font-medium text-gray-900 truncate">{LABELS_TYPE_DOCUMENT[doc.type] ?? doc.type}</span>
                    <span className="block text-xs text-gray-500 truncate">{doc.nomFichier}</span>
                  </span>
                </a>
                <button onClick={() => handleSupprimerDocument(doc.id)} className="text-xs text-red-500 hover:text-red-700 ml-2 flex-shrink-0">
                  Supprimer
                </button>
              </li>
            ))}
          </ul>
        )}

        <div className="flex flex-col sm:flex-row gap-2 items-start sm:items-center border-t border-gray-100 pt-4">
          <select value={typeDocument} onChange={(e) => setTypeDocument(e.target.value)}
            className="border border-gray-300 rounded-md px-3 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#1a4731]">
            {Object.entries(LABELS_TYPE_DOCUMENT).map(([val, label]) => (
              <option key={val} value={val}>{label}</option>
            ))}
          </select>
          <label className="text-sm bg-[#1a4731] text-white px-3 py-1.5 rounded-md hover:bg-[#163d29] transition-colors cursor-pointer">
            {uploadDocumentEnCours ? 'Envoi…' : '+ Ajouter un fichier'}
            <input type="file" accept="image/jpeg,image/png,image/webp,image/gif,application/pdf"
              onChange={handleUploadDocument} disabled={uploadDocumentEnCours} className="hidden" />
          </label>
        </div>
        {erreurDocument && <p className="text-xs text-red-600 mt-2">{erreurDocument}</p>}
      </div>

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
