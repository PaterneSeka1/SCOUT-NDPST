// Affiché pendant le chargement d'une page (navigation ou premier rendu).
export default function Chargement() {
  return (
    <div role="status" aria-live="polite" className="flex h-64 flex-col items-center justify-center gap-3">
      <span
        className="h-6 w-6 animate-spin rounded-full border-2 border-(--cp) border-t-transparent"
        aria-hidden="true"
      />
      <span className="text-sm text-gray-500">Chargement…</span>
    </div>
  )
}
