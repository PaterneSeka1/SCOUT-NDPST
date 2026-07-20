import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { BrancheType, Prisma } from '@/app/generated/prisma/client'
import { ROLES_TOUT_STAFF, ROLES_BRANCHE } from '@/lib/roles'
import { getBrancheUtilisateur } from '@/lib/brancheUtilisateur'
import { paroisseIdRequise } from '@/lib/session'
import { logger } from '@/lib/logger'
import { calculerAvancementDepuisBrut } from '@/lib/parcoursCompagnon'

// GET — liste des scouts de la paroisse avec leur parcours de progression
// individuelle (branche Compagnons) le cas échéant. Même patron de périmètre
// que GET /api/scouts : paroisse de l'appelant, branche verrouillée pour les
// rôles de branche. Volontairement paroisse-scopé pour l'instant, comme
// /api/scouts — une vue district/plateforme viendrait sous /api/district ou
// /api/admin si besoin, pas ici.
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ erreur: 'Non authentifié' }, { status: 401 })
    }
    if (!ROLES_TOUT_STAFF.includes(session.user.role)) {
      return NextResponse.json({ erreur: 'Accès refusé' }, { status: 403 })
    }

    const paroisseId = paroisseIdRequise(session)
    const { searchParams } = new URL(request.url)
    const recherche = searchParams.get('recherche') ?? undefined

    // Les responsables de branche ne voient QUE leur branche — toute valeur
    // "branche" fournie par le client est ignorée pour ce groupe de rôles
    // (même règle que GET /api/scouts).
    let branche = searchParams.get('branche') ?? undefined
    if (ROLES_BRANCHE.includes(session.user.role)) {
      const bt = await getBrancheUtilisateur(session.user.id, paroisseId)
      if (!bt) return NextResponse.json({ scouts: [] })
      branche = bt
    }
    if (branche !== undefined && !(branche in BrancheType)) {
      return NextResponse.json({ erreur: 'Branche invalide' }, { status: 400 })
    }

    const where: Prisma.ScoutWhereInput = {
      paroisseId,
      ...(branche ? { brancheType: branche as BrancheType } : {}),
      ...(recherche
        ? {
            OR: [
              { nom: { contains: recherche, mode: 'insensitive' } },
              { prenom: { contains: recherche, mode: 'insensitive' } },
              { matricule: { contains: recherche, mode: 'insensitive' } },
            ],
          }
        : {}),
    }

    const scouts = await prisma.scout.findMany({
      where,
      select: {
        id: true,
        nom: true,
        prenom: true,
        dateNaissance: true,
        brancheType: true,
        matricule: true,
        actif: true,
        parcoursCompagnon: {
          include: {
            progressions: {
              include: {
                etapeActivite: true,
              },
            },
          },
        },
      },
      orderBy: [{ nom: 'asc' }, { prenom: 'asc' }],
    })

    const maintenant = new Date()
    const resultat = scouts.map(({ parcoursCompagnon, ...scoutInfo }) => {
      if (!parcoursCompagnon) {
        return { scout: scoutInfo, parcours: null, avancement: null }
      }

      const avancement = calculerAvancementDepuisBrut(parcoursCompagnon.progressions, maintenant)

      return {
        scout: scoutInfo,
        parcours: {
          id: parcoursCompagnon.id,
          trancheAge: parcoursCompagnon.trancheAge,
          statut: parcoursCompagnon.statut,
          dateFinPrevue: parcoursCompagnon.dateFinPrevue,
          ageEntree: parcoursCompagnon.ageEntree,
        },
        avancement,
      }
    })

    return NextResponse.json({ scouts: resultat })
  } catch (error) {
    logger.error('GET /api/parcours-compagnon', error)
    return NextResponse.json({ erreur: 'Erreur serveur' }, { status: 500 })
  }
}
