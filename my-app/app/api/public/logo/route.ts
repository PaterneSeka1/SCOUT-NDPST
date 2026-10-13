import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { LOGO_OFFICIEL } from '@/lib/theme'

// Route publique — aucune authentification requise. Sert l'identité de la
// PLATEFORME (pas celle d'une paroisse) : un visiteur non connecté n'a aucun
// moyen d'indiquer à quelle paroisse il appartient (pas de sous-domaine ni de
// sélecteur), donc les pages pré-connexion (accueil, login) affichent toujours
// l'identité commune, gérée par ADMIN_PLATEFORME. L'identité propre à chaque
// paroisse n'apparaît qu'une fois connecté, dans le tableau de bord.
export async function GET() {
  const cfg = await prisma.configurationPlateforme.findUnique({ where: { id: 'platform' } })
  return NextResponse.json({
    logoUrl: cfg?.logoUrl || LOGO_OFFICIEL,
    nomSite: cfg?.nomSite ?? 'SCOUT ASCCI',
    sousTitreSite: cfg?.sousTitreSite ?? "Côte d'Ivoire",
  })
}
