import { withAuth } from 'next-auth/middleware'

export default withAuth({
  pages: {
    signIn: '/login',
  },
})

export const config = {
  // /district/* (pages) est déjà protégé indépendamment par app/district/layout.tsx
  // (redirection serveur si session absente/rôle non autorisé) ; il est ajouté ici
  // aussi, en défense en profondeur, pour qu'une future page ajoutée sous /district
  // sans reproduire ce contrôle ne se retrouve pas accessible sans authentification
  // par simple omission — même logique que /dashboard et /admin ci-dessous.
  // Note : les routes API (app/api/**) ne sont volontairement PAS couvertes par ce
  // matcher, y compris /api/admin et /api/dashboard existants — withAuth redirige
  // par défaut vers /login (HTML) au lieu de renvoyer un 401 JSON, ce qui casserait
  // les appels fetch() du frontend. Chaque route API vérifie donc sa session et son
  // rôle elle-même (voir lib/roles.ts) ; c'est le modèle déjà en place pour /api/admin
  // et /api/dashboard, à garder cohérent plutôt que de le mélanger route par route.
  matcher: ['/dashboard/:path*', '/admin/:path*', '/district/:path*'],
}
