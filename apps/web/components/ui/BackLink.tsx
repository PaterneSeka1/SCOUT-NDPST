import Link from 'next/link'
import { ArrowLeft } from '@/lib/icons'

// Remplace le motif texte "← Retour…" répété dans une quarantaine de pages
// par un lien cohérent, icône trait fin + libellé.
export function BackLink({
  href,
  children,
  className = '',
}: {
  href: string
  children: React.ReactNode
  className?: string
}) {
  return (
    <Link
      href={href}
      className={`inline-flex items-center gap-1.5 text-sm text-gray-500 transition-colors hover:text-gray-800 ${className}`}
    >
      <ArrowLeft className="h-4 w-4" strokeWidth={2} />
      {children}
    </Link>
  )
}
