import Link from 'next/link'
import { Search } from '@/lib/icons'

// Page 404 commune à toute l'application (route inconnue ou notFound()).
export default function PageIntrouvable() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-3 px-4 text-center">
      <Search className="h-9 w-9 text-gray-300" strokeWidth={2} aria-hidden="true" />
      <h1 className="text-lg font-semibold text-gray-800">Page introuvable</h1>
      <p className="text-sm text-gray-500">La page demandée n&apos;existe pas ou a été déplacée.</p>
      <Link
        href="/"
        className="mt-2 rounded-lg bg-(--cp) px-4 py-2 text-sm font-medium text-white transition-all hover:brightness-110"
      >
        Retour à l&apos;accueil
      </Link>
    </main>
  )
}
