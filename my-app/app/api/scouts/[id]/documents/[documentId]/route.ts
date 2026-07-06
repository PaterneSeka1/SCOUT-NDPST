import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { ROLES_TOUT_STAFF as ROLES_AUTORISES } from '@/lib/roles'
import { logger } from '@/lib/logger'

type RouteParams = { params: Promise<{ id: string; documentId: string }> }

export async function DELETE(_request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }

    if (!ROLES_AUTORISES.includes(session.user.role)) {
      return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
    }

    const { id, documentId } = await params

    const scout = await prisma.scout.findFirst({
      where: { id, paroisseId: session.user.paroisseId },
      select: { id: true },
    })

    if (!scout) {
      return NextResponse.json({ error: 'Scout introuvable' }, { status: 404 })
    }

    const document = await prisma.document.findFirst({
      where: { id: documentId, scoutId: id },
    })

    if (!document) {
      return NextResponse.json({ error: 'Document introuvable' }, { status: 404 })
    }

    await prisma.document.delete({ where: { id: documentId } })

    return NextResponse.json({ message: 'Document supprimé' })
  } catch (error) {
    logger.error('DELETE /api/scouts/[id]/documents/[documentId]', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
