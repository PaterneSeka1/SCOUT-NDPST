'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

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
    demandeActuelle?.resolve(false)
    demandeActuelle = { ...options, resolve }
    notifier()
  })
}

export function ConfirmDialogHost() {
  const dialogue = useRef<HTMLDialogElement>(null)
  const [demande, setDemande] = useState<DemandeConfirmation | null>(null)

  useEffect(() => {
    abonnes.push(setDemande)
    return () => {
      abonnes = abonnes.filter((fn) => fn !== setDemande)
    }
  }, [])

  // Déclaré avant l'effet qui l'utilise (touche Échap) : l'effet suit ainsi
  // toujours la demande en cours.
  const repondre = useCallback(
    (valeur: boolean) => {
      if (!demande) return
      demande.resolve(valeur)
      demandeActuelle = null
      setDemande(null)
    },
    [demande],
  )

  useEffect(() => {
    if (!demande) return
    const element = dialogue.current
    const origine = document.activeElement instanceof HTMLElement ? document.activeElement : null
    element?.showModal()
    return () => {
      element?.close()
      origine?.focus()
    }
  }, [demande, repondre])

  if (!demande) return null

  return (
    <dialog
      ref={dialogue}
      className="fixed inset-0 m-auto w-[calc(100%-2rem)] max-w-md border-0 rounded-xl p-0 bg-transparent backdrop:bg-black/50"
      onCancel={(event) => { event.preventDefault(); repondre(false) }}
      onKeyDown={(event) => {
        if (event.key !== 'Tab') return
        const boutons = dialogue.current?.querySelectorAll<HTMLButtonElement>('button:not(:disabled)')
        if (!boutons?.length) return
        const premier = boutons[0]
        const dernier = boutons[boutons.length - 1]
        if (event.shiftKey && document.activeElement === premier) { event.preventDefault(); dernier.focus() }
        else if (!event.shiftKey && document.activeElement === dernier) { event.preventDefault(); premier.focus() }
      }}
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="confirm-dialog-titre"
      aria-describedby="confirm-dialog-description"
    >
      <div
        className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6 space-y-4"
        onClick={(e) => e.stopPropagation()}
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
            autoFocus
            onClick={() => repondre(false)}
            className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition"
          >
            {demande.labelAnnuler ?? 'Annuler'}
          </button>
          <button
            type="button"
            onClick={() => repondre(true)}
            className={`rounded-lg px-4 py-2 text-sm font-bold text-white transition ${
              demande.danger ? 'bg-red-600 hover:bg-red-700' : 'hover:brightness-110'
            }`}
            style={demande.danger ? undefined : { backgroundColor: 'var(--cp)' }}
          >
            {demande.labelConfirmer ?? 'Confirmer'}
          </button>
        </div>
      </div>
    </dialog>
  )
}
