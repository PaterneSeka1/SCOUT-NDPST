/** Barre de recherche et de filtres au-dessus d'un tableau (responsive). */
export function FilterBar({ children, actions }: { children: React.ReactNode; actions?: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
      <div className="flex flex-1 flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center [&>*]:sm:max-w-xs [&>*:first-child]:sm:max-w-sm">
        {children}
      </div>
      {actions && <div className="flex shrink-0 gap-2">{actions}</div>}
    </div>
  )
}
