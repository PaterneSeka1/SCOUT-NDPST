import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { ROLES_PLATEFORME } from '@/lib/roles'
import { normaliserDoyenne } from '@/lib/district'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ erreur: 'Non authentifié' }, { status: 401 })
  if (!ROLES_PLATEFORME.includes(session.user.role)) {
    return NextResponse.json({ erreur: 'Accès refusé' }, { status: 403 })
  }

  const groupes = await prisma.paroisse.groupBy({
    by: ['doyenne'],
    where: { doyenne: { not: null } },
    _count: { id: true },
    orderBy: { doyenne: 'asc' },
  })

  const districts = await Promise.all(
    groupes
      .filter((g) => normaliserDoyenne(g.doyenne) !== null)
      .map(async (g) => {
        const doyenne = normaliserDoyenne(g.doyenne) as string

        const commissaire = await prisma.utilisateur.findFirst({
          where: { role: 'COMMISSAIRE_DISTRICT', actif: true, paroisse: { doyenne } },
          select: { id: true, nom: true, prenom: true, actif: true },
        })

        return {
          doyenne,
          key: encodeURIComponent(doyenne),
          nbParoisses: g._count.id,
          commissaire,
        }
      }),
  )

  return NextResponse.json({ districts })
}
