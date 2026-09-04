import { ChevronLeft, ChevronRight } from '@/lib/icons'

// Pagination minimale (page/totalPages) — remplace les boutons "←"/"→" en
// texte brut répétés à l'identique dans une dizaine de listes (scouts,
// utilisateurs, parents, équipe, activités, présences…).
export function Pagination({
  page,
  totalPages,
  onPageChange,
  total,
  itemLabel,
}: {
  page: number
  totalPages: number
  onPageChange: (page: number) => void
  /** Nombre total d'éléments, affiché avant la pagination si fourni avec itemLabel. */
  total?: number
  /** Libellé au singulier (ex. "scout") — le "s" du pluriel est ajouté automatiquement. */
  itemLabel?: string
}) {
  if (totalPages <= 1) return null

  return (
    <div className="flex items-center justify-between gap-4">
      <p className="text-xs text-gray-500 sm:text-sm">
        {total !== undefined && itemLabel ? (
          <>
            {total} {itemLabel}
            {total !== 1 ? 's' : ''} — p. {page}/{totalPages}
          </>
        ) : (
          <>Page {page} / {totalPages}</>
        )}
      </p>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => onPageChange(page - 1)}
          disabled={page <= 1}
          aria-label="Page précédente"
          className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-gray-300 text-gray-600 transition-colors hover:bg-gray-50 disabled:opacity-40"
        >
          <ChevronLeft className="h-4 w-4" strokeWidth={2} />
        </button>
        <button
          type="button"
          onClick={() => onPageChange(page + 1)}
          disabled={page >= totalPages}
          aria-label="Page suivante"
          className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-gray-300 text-gray-600 transition-colors hover:bg-gray-50 disabled:opacity-40"
        >
          <ChevronRight className="h-4 w-4" strokeWidth={2} />
        </button>
      </div>
    </div>
  )
}
