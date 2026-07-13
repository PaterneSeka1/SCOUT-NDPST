import { redirect } from 'next/navigation'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { THEME_DEFAUT, couleurSure, hexToRgb } from '@/lib/theme'
import { ROLES_DISTRICT_ETENDU } from '@/lib/roles'
import { DashboardShell } from './DashboardShell'

// Identité propre à la paroisse de l'utilisateur connecté (logo + couleurs),
// en surcharge de l'identité plateforme injectée par le layout racine — un
// membre d'une paroisse voit ses propres couleurs une fois connecté, plutôt
// que l'identité commune affichée avant connexion.
export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions)
  if (!session?.user) redirect('/login')
  if (session.user.role === 'ADMIN_PLATEFORME') redirect('/admin')
  if (ROLES_DISTRICT_ETENDU.includes(session.user.role)) redirect('/district')

  const [paroisse, plateforme, nombreEnfants] = await Promise.all([
    session.user.paroisseId
      ? prisma.paroisse.findUnique({
          where: { id: session.user.paroisseId },
          select: { nom: true, ville: true, logo: true, couleurPrimaire: true, couleurAccent: true, couleurFond: true, couleurHover: true },
        })
      : null,
    prisma.configurationPlateforme.findUnique({ where: { id: 'platform' } }),
    // Un membre du staff (Chef de Groupe, encadrement de branche, Ressources
    // Adultes rattaché via un compte SCOUT…) peut être par ailleurs parent
    // d'un scout de la paroisse : la page "Mes enfants" doit alors lui être
    // accessible aussi, pas seulement au rôle PARENT dédié.
    prisma.lienParentScout.count({ where: { parentId: session.user.id } }),
  ])

  const defautPlateforme = {
    couleurPrimaire: couleurSure(plateforme?.couleurPrimaire, THEME_DEFAUT.couleurPrimaire),
    couleurAccent: couleurSure(plateforme?.couleurAccent, THEME_DEFAUT.couleurAccent),
    couleurFond: couleurSure(plateforme?.couleurFond, THEME_DEFAUT.couleurFond),
    couleurHover: couleurSure(plateforme?.couleurHover, THEME_DEFAUT.couleurHover),
  }

  const theme = {
    couleurPrimaire: couleurSure(paroisse?.couleurPrimaire, defautPlateforme.couleurPrimaire),
    couleurAccent: couleurSure(paroisse?.couleurAccent, defautPlateforme.couleurAccent),
    couleurFond: couleurSure(paroisse?.couleurFond, defautPlateforme.couleurFond),
    couleurHover: couleurSure(paroisse?.couleurHover, defautPlateforme.couleurHover),
  }

  const nomSite = paroisse?.nom ?? plateforme?.nomSite ?? 'SCOUT ASCCI'
  const sousTitreSite = paroisse?.ville ?? plateforme?.sousTitreSite ?? "Côte d'Ivoire"
  const logoUrl = paroisse?.logo ?? plateforme?.logoUrl ?? null

  const { couleurPrimaire: cp, couleurAccent: ca, couleurFond: cf, couleurHover: ch } = theme
  const cssVars = `
    :root {
      --cp: ${cp}; --ca: ${ca}; --cf: ${cf}; --ch: ${ch};
      --cp-rgb: ${hexToRgb(cp)}; --ca-rgb: ${hexToRgb(ca)}; --ch-rgb: ${hexToRgb(ch)};
    }
  `.replace(/\s+/g, ' ').trim()

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: cssVars }} />
      <DashboardShell
        role={session.user.role}
        nomComplet={`${session.user.prenom} ${session.user.nom}`}
        logoUrl={logoUrl}
        nomSite={nomSite}
        sousTitreSite={sousTitreSite}
        aDesEnfants={nombreEnfants > 0}
      >
        {children}
      </DashboardShell>
    </>
  )
}
