import type { LucideIcon } from '@/lib/icons'

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
      <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-sable-50 text-sable-500">
        <Icon className="h-6 w-6" strokeWidth={1.75} aria-hidden />
      </div>
      <p className="text-sm font-medium text-stone-700">{title}</p>
      {description && <p className="mt-1 max-w-sm text-sm text-stone-500">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}
