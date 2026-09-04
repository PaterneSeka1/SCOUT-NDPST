'use client'

import { AlertTriangle } from '@/lib/icons'

export default function DashboardError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center h-64 text-center gap-3">
      <AlertTriangle className="h-9 w-9 text-gray-300" strokeWidth={2} />
      <p className="text-sm font-medium text-gray-700">Une erreur est survenue.</p>
      <p className="text-sm text-gray-500">Réessayez, ou revenez plus tard si le problème persiste.</p>
      <button
        onClick={reset}
        className="mt-2 bg-[var(--cp)] text-white px-4 py-2 rounded-lg hover:brightness-110 transition-all text-sm font-medium"
      >
        Réessayer
      </button>
    </div>
  )
}
