import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { logger } from '@/lib/logger'

export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return NextResponse.json({ erreur: 'Non authentifié' }, { status: 401 })

    // orderBy déterministe : si un utilisateur venait à cumuler plusieurs
    // postes de branche (aucune contrainte d'unicité en base aujourd'hui),
    // on retombe toujours sur le même (le plus ancien) plutôt qu'un résultat
    // arbitraire selon l'ordre de retour de Postgres.
    const poste = await prisma.posteBranche.findFirst({
      where: { utilisateurId: session.user.id, paroisseId: session.user.paroisseId },
      select: { brancheType: true, role: true },
      orderBy: { createdAt: 'asc' },
    })

    return NextResponse.json(poste ?? { brancheType: null, role: null })
  } catch (error) {
    logger.error('GET /api/me/branche', error)
    return NextResponse.json({ erreur: 'Erreur serveur' }, { status: 500 })
  }
}
