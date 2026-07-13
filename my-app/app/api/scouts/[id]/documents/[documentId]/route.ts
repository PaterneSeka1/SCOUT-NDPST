import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { ROLES_TOUT_STAFF as ROLES_AUTORISES, ROLES_BRANCHE } from '@/lib/roles'
import { getBrancheUtilisateur } from '@/lib/brancheUtilisateur'
import { logger } from '@/lib/logger'
import { enregistrerAudit } from '@/lib/audit'
import { paroisseIdRequise } from '@/lib/session'
import type { BrancheType } from '@/app/generated/prisma/client'

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

    const paroisseId = paroisseIdRequise(session)

    // Un responsable de branche ne peut supprimer que les documents des
    // scouts de sa propre branche.
    let brancheRequise: string | undefined
    if (ROLES_BRANCHE.includes(session.user.role)) {
      const bt = await getBrancheUtilisateur(session.user.id, paroisseId)
      if (!bt) return NextResponse.json({ error: 'Scout introuvable' }, { status: 404 })
      brancheRequise = bt
    }

    const scout = await prisma.scout.findFirst({
      where: { id, paroisseId, ...(brancheRequise ? { brancheType: brancheRequise as BrancheType } : {}) },
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

    await enregistrerAudit({
      paroisseId,
      acteurId: session.user.id,
      action: 'DOCUMENT_SUPPRIME',
      entite: 'Document',
      entiteId: documentId,
      details: { type: document.type, nomFichier: document.nomFichier, scoutId: id },
    })

    return NextResponse.json({ message: 'Document supprimé' })
  } catch (error) {
    logger.error('DELETE /api/scouts/[id]/documents/[documentId]', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
