import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { ROLES_PLATEFORME } from '@/lib/roles'
import { normaliserDistrict } from '@/lib/district'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ erreur: 'Non authentifié' }, { status: 401 })
  if (!ROLES_PLATEFORME.includes(session.user.role)) {
    return NextResponse.json({ erreur: 'Accès refusé' }, { status: 403 })
  }

  // Toute paroisse appartient désormais à un district (colonne non nulle) — pas
  // de filtre "not: null" à appliquer, contrairement à l'ancien champ doyenne.
  const groupes = await prisma.paroisse.groupBy({
    by: ['district'],
    _count: { id: true },
    orderBy: { district: 'asc' },
  })

  const districts = await Promise.all(
    groupes
      .filter((g) => normaliserDistrict(g.district) !== null)
      .map(async (g) => {
        const nom = normaliserDistrict(g.district) as string

        const commissaire = await prisma.utilisateur.findFirst({
          where: { role: 'COMMISSAIRE_DISTRICT', actif: true, paroisse: { district: nom } },
          select: { id: true, nom: true, prenom: true, actif: true },
        })

        return {
          nom,
          key: encodeURIComponent(nom),
          nbParoisses: g._count.id,
          commissaire,
        }
      }),
  )

  return NextResponse.json({ districts })
}
