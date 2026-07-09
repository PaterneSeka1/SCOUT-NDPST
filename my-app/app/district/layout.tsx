import { redirect } from 'next/navigation'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { THEME_DEFAUT, couleurSure, hexToRgb } from '@/lib/theme'
import { ROLES_DISTRICT_ETENDU } from '@/lib/roles'
import { getParoissesDuDistrict, DistrictInvalideError } from '@/lib/district'
import { DistrictShell } from './DistrictShell'

// Thème = couleurs de ConfigurationPlateforme uniquement (jamais celles d'une
// paroisse en particulier) : un Commissaire de District supervise plusieurs
// paroisses, afficher les couleurs de l'une d'elles serait un signal trompeur.
export default async function DistrictLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions)
  if (!session?.user) redirect('/login')
  if (session.user.role === 'ADMIN_PLATEFORME') redirect('/admin')
  if (!ROLES_DISTRICT_ETENDU.includes(session.user.role)) redirect('/dashboard')

  const plateforme = await prisma.configurationPlateforme.findUnique({ where: { id: 'platform' } })
  const utilisateur = await prisma.utilisateur.findUnique({ where: { id: session.user.id }, select: { brancheType: true } })
  const theme = {
    couleurPrimaire: couleurSure(plateforme?.couleurPrimaire, THEME_DEFAUT.couleurPrimaire),
    couleurAccent: couleurSure(plateforme?.couleurAccent, THEME_DEFAUT.couleurAccent),
    couleurFond: couleurSure(plateforme?.couleurFond, THEME_DEFAUT.couleurFond),
    couleurHover: couleurSure(plateforme?.couleurHover, THEME_DEFAUT.couleurHover),
  }
  const { couleurPrimaire: cp, couleurAccent: ca, couleurFond: cf, couleurHover: ch } = theme
  const cssVars = `
    :root {
      --cp: ${cp}; --ca: ${ca}; --cf: ${cf}; --ch: ${ch};
      --cp-rgb: ${hexToRgb(cp)}; --ca-rgb: ${hexToRgb(ca)}; --ch-rgb: ${hexToRgb(ch)};
    }
  `.replace(/\s+/g, ' ').trim()

  // paroisseId est garanti non-nul pour ces rôles (rattachement paroissial
  // obligatoire, voir prisma/schema.prisma) — seul ADMIN_PLATEFORME y échappe,
  // déjà exclu ci-dessus.
  let nomDistrict: string
  try {
    const district = await getParoissesDuDistrict(session.user.paroisseId!)
    nomDistrict = district.nomDistrict
  } catch (error) {
    if (!(error instanceof DistrictInvalideError)) throw error
    // Jamais de redirect('/dashboard') ici : ce rôle y serait immédiatement
    // renvoyé vers /district par app/dashboard/layout.tsx — boucle infinie.
    // On rend une page d'erreur autonome, sans shell (menu impossible à
    // construire sans district résolu).
    return (
      <>
        <style dangerouslySetInnerHTML={{ __html: cssVars }} />
        <div className="min-h-screen flex items-center justify-center bg-gray-100 p-4">
          <div className="max-w-md bg-white rounded-xl border border-gray-200 p-6 text-center space-y-2">
            <p className="text-lg font-bold text-gray-900">Configuration incomplète</p>
            <p className="text-sm text-gray-600">{error.message}</p>
          </div>
        </div>
      </>
    )
  }

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: cssVars }} />
      <DistrictShell
        role={session.user.role}
        nomComplet={`${session.user.prenom} ${session.user.nom}`}
        nomDistrict={nomDistrict}
        brancheType={utilisateur?.brancheType ?? null}
      >
        {children}
      </DistrictShell>
    </>
  )
}
