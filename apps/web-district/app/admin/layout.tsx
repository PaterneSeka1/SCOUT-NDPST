import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { getSession } from '@/lib/session-serveur'
import { SessionProvider } from '@/lib/session-client'
import { getIdentitePlateforme } from '@/lib/identite-serveur'
import { COOKIE_INSTALLATION, INSTALLATION_LOCALE, installationParId, installationsGerees } from '@/lib/installations'
import { AdminShell } from './AdminShell'

// Réservé à ADMIN_PLATEFORME. Contrôle d'affichage uniquement : chaque appel
// /api/admin/* est de nouveau vérifié par l'API (@Roles(ROLES_PLATEFORME)),
// celle du district ou celle de l'installation administrée.
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession()
  if (!session?.user) redirect('/login')
  if (session.user.doitChangerMotDePasse) redirect('/changer-mot-de-passe')
  if (session.user.role !== 'ADMIN_PLATEFORME') redirect('/login?refus=1')

  const [jar, identite] = await Promise.all([cookies(), getIdentitePlateforme()])
  const cible = installationParId(jar.get(COOKIE_INSTALLATION)?.value)

  return (
    <SessionProvider sessionInitiale={session}>
      <AdminShell
        nomComplet={`${session.user.prenom} ${session.user.nom}`}
        installations={{
          options: installationsGerees().map(({ id, nom }) => ({ id, nom })),
          cible: cible?.id ?? INSTALLATION_LOCALE,
          nomDistrict: identite.nomSite,
        }}
        nomCible={cible?.nom ?? null}
      >
        {children}
      </AdminShell>
    </SessionProvider>
  )
}
