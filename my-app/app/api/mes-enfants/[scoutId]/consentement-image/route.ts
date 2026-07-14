import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { logger } from '@/lib/logger'
import { enregistrerAudit } from '@/lib/audit'
import { paroisseIdRequise } from '@/lib/session'

type RouteParams = { params: Promise<{ scoutId: string }> }

// POST — un parent accorde ou révoque le consentement à l'utilisation de
// l'image de SON enfant (photo affichée dans l'application, publications de
// la paroisse…). Restreint aux scouts effectivement rattachés au parent via
// LienParentScout — jamais à un scout quelconque.
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return NextResponse.json({ erreur: 'Non authentifié' }, { status: 401 })

    const { scoutId } = await params
    const body = await request.json()
    const { consentement } = body as { consentement?: boolean }
    if (typeof consentement !== 'boolean') {
      return NextResponse.json({ erreur: 'Le champ consentement (booléen) est requis' }, { status: 400 })
    }
    const paroisseId = paroisseIdRequise(session)

    // Le rôle du compte n'est jamais la condition d'accès : un membre du
    // staff ou un compte SCOUT (Ressources Adultes) peut être par ailleurs
    // parent d'un scout de la paroisse (voir LienParentScout). Seul le lien
    // réel fait foi — jamais un scout quelconque.
    const lien = await prisma.lienParentScout.findFirst({
      where: { parentId: session.user.id, scoutId, scout: { paroisseId } },
    })
    if (!lien) {
      return NextResponse.json({ erreur: 'Cet enfant n\'est pas rattaché à votre compte' }, { status: 403 })
    }

    const scout = await prisma.scout.update({
      where: { id: scoutId },
      data: {
        consentementImage: consentement,
        consentementImageDate: consentement ? new Date() : null,
        consentementImageParId: consentement ? session.user.id : null,
      },
      select: { id: true, consentementImage: true, consentementImageDate: true },
    })

    await enregistrerAudit({
      paroisseId,
      acteurId: session.user.id,
      action: 'SCOUT_CONSENTEMENT_IMAGE_MODIFIE',
      entite: 'Scout',
      entiteId: scoutId,
      details: { consentementImage: consentement },
    })

    return NextResponse.json(scout)
  } catch (error) {
    logger.error('POST /api/mes-enfants/[scoutId]/consentement-image', error)
    return NextResponse.json({ erreur: 'Erreur serveur' }, { status: 500 })
  }
}
