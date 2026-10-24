import { AlertTriangle, CheckCircle2, Info, XCircle } from '@/lib/icons'

type Niveau = 'info' | 'succes' | 'attention' | 'critique'

const STYLES: Record<Niveau, { classes: string; icone: typeof Info }> = {
  info: { classes: 'border-sky-200 bg-sky-50 text-sky-900', icone: Info },
  succes: { classes: 'border-green-200 bg-green-50 text-green-900', icone: CheckCircle2 },
  attention: { classes: 'border-amber-200 bg-amber-50 text-amber-900', icone: AlertTriangle },
  critique: { classes: 'border-red-200 bg-red-50 text-red-900', icone: XCircle },
}

export function Alert({
  niveau = 'info',
  titre,
  children,
  action,
  className = '',
}: {
  niveau?: Niveau
  titre?: string
  children?: React.ReactNode
  action?: React.ReactNode
  className?: string
}) {
  const { classes, icone: Icone } = STYLES[niveau]
  return (
    <div role={niveau === 'critique' ? 'alert' : 'status'} className={`flex gap-3 rounded-lg border px-4 py-3 text-sm ${classes} ${className}`}>
      <Icone className="mt-0.5 h-4 w-4 shrink-0" strokeWidth={2} aria-hidden />
      <div className="min-w-0 flex-1">
        {titre && <p className="font-medium">{titre}</p>}
        {children && <div className={titre ? 'mt-0.5 opacity-90' : ''}>{children}</div>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  )
}
