import type { LucideIcon } from '@/lib/icons'

type Tone = 'primary' | 'accent' | 'info' | 'warning' | 'neutral'

// Style de la pastille d'icône par tonalité. "primary"/"accent" retombent sur
// les couleurs de thème par paroisse (--cp/--ca, voir lib/theme.ts) via les
// variables déjà exposées par app/layout.tsx — jamais de hex figé ici, pour
// que la personnalisation Apparence reste valable partout.
function tonePastille(tone: Tone): { className: string; style?: React.CSSProperties } {
  switch (tone) {
    case 'primary':
      return { className: '', style: { backgroundColor: 'rgba(var(--cp-rgb), 0.12)', color: 'var(--cp)' } }
    case 'accent':
      return { className: '', style: { backgroundColor: 'rgba(var(--ca-rgb), 0.16)', color: 'var(--ca)' } }
    case 'info':
      return { className: 'bg-blue-50 text-blue-600' }
    case 'warning':
      return { className: 'bg-amber-50 text-amber-600' }
    case 'neutral':
      return { className: 'bg-gray-100 text-gray-500' }
  }
}

export function StatCard({
  icon: Icon,
  label,
  value,
  tone = 'primary',
}: {
  icon: LucideIcon
  label: string
  value: string | number
  tone?: Tone
}) {
  const pastille = tonePastille(tone)
  return (
    <div className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm sm:p-6">
      <div
        className={`mb-4 flex h-10 w-10 items-center justify-center rounded-xl sm:h-12 sm:w-12 ${pastille.className}`}
        style={pastille.style}
      >
        <Icon className="h-5 w-5 sm:h-6 sm:w-6" strokeWidth={2} />
      </div>
      <p className="text-2xl leading-none font-bold text-gray-800 sm:text-3xl">{value}</p>
      <p className="mt-1.5 text-sm leading-tight text-gray-500">{label}</p>
    </div>
  )
}

export function StatCardSkeleton() {
  return (
    <div className="animate-pulse rounded-xl border border-gray-100 bg-white p-4 shadow-sm sm:p-6">
      <div className="mb-4 h-10 w-10 rounded-xl bg-gray-200 sm:h-12 sm:w-12" />
      <div className="mb-2 h-7 w-16 rounded bg-gray-200" />
      <div className="h-3 w-24 rounded bg-gray-100" />
    </div>
  )
}
