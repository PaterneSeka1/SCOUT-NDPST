import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { Prisma, StatutCotisation, BrancheType } from '@/app/generated/prisma/client'
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

    // Un responsable de branche ne peut enregistrer un paiement que pour une
    // personne de sa propre branche, qu'elle soit fiche scout ou compte staff.
    let brancheRequise: string | undefined
    if (ROLES_BRANCHE.includes(session.user.role)) {
      const bt = await getBrancheUtilisateur(session.user.id, paroisseId)
      if (!bt) return NextResponse.json({ erreur: 'Cotisation introuvable' }, { status: 404 })
      brancheRequise = bt
    }

    const participantBrancheWhere: Prisma.CotisationWhereInput = brancheRequise
      ? {
          OR: [
            { scout: { brancheType: brancheRequise as BrancheType } },
            { utilisateur: { brancheType: brancheRequise as BrancheType } },
          ],
        }
      : {}

    const existante = await prisma.cotisation.findFirst({
      where: {
        id,
        paroisseId,
        ...participantBrancheWhere,
      },
    })
    if (!existante) return NextResponse.json({ erreur: 'Cotisation introuvable' }, { status: 404 })

    const body = await req.json()
    const { statut, modePaiement, notes, montantPaye, exonere } = body as {
      statut?: string
      modePaiement?: string | null
      notes?: string | null
      montantPaye?: number
      exonere?: boolean
    }

    if (statut !== undefined && !(statut in StatutCotisation)) {
      return NextResponse.json({ erreur: 'Statut invalide' }, { status: 400 })
    }

    // NON_A_JOUR couvre aussi bien "rien payé" (montantPaye omis/0) que "payé
    // partiellement" (montantPaye fourni, entre 0 et le montant dû exclus) —
    // c'est ce même champ qui distingue les deux, pas le statut.
    if (statut === 'NON_A_JOUR' && montantPaye !== undefined) {
      if (typeof montantPaye !== 'number' || !Number.isInteger(montantPaye) || montantPaye < 0 || montantPaye >= existante.montant) {
        return NextResponse.json(
          { erreur: 'Le montant reçu doit être un entier positif, inférieur au montant dû' },
          { status: 400 },
        )
      }
    }

    const statutData: Prisma.CotisationUncheckedUpdateInput = {}
    let montantPayeAudit: number | undefined
    let collecteParAudit: string | null | undefined

    if (statut !== undefined) {
      const statutDemande = statut as StatutCotisation
      const montantComplet = existante.montant

      switch (statutDemande) {
        case 'NON_A_JOUR': {
          const montantPayeFinal = typeof montantPaye === 'number' ? montantPaye : 0
          montantPayeAudit = montantPayeFinal
          collecteParAudit = montantPayeFinal > 0 ? session.user.id : null
          Object.assign(statutData, {
            statut: statutDemande,
            montantPaye: montantPayeFinal,
            datePaiement: montantPayeFinal > 0 ? new Date() : null,
            enregistreParId: montantPayeFinal > 0 ? session.user.id : null,
            collecteParId: collecteParAudit,
          })
          break
        }
        case 'ARGENT_RECU':
          montantPayeAudit = montantComplet
          collecteParAudit = session.user.id
          Object.assign(statutData, {
            statut: statutDemande,
            montantPaye: montantComplet,
            datePaiement: new Date(),
            enregistreParId: session.user.id,
            collecteParId: session.user.id,
          })
          break
        case 'A_JOUR': {
          // `exonere` distingue "a réellement payé" (montant complet) de
          // "exempté" (rien dû) — même statut final dans les deux cas.
          const estExonere = exonere === true
          montantPayeAudit = estExonere ? 0 : montantComplet
          collecteParAudit = estExonere ? null : (existante.collecteParId ?? session.user.id)
          Object.assign(statutData, {
            statut: statutDemande,
            montantPaye: montantPayeAudit,
            datePaiement: estExonere ? null : new Date(),
            enregistreParId: session.user.id,
            collecteParId: collecteParAudit,
          })
          break
        }
      }
    }

    const cotisation = await prisma.cotisation.update({
      where: { id },
      data: {
        ...statutData,
        ...(modePaiement !== undefined ? { modePaiement: modePaiement?.trim() || null } : {}),
        ...(notes !== undefined ? { notes: notes?.trim() || null } : {}),
      },
      include: {
        scout: { select: { id: true, nom: true, prenom: true, brancheType: true, matricule: true, actif: true } },
        utilisateur: { select: { id: true, nom: true, prenom: true, role: true, brancheType: true, matricule: true, actif: true } },
        enregistrePar: { select: { id: true, nom: true, prenom: true, role: true } },
        collectePar: { select: { id: true, nom: true, prenom: true, role: true } },
      },
    })

    // Auditer tout changement de statut, mais aussi un complément de paiement
    // partiel qui laisse le statut à NON_A_JOUR (ex: 5000 puis 3000 FCFA de
    // plus) — sans quoi ce second mouvement d'argent ne laisserait aucune
    // trace, alors que c'est justement ce que `montantPaye` vise à tracer.
    const statutInchange = statut !== undefined && statut === existante.statut
    const montantInchange = statutInchange && montantPayeAudit === existante.montantPaye
    const collecteurInchange = statutInchange && collecteParAudit === existante.collecteParId
    if (statut !== undefined && !(montantInchange && collecteurInchange)) {
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
          utilisateurId: existante.utilisateurId,
          ancienMontantPaye: existante.montantPaye,
          montantPaye: montantPayeAudit,
          ancienCollecteParId: existante.collecteParId,
          collecteParId: collecteParAudit,
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
      details: {
        scoutId: existante.scoutId,
        utilisateurId: existante.utilisateurId,
        montant: existante.montant,
        anneeScolaire: existante.anneeScolaire,
      },
    })

    return NextResponse.json({ ok: true })
  } catch (error) {
    logger.error('DELETE /api/cotisations/[id]', error)
    return NextResponse.json({ erreur: 'Erreur serveur' }, { status: 500 })
  }
}
