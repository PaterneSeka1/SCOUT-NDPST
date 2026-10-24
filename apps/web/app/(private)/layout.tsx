import { redirect } from 'next/navigation'
import { getSession } from '@/lib/session-serveur'
import { getIdentite } from '@/lib/identite-serveur'
import { LOGO_PAR_DEFAUT, nomAffiche, sousTitreAffiche } from '@/lib/identite'
import { SessionProvider } from '@/lib/session-client'
import { PrivateShell } from '@/components/layout/PrivateShell'

// Espace privé (gestion du groupe et administration). La session est relue
// auprès de l'API ; chaque appel métier reste autorisé côté serveur.
export default async function LayoutPrive({ children }: { children: React.ReactNode }) {
  const session = await getSession()
  if (!session?.user) redirect('/connexion')
  if (session.user.doitChangerMotDePasse) redirect('/changer-mot-de-passe')

  const identite = await getIdentite()

  return (
    <SessionProvider sessionInitiale={session}>
      <PrivateShell
        role={session.user.role}
        editeurContenu={session.user.editeurContenu}
        nomComplet={`${session.user.prenom} ${session.user.nom}`}
        logoUrl={identite.logoUrl || LOGO_PAR_DEFAUT}
        nomSite={nomAffiche(identite)}
        sousTitreSite={sousTitreAffiche(identite)}
      >
        {children}
      </PrivateShell>
    </SessionProvider>
  )
}
