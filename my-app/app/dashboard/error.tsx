'use client'

export default function DashboardError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center h-64 text-center gap-3">
      <p className="text-4xl">⚠️</p>
      <p className="text-sm font-medium text-gray-700">Une erreur est survenue.</p>
      <p className="text-sm text-gray-500">Réessayez, ou revenez plus tard si le problème persiste.</p>
      <button
        onClick={reset}
        className="mt-2 bg-[#1a4731] text-white px-4 py-2 rounded-lg hover:bg-[#163d29] transition-colors text-sm font-medium"
      >
        Réessayer
      </button>
    </div>
  )
}
