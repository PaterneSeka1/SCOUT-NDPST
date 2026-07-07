import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { ROLES_TOUT_STAFF } from '@/lib/roles'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ erreur: 'Non autorisé' }, { status: 401 })
  if (!ROLES_TOUT_STAFF.includes(session.user.role)) {
    return NextResponse.json({ erreur: 'Accès refusé' }, { status: 403 })
  }

  const paroisseId = session.user.paroisseId
  if (!paroisseId) return NextResponse.json({ erreur: 'Aucune paroisse' }, { status: 400 })

  const [postes, scoutsParBranche] = await Promise.all([
    prisma.posteBranche.findMany({
      where: { paroisseId },
      include: {
        utilisateur: { select: { id: true, nom: true, prenom: true, email: true, telephone: true } },
      },
      orderBy: [{ brancheType: 'asc' }, { role: 'asc' }],
    }),
    prisma.scout.groupBy({
      by: ['brancheType'],
      where: { paroisseId, actif: true },
      _count: { id: true },
    }),
  ])

  const comptesParBranche: Record<string, number> = {}
  for (const g of scoutsParBranche) comptesParBranche[g.brancheType] = g._count.id

  return NextResponse.json({ postes, comptesParBranche })
}
