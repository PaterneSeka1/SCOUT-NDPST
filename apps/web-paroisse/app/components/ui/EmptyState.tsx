import type { LucideIcon } from '@/lib/icons'

// Remplace le motif "gros emoji + message" (text-4xl mb-3) répété dans les
// états vides des listes (documents, cotisations, présences, mes-enfants…)
// par une icône trait fin cohérente avec le reste de l'interface.
export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className = '',
}: {
  icon: LucideIcon
  title: string
  description?: string
  action?: React.ReactNode
  className?: string
}) {
  return (
    <div className={`flex flex-col items-center px-4 py-12 text-center sm:py-16 ${className}`}>
      <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-gray-50 text-gray-300">
        <Icon className="h-6 w-6" strokeWidth={1.75} />
      </div>
      <p className="text-sm font-medium text-gray-600">{title}</p>
      {description && <p className="mt-1 max-w-xs text-xs text-gray-400">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}
