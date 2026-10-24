import Link from 'next/link'
import { forwardRef } from 'react'
import { Loader2, type LucideIcon } from '@/lib/icons'

type Variante = 'primaire' | 'secondaire' | 'fantome' | 'danger' | 'accent'
type Taille = 'sm' | 'md' | 'lg'

const VARIANTES: Record<Variante, string> = {
  primaire: 'bg-primaire text-white hover:brightness-110 shadow-sm',
  accent: 'bg-accent text-white hover:brightness-110 shadow-sm',
  secondaire: 'border border-stone-300 bg-white text-stone-700 hover:bg-stone-50',
  fantome: 'text-stone-600 hover:bg-stone-100 hover:text-stone-900',
  danger: 'bg-red-600 text-white hover:bg-red-700 shadow-sm',
}

const TAILLES: Record<Taille, string> = {
  sm: 'h-8 gap-1.5 px-3 text-xs',
  md: 'h-10 gap-2 px-4 text-sm',
  lg: 'h-12 gap-2 px-6 text-base',
}

export function classesBouton(variante: Variante = 'primaire', taille: Taille = 'md', className = '') {
  return `inline-flex items-center justify-center rounded-lg font-medium whitespace-nowrap transition disabled:pointer-events-none disabled:opacity-50 ${VARIANTES[variante]} ${TAILLES[taille]} ${className}`
}

type Props = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variante?: Variante
  taille?: Taille
  icone?: LucideIcon
  chargement?: boolean
}

export const Button = forwardRef<HTMLButtonElement, Props>(function Button(
  { variante = 'primaire', taille = 'md', icone: Icone, chargement = false, className = '', children, disabled, type = 'button', ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled || chargement}
      aria-busy={chargement || undefined}
      className={classesBouton(variante, taille, className)}
      {...props}
    >
      {chargement ? (
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
      ) : (
        Icone && <Icone className="h-4 w-4 shrink-0" strokeWidth={2} aria-hidden />
      )}
      {children}
    </button>
  )
})

export function ButtonLink({
  href,
  variante = 'primaire',
  taille = 'md',
  icone: Icone,
  className = '',
  children,
}: {
  href: string
  variante?: Variante
  taille?: Taille
  icone?: LucideIcon
  className?: string
  children: React.ReactNode
}) {
  return (
    <Link href={href} className={classesBouton(variante, taille, className)}>
      {Icone && <Icone className="h-4 w-4 shrink-0" strokeWidth={2} aria-hidden />}
      {children}
    </Link>
  )
}
