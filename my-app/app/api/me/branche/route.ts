import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return NextResponse.json({ erreur: 'Non authentifié' }, { status: 401 })

    const poste = await prisma.posteBranche.findFirst({
      where: { utilisateurId: session.user.id, paroisseId: session.user.paroisseId },
      select: { brancheType: true, role: true },
    })

    return NextResponse.json(poste ?? { brancheType: null, role: null })
  } catch (error) {
    console.error('[GET /api/me/branche]', error)
    return NextResponse.json({ erreur: 'Erreur serveur' }, { status: 500 })
  }
}
