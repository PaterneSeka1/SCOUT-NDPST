'use client'

import { AlertTriangle } from '@/lib/icons'

// Erreur de rendu dans la console d'administration : affichée dans le cadre
// (navigation conservée), avec une nouvelle tentative du segment en erreur.
export default function AdminError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div role="alert" className="flex h-64 flex-col items-center justify-center gap-3 text-center">
      <AlertTriangle className="h-9 w-9 text-gray-300" strokeWidth={2} aria-hidden="true" />
      <h2 className="text-sm font-medium text-gray-700">Une erreur est survenue.</h2>
      <p className="text-sm text-gray-500">Réessayez, ou revenez plus tard si le problème persiste.</p>
      <button
        type="button"
        onClick={reset}
        className="mt-2 rounded-lg bg-(--cp) px-4 py-2 text-sm font-medium text-white transition-all hover:brightness-110"
      >
        Réessayer
      </button>
    </div>
  )
}
