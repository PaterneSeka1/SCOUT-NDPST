import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { logger } from '@/lib/logger'
import { enregistrerAudit } from '@/lib/audit'
import { autoriseValidationParcoursCompagnon } from '@/lib/parcoursCompagnonPermissions'
import { chargerProgressionAvecScout } from '@/lib/parcoursCompagnonService'

type RouteParams = { params: Promise<{ id: string }> }

// POST — rejette une activité soumise. Le motif est obligatoire ; l'activité
// peut ensuite être corrigée et resoumise via la route "soumettre".
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ erreur: 'Non authentifié' }, { status: 401 })
    }

    const { id } = await params
    const progression = await chargerProgressionAvecScout(id)

    if (!progression || !(await autoriseValidationParcoursCompagnon(session, progression.parcours.scout))) {
      return NextResponse.json({ erreur: 'Activité de progression introuvable' }, { status: 404 })
    }

    if (progression.statut !== 'SOUMISE') {
      return NextResponse.json({ erreur: 'Seule une activité soumise peut être rejetée' }, { status: 409 })
    }

    const body = await request.json()
    const { motifRejet } = body as { motifRejet?: string }

    if (!motifRejet?.trim()) {
      return NextResponse.json({ erreur: 'Le motif de rejet est obligatoire' }, { status: 400 })
    }

    const progressionRejetee = await prisma.progressionCompagnon.update({
      where: { id: progression.id },
      data: {
        statut: 'REJETEE',
        motifRejet: motifRejet.trim(),
        rejeteLe: new Date(),
        rejeteParId: session.user.id,
      },
    })

    await enregistrerAudit({
      paroisseId: progression.parcours.scout.paroisseId,
      acteurId: session.user.id,
      action: 'PROGRESSION_COMPAGNON_REJETEE',
      entite: 'ProgressionCompagnon',
      entiteId: progression.id,
      details: { motifRejet: motifRejet.trim(), etapeActiviteId: progression.etapeActiviteId },
    })

    return NextResponse.json(progressionRejetee)
  } catch (error) {
    logger.error('POST /api/parcours-compagnon/progressions/[id]/rejeter', error)
    return NextResponse.json({ erreur: 'Erreur serveur' }, { status: 500 })
  }
}
