import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { Prisma, BrancheType, StatutCotisation } from '@/app/generated/prisma/client'
import { ROLES_TOUT_STAFF, ROLES_BRANCHE } from '@/lib/roles'
import { getBrancheUtilisateur } from '@/lib/brancheUtilisateur'
import { anneeScolaireCourante } from '@/lib/cotisations'
import { ENTETE_COTISATION_CSV, ligneCotisationCsv } from '@/lib/cotisationsExport'
import { dateFichier, reponseCsv } from '@/lib/csv'
import { logger } from '@/lib/logger'
import { enregistrerAudit } from '@/lib/audit'
import { paroisseIdRequise } from '@/lib/session'

// Export CSV des droits d'adhésion de la paroisse — mêmes filtres et même
// isolation par branche que GET /api/cotisations (voir ce fichier pour le
// détail des règles de visibilité par rôle).
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return NextResponse.json({ erreur: 'Non authentifié' }, { status: 401 })
    if (!ROLES_TOUT_STAFF.includes(session.user.role)) {
      return NextResponse.json({ erreur: 'Accès refusé' }, { status: 403 })
    }
    const paroisseId = paroisseIdRequise(session)

    const { searchParams } = new URL(req.url)
    const anneeScolaire = searchParams.get('anneeScolaire') ?? anneeScolaireCourante()
    const statuts = searchParams.getAll('statut')
    const brancheParam = searchParams.get('branche') ?? undefined

    let filtreBranche = brancheParam
    if (ROLES_BRANCHE.includes(session.user.role)) {
      const bt = await getBrancheUtilisateur(session.user.id, paroisseId)
      if (!bt) return reponseCsv(`droits-adhesion_${anneeScolaire}_${dateFichier()}.csv`, [ENTETE_COTISATION_CSV])
      filtreBranche = bt
    }

    if (statuts.some((s) => !(s in StatutCotisation))) {
      return NextResponse.json({ erreur: 'Statut invalide' }, { status: 400 })
    }
    if (filtreBranche !== undefined && !(filtreBranche in BrancheType)) {
      return NextResponse.json({ erreur: 'Branche invalide' }, { status: 400 })
    }

    const where: Prisma.CotisationWhereInput = {
      paroisseId,
      anneeScolaire,
      ...(statuts.length ? { statut: { in: statuts as StatutCotisation[] } } : {}),
      ...(filtreBranche
        ? {
            OR: [
              { scout: { brancheType: filtreBranche as BrancheType } },
              { utilisateur: { brancheType: filtreBranche as BrancheType } },
            ],
          }
        : {}),
    }

    const cotisations = await prisma.cotisation.findMany({
      where,
      select: {
        type: true,
        libelle: true,
        montant: true,
        montantPaye: true,
        anneeScolaire: true,
        statut: true,
        datePaiement: true,
        modePaiement: true,
        scout: { select: { nom: true, prenom: true, matricule: true, brancheType: true } },
        utilisateur: { select: { nom: true, prenom: true, matricule: true, role: true, brancheType: true } },
        collectePar: { select: { nom: true, prenom: true, role: true } },
        enregistrePar: { select: { nom: true, prenom: true, role: true } },
      },
      orderBy: [{ statut: 'asc' }, { createdAt: 'desc' }],
    })

    await enregistrerAudit({
      paroisseId,
      acteurId: session.user.id,
      action: 'COTISATIONS_EXPORTEES',
      entite: 'Cotisation',
      entiteId: null,
      details: { anneeScolaire, branche: filtreBranche ?? null, statuts },
    })

    return reponseCsv(`droits-adhesion_${anneeScolaire}_${dateFichier()}.csv`, [
      ENTETE_COTISATION_CSV,
      ...cotisations.map(ligneCotisationCsv),
    ])
  } catch (error) {
    logger.error('GET /api/cotisations/export', error)
    return NextResponse.json({ erreur: 'Erreur serveur' }, { status: 500 })
  }
}
