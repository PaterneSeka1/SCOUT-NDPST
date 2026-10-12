import { NextResponse, type NextFetchEvent } from 'next/server'
import { withAuth, type NextRequestWithAuth } from 'next-auth/middleware'
import { apiHorsPerimetreV1, pageHorsPerimetreV1 } from '@/lib/perimetreV1'

const authentification = withAuth({
  pages: {
    signIn: '/login',
  },
})

// Fonctionnalités hors périmètre V1 (voir lib/perimetreV1.ts) : bloquées ici,
// avant toute logique de route, pour qu'aucun appel direct ne les atteigne
// même si un lien subsiste quelque part dans l'interface.
export default function proxy(req: NextRequestWithAuth, event: NextFetchEvent) {
  const chemin = req.nextUrl.pathname

  if (chemin.startsWith('/api/')) {
    if (apiHorsPerimetreV1(chemin)) {
      return NextResponse.json({ erreur: 'Fonctionnalité indisponible' }, { status: 404 })
    }
    // Les routes API vérifient leur session elles-mêmes (voir plus bas).
    return NextResponse.next()
  }

  if (pageHorsPerimetreV1(chemin)) {
    const destination = chemin.startsWith('/admin') ? '/admin' : '/dashboard'
    return NextResponse.redirect(new URL(destination, req.url))
  }

  return authentification(req, event)
}

export const config = {
  // /district/* (pages) est déjà protégé indépendamment par app/district/layout.tsx
  // (redirection serveur si session absente/rôle non autorisé) ; il est ajouté ici
  // aussi, en défense en profondeur, pour qu'une future page ajoutée sous /district
  // sans reproduire ce contrôle ne se retrouve pas accessible sans authentification
  // par simple omission — même logique que /dashboard et /admin ci-dessous.
  // Note : les routes API (app/api/**) passent par ce proxy UNIQUEMENT pour le
  // filtrage du périmètre V1 — withAuth n'y est jamais appliqué, car il redirige
  // vers /login (HTML) au lieu de renvoyer un 401 JSON, ce qui casserait les
  // appels fetch() du frontend. Chaque route API vérifie donc sa session et son
  // rôle elle-même (voir lib/roles.ts).
  matcher: ['/dashboard/:path*', '/admin/:path*', '/district/:path*', '/api/:path*'],
}
