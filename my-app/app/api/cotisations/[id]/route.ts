import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { StatutCotisation } from '@/app/generated/prisma/client'
import { ROLES_GESTION, ROLES_GROUPE } from '@/lib/roles'
import { logger } from '@/lib/logger'
import { enregistrerAudit } from '@/lib/audit'

type RouteParams = { params: Promise<{ id: string }> }

// PUT — enregistrer un paiement (ou changer le statut). Ouvert à toute la
// direction (groupe + branches) : dans la pratique, ce sont souvent les
// responsables de branche qui collectent les cotisations sur le terrain.
export async function PUT(req: NextRequest, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return NextResponse.json({ erreur: 'Non authentifié' }, { status: 401 })
    if (!ROLES_GESTION.includes(session.user.role)) {
      return NextResponse.json({ erreur: 'Accès refusé' }, { status: 403 })
    }

    const { id } = await params

    const existante = await prisma.cotisation.findFirst({
      where: { id, paroisseId: session.user.paroisseId },
    })
    if (!existante) return NextResponse.json({ erreur: 'Cotisation introuvable' }, { status: 404 })

    const body = await req.json()
    const { statut, modePaiement, notes } = body as {
      statut?: string
      modePaiement?: string | null
      notes?: string | null
    }

    if (statut !== undefined && !(statut in StatutCotisation)) {
      return NextResponse.json({ erreur: 'Statut invalide' }, { status: 400 })
    }

    const cotisation = await prisma.cotisation.update({
      where: { id },
      data: {
        ...(statut !== undefined
          ? {
              statut: statut as StatutCotisation,
              datePaiement: statut === 'PAYEE' ? new Date() : null,
              enregistreParId: statut === 'PAYEE' ? session.user.id : null,
            }
          : {}),
        ...(modePaiement !== undefined ? { modePaiement: modePaiement?.trim() || null } : {}),
        ...(notes !== undefined ? { notes: notes?.trim() || null } : {}),
      },
      include: {
        scout: { select: { id: true, nom: true, prenom: true, brancheType: true } },
        enregistrePar: { select: { id: true, nom: true, prenom: true } },
      },
    })

    if (statut !== undefined && statut !== existante.statut) {
      await enregistrerAudit({
        paroisseId: session.user.paroisseId,
        acteurId: session.user.id,
        action: 'COTISATION_STATUT_MODIFIE',
        entite: 'Cotisation',
        entiteId: id,
        details: { ancienStatut: existante.statut, nouveauStatut: statut, scoutId: existante.scoutId },
      })
    }

    return NextResponse.json(cotisation)
  } catch (error) {
    logger.error('PUT /api/cotisations/[id]', error)
    return NextResponse.json({ erreur: 'Erreur serveur' }, { status: 500 })
  }
}

// DELETE — supprime une cotisation créée par erreur. Réservé à la direction du
// groupe (même logique que la création : eux seuls définissent ce qui est dû).
export async function DELETE(_req: NextRequest, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return NextResponse.json({ erreur: 'Non authentifié' }, { status: 401 })
    if (!ROLES_GROUPE.includes(session.user.role)) {
      return NextResponse.json({ erreur: 'Accès refusé' }, { status: 403 })
    }

    const { id } = await params

    const existante = await prisma.cotisation.findFirst({
      where: { id, paroisseId: session.user.paroisseId },
    })
    if (!existante) return NextResponse.json({ erreur: 'Cotisation introuvable' }, { status: 404 })

    await prisma.cotisation.delete({ where: { id } })

    await enregistrerAudit({
      paroisseId: session.user.paroisseId,
      acteurId: session.user.id,
      action: 'COTISATION_SUPPRIMEE',
      entite: 'Cotisation',
      entiteId: id,
      details: { scoutId: existante.scoutId, montant: existante.montant, anneeScolaire: existante.anneeScolaire },
    })

    return NextResponse.json({ ok: true })
  } catch (error) {
    logger.error('DELETE /api/cotisations/[id]', error)
    return NextResponse.json({ erreur: 'Erreur serveur' }, { status: 500 })
  }
}
