import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { logger } from '@/lib/logger'

export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return NextResponse.json({ erreur: 'Non authentifié' }, { status: 401 })

    const utilisateur = await prisma.utilisateur.findUnique({
      where: { id: session.user.id },
      select: { brancheType: true },
    })

    const brancheType = utilisateur?.brancheType ?? null
    const role = brancheType && session.user.role.includes('_BRANCHE')
      ? session.user.role.replace('_BRANCHE', '')
      : null

    return NextResponse.json({ brancheType, role })
  } catch (error) {
    logger.error('GET /api/me/branche', error)
    return NextResponse.json({ erreur: 'Erreur serveur' }, { status: 500 })
  }
}
