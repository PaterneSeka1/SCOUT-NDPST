export function Card({
  children,
  className = '',
  as: Element = 'section',
}: {
  children: React.ReactNode
  className?: string
  as?: 'section' | 'div' | 'article'
}) {
  return <Element className={`rounded-xl border border-stone-200/80 bg-white shadow-carte ${className}`}>{children}</Element>
}

export function CardHeader({
  titre,
  description,
  actions,
  className = '',
}: {
  titre: React.ReactNode
  description?: React.ReactNode
  actions?: React.ReactNode
  className?: string
}) {
  return (
    <div className={`flex flex-wrap items-start justify-between gap-3 border-b border-stone-100 px-5 py-4 ${className}`}>
      <div className="min-w-0">
        <h2 className="text-base font-semibold text-stone-900">{titre}</h2>
        {description && <p className="mt-0.5 text-sm text-stone-500">{description}</p>}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap gap-2">{actions}</div>}
    </div>
  )
}

export function CardBody({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <div className={`px-5 py-4 ${className}`}>{children}</div>
}
