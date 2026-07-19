'use client'

import { useEffect, useState } from 'react'
import { CompteurCaracteres } from '@/app/components/CompteurCaracteres'
import { formatMontantFCFA } from '@/lib/cotisations'

const MAX_COMMENTAIRE = 200

interface ModalPaiementPartielProps {
  montantDu: number
  ouvert: boolean
  onFermer: () => void
  onConfirmer: (montant: number, commentaire: string) => void | Promise<void>
}

/**
 * Modal de saisie d'un paiement partiel de cotisation — remplace l'ancien
 * `window.prompt()` (aucune validation, format libre). Même habillage visuel
 * que `ConfirmDialogHost` (fond semi-transparent, carte blanche centrée,
 * `role="alertdialog"`, fermeture sur Escape/clic extérieur), mais en
 * composant dédié et contrôlé par les props : `confirmer()` de
 * ConfirmDialog est fait pour une confirmation oui/non, pas pour saisir un
 * montant.
 */
export function ModalPaiementPartiel({ montantDu, ouvert, onFermer, onConfirmer }: ModalPaiementPartielProps) {
  const [montant, setMontant] = useState('')
  const [commentaire, setCommentaire] = useState('')
  const [enCours, setEnCours] = useState(false)

  // Réinitialise la saisie à chaque ouverture (sinon l'ancienne valeur
  // resterait affichée si l'utilisateur rouvre le modal pour une autre
  // cotisation).
  useEffect(() => {
    if (ouvert) {
      setMontant('')
      setCommentaire('')
      setEnCours(false)
    }
  }, [ouvert])

  useEffect(() => {
    if (!ouvert) return
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onFermer()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [ouvert, onFermer])

  if (!ouvert) return null

  const montantNombre = Number(montant)
  const montantSaisi = montant.trim() !== ''
  const montantValide = montantSaisi && Number.isInteger(montantNombre) && montantNombre > 0 && montantNombre <= montantDu

  let erreurMontant: string | null = null
  if (montantSaisi) {
    if (!Number.isInteger(montantNombre) || montantNombre <= 0) {
      erreurMontant = 'Le montant doit être un nombre entier positif'
    } else if (montantNombre > montantDu) {
      erreurMontant = `Le montant ne peut pas dépasser ${formatMontantFCFA(montantDu)}`
    }
  }

  const confirmer = async () => {
    if (!montantValide) return
    setEnCours(true)
    try {
      await onConfirmer(montantNombre, commentaire.trim())
    } finally {
      setEnCours(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50"
      onClick={() => onFermer()}
      role="presentation"
    >
      <div
        className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6 space-y-4"
        onClick={(e) => e.stopPropagation()}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="modal-paiement-partiel-titre"
        aria-describedby="modal-paiement-partiel-description"
      >
        <div>
          <h2 id="modal-paiement-partiel-titre" className="text-lg font-bold text-gray-900">
            Enregistrer un paiement partiel
          </h2>
          <p id="modal-paiement-partiel-description" className="text-sm text-gray-600 mt-1">
            Montant dû : {formatMontantFCFA(montantDu)}
          </p>
        </div>

        <label className="block">
          <span className="text-sm font-medium text-gray-700">Montant reçu (FCFA)</span>
          <input
            type="number"
            min={1}
            max={montantDu}
            step={1}
            value={montant}
            onChange={(e) => setMontant(e.target.value)}
            autoFocus
            className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#1a4731]"
          />
          {erreurMontant && <span className="block text-xs text-red-600 mt-1">{erreurMontant}</span>}
        </label>

        <label className="block">
          <span className="text-sm font-medium text-gray-700">
            Commentaire <span className="text-xs text-gray-400 font-normal">(optionnel)</span>
          </span>
          <input
            value={commentaire}
            onChange={(e) => setCommentaire(e.target.value.slice(0, MAX_COMMENTAIRE))}
            maxLength={MAX_COMMENTAIRE}
            placeholder="Ex : Paiement en espèces, reçu n°…"
            className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#1a4731]"
          />
          <span className="block text-right text-xs mt-1">
            <CompteurCaracteres valeur={commentaire} max={MAX_COMMENTAIRE} />
          </span>
        </label>

        <div className="flex flex-col sm:flex-row sm:justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={() => onFermer()}
            className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition"
          >
            Annuler
          </button>
          <button
            type="button"
            onClick={confirmer}
            disabled={!montantValide || enCours}
            className="rounded-lg px-4 py-2 text-sm font-bold text-white transition hover:brightness-110 disabled:opacity-50"
            style={{ backgroundColor: 'var(--cp)' }}
          >
            {enCours ? 'Enregistrement…' : 'Confirmer le paiement'}
          </button>
        </div>
      </div>
    </div>
  )
}
