import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { randomBytes } from 'crypto'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { ROLES_TOUT_STAFF } from '@/lib/roles'
import { logger } from '@/lib/logger'

// POST — génère (si absent) le jeton d'abonnement iCal personnel de l'utilisateur
// et renvoie l'URL complète du flux à ajouter dans une application calendrier externe.
export async function POST() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return NextResponse.json({ erreur: 'Non authentifié' }, { status: 401 })
    if (!ROLES_TOUT_STAFF.includes(session.user.role)) {
      return NextResponse.json({ erreur: 'Accès refusé' }, { status: 403 })
    }

    let utilisateur = await prisma.utilisateur.findUnique({
      where: { id: session.user.id },
      select: { tokenCalendrier: true },
    })

    if (!utilisateur?.tokenCalendrier) {
      const token = randomBytes(32).toString('hex')
      utilisateur = await prisma.utilisateur.update({
        where: { id: session.user.id },
        data: { tokenCalendrier: token },
        select: { tokenCalendrier: true },
      })
    }

    return NextResponse.json({ url: `/api/calendrier/ics?token=${utilisateur.tokenCalendrier}` })
  } catch (error) {
    logger.error('POST /api/calendrier/token', error)
    return NextResponse.json({ erreur: 'Erreur serveur' }, { status: 500 })
  }
}

// DELETE — révoque le jeton existant (invalide les abonnements en cours).
export async function DELETE() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return NextResponse.json({ erreur: 'Non authentifié' }, { status: 401 })

    await prisma.utilisateur.update({
      where: { id: session.user.id },
      data: { tokenCalendrier: null },
    })

    return NextResponse.json({ ok: true })
  } catch (error) {
    logger.error('DELETE /api/calendrier/token', error)
    return NextResponse.json({ erreur: 'Erreur serveur' }, { status: 500 })
  }
}
