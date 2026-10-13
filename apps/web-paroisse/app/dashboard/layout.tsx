import { redirect } from 'next/navigation'
import { getSession } from '@/lib/session-serveur'
import { PERIMETRE_V1, couleurSure, hexToRgb } from '@scout/shared'
import { appelApiServeur } from '@/lib/api-serveur'
import { getIdentitePlateforme } from '@/lib/identite-serveur'
import { LOGO_OFFICIEL } from '@/lib/identite'
import { SessionProvider } from '@/lib/session-client'
import { DashboardShell } from './DashboardShell'

// Identité propre à la paroisse de l'utilisateur connecté (logo + couleurs),
// en surcharge de l'identité plateforme injectée par le layout racine — un
// membre d'une paroisse voit ses propres couleurs une fois connecté, plutôt
// que l'identité commune affichée avant connexion.
//
// Une affectation district (roleDistrict) est ADDITIVE au rôle paroissial :
// un Chef de Groupe par ailleurs Commissaire de District voit son tableau de
// bord paroissial normalement. L'espace district relève d'une autre plateforme.
export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession()
  if (!session?.user) redirect('/login')
  // Frontend purement paroissial : un compte sans paroisse (administration
  // plateforme) relève d'une autre plateforme.
  const paroisseId = session.user.paroisseId
  if (!paroisseId) redirect('/login')

  const [paroisse, plateforme, nombreEnfants] = await Promise.all([
    lireParoisse(),
    getIdentitePlateforme(),
    // Un membre du staff peut être par ailleurs parent d'un scout de la
    // paroisse : la page « Mes enfants » lui est alors proposée aussi. Masquée
    // en périmètre V1 : inutile d'interroger l'API.
    PERIMETRE_V1 ? Promise.resolve(0) : compterEnfants(),
  ])

  // Couleurs de la plateforme déjà validées par l'API.
  const defautPlateforme = plateforme.theme

  const theme = {
    couleurPrimaire: couleurSure(paroisse?.couleurPrimaire, defautPlateforme.couleurPrimaire),
    couleurAccent: couleurSure(paroisse?.couleurAccent, defautPlateforme.couleurAccent),
    couleurFond: couleurSure(paroisse?.couleurFond, defautPlateforme.couleurFond),
    couleurHover: couleurSure(paroisse?.couleurHover, defautPlateforme.couleurHover),
  }

  const nomSite = paroisse?.nom ?? plateforme.nomSite
  const sousTitreSite = paroisse?.ville ?? plateforme.sousTitreSite
  const logoUrl = paroisse?.logo || plateforme.logoUrl || LOGO_OFFICIEL

  const { couleurPrimaire: cp, couleurAccent: ca, couleurFond: cf, couleurHover: ch } = theme
  const cssVars = `
    :root {
      --cp: ${cp}; --ca: ${ca}; --cf: ${cf}; --ch: ${ch};
      --cp-rgb: ${hexToRgb(cp)}; --ca-rgb: ${hexToRgb(ca)}; --ch-rgb: ${hexToRgb(ch)};
    }
  `.replace(/\s+/g, ' ').trim()

  return (
    <SessionProvider sessionInitiale={session}>
      <style dangerouslySetInnerHTML={{ __html: cssVars }} />
      <DashboardShell
        role={session.user.role}
        paroisseId={paroisseId}
        nomComplet={`${session.user.prenom} ${session.user.nom}`}
        logoUrl={logoUrl}
        nomSite={nomSite}
        sousTitreSite={sousTitreSite}
        aDesEnfants={nombreEnfants > 0}
      >
        {children}
      </DashboardShell>
    </SessionProvider>
  )
}

interface IdentiteParoisse {
  nom: string
  ville: string
  logo: string | null
  couleurPrimaire: string | null
  couleurAccent: string | null
  couleurFond: string | null
  couleurHover: string | null
}

// Identité de la paroisse de l'utilisateur (nom, logo, couleurs). Une erreur
// d'API retombe sur l'identité de la plateforme plutôt que de bloquer l'accès.
async function lireParoisse(): Promise<IdentiteParoisse | null> {
  const reponse = await appelApiServeur('/api/paroisse').catch(() => null)
  if (!reponse?.ok) return null
  return (await reponse.json()) as IdentiteParoisse
}

async function compterEnfants(): Promise<number> {
  const reponse = await appelApiServeur('/api/mes-enfants').catch(() => null)
  if (!reponse?.ok) return 0
  const { enfants } = (await reponse.json()) as { enfants?: unknown[] }
  return enfants?.length ?? 0
}
