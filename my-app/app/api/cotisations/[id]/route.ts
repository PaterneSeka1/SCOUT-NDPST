import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { StatutCotisation } from '@/app/generated/prisma/client'
import { ROLES_GESTION, ROLES_GROUPE, ROLES_BRANCHE } from '@/lib/roles'
import { getBrancheUtilisateur } from '@/lib/brancheUtilisateur'
import { logger } from '@/lib/logger'
import { enregistrerAudit } from '@/lib/audit'
import { paroisseIdRequise } from '@/lib/session'

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
    const paroisseId = paroisseIdRequise(session)

    const { id } = await params

    // Un responsable de branche ne peut enregistrer un paiement que pour un
    // scout de sa propre branche.
    let brancheRequise: string | undefined
    if (ROLES_BRANCHE.includes(session.user.role)) {
      const bt = await getBrancheUtilisateur(session.user.id, paroisseId)
      if (!bt) return NextResponse.json({ erreur: 'Cotisation introuvable' }, { status: 404 })
      brancheRequise = bt
    }

    const existante = await prisma.cotisation.findFirst({
      where: {
        id,
        paroisseId,
        ...(brancheRequise ? { scout: { brancheType: brancheRequise as never } } : {}),
      },
    })
    if (!existante) return NextResponse.json({ erreur: 'Cotisation introuvable' }, { status: 404 })

    const body = await req.json()
    const { statut, modePaiement, notes, montantPaye } = body as {
      statut?: string
      modePaiement?: string | null
      notes?: string | null
      montantPaye?: number
    }

    if (statut !== undefined && !(statut in StatutCotisation)) {
      return NextResponse.json({ erreur: 'Statut invalide' }, { status: 400 })
    }

    if (statut === 'PARTIELLEMENT_PAYEE') {
      if (
        typeof montantPaye !== 'number' ||
        !Number.isInteger(montantPaye) ||
        montantPaye <= 0 ||
        montantPaye >= existante.montant
      ) {
        return NextResponse.json(
          { erreur: 'Le montant payé doit être un entier positif, inférieur au montant dû (sinon utilisez le statut "Payée")' },
          { status: 400 },
        )
      }
    }

    // montantPaye reste toujours cohérent avec statut : 0 pour EN_ATTENTE/EXONEREE,
    // le montant dû en entier pour PAYEE, la valeur fournie pour PARTIELLEMENT_PAYEE.
    const montantPayeSelonStatut: Record<string, number> = {
      EN_ATTENTE: 0,
      EXONEREE: 0,
      PAYEE: existante.montant,
      PARTIELLEMENT_PAYEE: montantPaye ?? 0,
    }

    const cotisation = await prisma.cotisation.update({
      where: { id },
      data: {
        ...(statut !== undefined
          ? {
              statut: statut as StatutCotisation,
              montantPaye: montantPayeSelonStatut[statut],
              datePaiement: statut === 'PAYEE' || statut === 'PARTIELLEMENT_PAYEE' ? new Date() : null,
              enregistreParId: statut === 'PAYEE' || statut === 'PARTIELLEMENT_PAYEE' ? session.user.id : null,
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

    // Auditer tout changement de statut, mais aussi un complément de paiement
    // partiel qui laisse le statut à PARTIELLEMENT_PAYEE (ex: 5000 puis 3000
    // FCFA de plus) — sans quoi ce second mouvement d'argent ne laisserait
    // aucune trace, alors que c'est justement ce que ce statut vise à tracer.
    const statutInchange = statut !== undefined && statut === existante.statut
    const montantInchange = statutInchange && montantPayeSelonStatut[statut] === existante.montantPaye
    if (statut !== undefined && !montantInchange) {
      await enregistrerAudit({
        paroisseId,
        acteurId: session.user.id,
        action: 'COTISATION_STATUT_MODIFIE',
        entite: 'Cotisation',
        entiteId: id,
        details: {
          ancienStatut: existante.statut,
          nouveauStatut: statut,
          scoutId: existante.scoutId,
          ancienMontantPaye: existante.montantPaye,
          montantPaye: montantPayeSelonStatut[statut],
        },
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
    const paroisseId = paroisseIdRequise(session)

    const { id } = await params

    const existante = await prisma.cotisation.findFirst({
      where: { id, paroisseId },
    })
    if (!existante) return NextResponse.json({ erreur: 'Cotisation introuvable' }, { status: 404 })

    await prisma.cotisation.delete({ where: { id } })

    await enregistrerAudit({
      paroisseId,
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
