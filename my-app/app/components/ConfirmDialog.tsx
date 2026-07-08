'use client'

import { useEffect, useState } from 'react'

interface DemandeConfirmation {
  titre: string
  description: string
  labelConfirmer?: string
  labelAnnuler?: string
  danger?: boolean
  resolve: (valeur: boolean) => void
}

let demandeActuelle: DemandeConfirmation | null = null
let abonnes: Array<(d: DemandeConfirmation | null) => void> = []

function notifier() {
  abonnes.forEach((fn) => fn(demandeActuelle))
}

/**
 * Ouvre une boîte de dialogue de confirmation personnalisée (aucun modal
 * système du navigateur). À appeler depuis n'importe où dans l'app, sans
 * provider à ajouter — le composant `ConfirmDialogHost` (monté une seule
 * fois dans app/layout.tsx) affiche la demande en cours.
 *
 * La description doit expliquer précisément l'action qui sera effectuée.
 *
 * @example
 * const ok = await confirmer({
 *   titre: 'Supprimer ce scout ?',
 *   description: 'Cette action supprimera définitivement la fiche de ce scout ainsi que son historique de présence. Cette action est irréversible.',
 *   labelConfirmer: 'Supprimer',
 *   danger: true,
 * })
 * if (!ok) return
 */
export function confirmer(options: {
  titre: string
  description: string
  labelConfirmer?: string
  labelAnnuler?: string
  danger?: boolean
}): Promise<boolean> {
  return new Promise((resolve) => {
    demandeActuelle = { ...options, resolve }
    notifier()
  })
}

export function ConfirmDialogHost() {
  const [demande, setDemande] = useState<DemandeConfirmation | null>(null)

  useEffect(() => {
    abonnes.push(setDemande)
    return () => {
      abonnes = abonnes.filter((fn) => fn !== setDemande)
    }
  }, [])

  useEffect(() => {
    if (!demande) return
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') repondre(false)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [demande])

  if (!demande) return null

  const repondre = (valeur: boolean) => {
    demande.resolve(valeur)
    demandeActuelle = null
    setDemande(null)
  }

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50"
      onClick={() => repondre(false)}
      role="presentation"
    >
      <div
        className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6 space-y-4"
        onClick={(e) => e.stopPropagation()}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-dialog-titre"
        aria-describedby="confirm-dialog-description"
      >
        <h2 id="confirm-dialog-titre" className="text-lg font-bold text-gray-900">
          {demande.titre}
        </h2>
        <p id="confirm-dialog-description" className="text-sm text-gray-600 leading-relaxed">
          {demande.description}
        </p>
        <div className="flex flex-col sm:flex-row sm:justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={() => repondre(false)}
            className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition"
          >
            {demande.labelAnnuler ?? 'Annuler'}
          </button>
          <button
            type="button"
            onClick={() => repondre(true)}
            autoFocus
            className={`rounded-lg px-4 py-2 text-sm font-bold text-white transition ${
              demande.danger ? 'bg-red-600 hover:bg-red-700' : 'hover:brightness-110'
            }`}
            style={demande.danger ? undefined : { backgroundColor: 'var(--cp)' }}
          >
            {demande.labelConfirmer ?? 'Confirmer'}
          </button>
        </div>
      </div>
    </div>
  )
}
