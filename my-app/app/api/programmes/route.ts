import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { BrancheType } from '@/app/generated/prisma/client'
import { ROLES_GROUPE, ROLES_BRANCHE, ROLES_TOUT_STAFF as ROLES_LECTURE } from '@/lib/roles'
import { getBrancheUtilisateur, getBrancheDistrictUtilisateur } from '@/lib/brancheUtilisateur'
import { getParoissesDuDistrict } from '@/lib/district'
import { BrancheTypeSchema } from '@/lib/validation'
import { logger } from '@/lib/logger'
import { paroisseIdRequise } from '@/lib/session'

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return NextResponse.json({ erreur: 'Non authentifié' }, { status: 401 })
    if (!ROLES_LECTURE.includes(session.user.role)) return NextResponse.json({ erreur: 'Accès refusé' }, { status: 403 })
    const paroisseId = paroisseIdRequise(session)

    const { searchParams } = new URL(req.url)
    const branche = searchParams.get('branche') ?? undefined

    // Les responsables de branche ne voient QUE leur branche (+ les programmes
    // du groupe, brancheType null, qu'ils doivent aussi pouvoir consulter) —
    // toute valeur "branche" fournie par le client est ignorée pour ce rôle.
    let filtreBranche = branche
    if (ROLES_BRANCHE.includes(session.user.role)) {
      const bt = await getBrancheUtilisateur(session.user.id, paroisseId)
      // Compte mal configuré (rôle de branche sans brancheType assigné) :
      // aucun résultat plutôt que la paroisse entière par défaut.
      if (!bt) return NextResponse.json([])
      filtreBranche = bt
    }

    const programmes = await prisma.programme.findMany({
      where: {
        paroisseId,
        ...(filtreBranche
          ? { OR: [{ brancheType: filtreBranche as BrancheType }, { brancheType: null }] }
          : {}),
      },
      include: {
        _count: { select: { lignes: true } },
        creeParUtilisateur: { select: { prenom: true, nom: true } },
      },
      orderBy: { periodeDebut: 'desc' },
    })

    return NextResponse.json(programmes)
  } catch (error) {
    logger.error('GET /api/programmes', error)
    return NextResponse.json({ erreur: 'Erreur serveur' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return NextResponse.json({ erreur: 'Non authentifié' }, { status: 401 })

    const estGroupe = ROLES_GROUPE.includes(session.user.role)
    const estBranche = ROLES_BRANCHE.includes(session.user.role)
    const body = await req.json()
    const { titre, description, periodeDebut, periodeFin, brancheType, paroisseId: paroisseIdCorps } = body as {
      titre?: string
      description?: string
      periodeDebut?: string
      periodeFin?: string
      brancheType?: string
      paroisseId?: string
    }
    const estAssistantDistrict = session.user.roleDistrict === 'ASSISTANT_DISTRICT'
    const creationDistrict = estAssistantDistrict && !!paroisseIdCorps
    if (!estGroupe && !estBranche && !creationDistrict) return NextResponse.json({ erreur: 'Accès refusé' }, { status: 403 })

    if (!titre || !periodeDebut || !periodeFin) {
      return NextResponse.json({ erreur: 'Le titre et la période sont obligatoires' }, { status: 400 })
    }
    if (new Date(periodeFin) <= new Date(periodeDebut)) {
      return NextResponse.json({ erreur: 'La date de fin doit être après la date de début' }, { status: 400 })
    }
    if (brancheType != null && !BrancheTypeSchema.safeParse(brancheType).success) {
      return NextResponse.json({ erreur: 'Branche invalide' }, { status: 400 })
    }

    let paroisseId: string
    let brancheEffective: string | null = brancheType ?? null

    // La création via le district (choix de la paroisse cible) n'est utilisée
    // que par /district/ma-branche/programmes/nouveau, seule à envoyer
    // paroisseId dans le corps — un ASSISTANT_DISTRICT qui exerce par ailleurs
    // un rôle paroissial de groupe/branche crée normalement via l'autre
    // branche ci-dessous quand ce champ est absent (formulaire du tableau de bord).
    if (creationDistrict) {
      // Assistant au Commissaire de District chargé d'une branche : choisit la
      // paroisse cible parmi celles de son district, brancheType forcé à sa
      // branche — toute valeur envoyée par le client pour brancheType est ignorée.
      const bt = await getBrancheDistrictUtilisateur(session.user.id)
      if (!bt) return NextResponse.json({ erreur: 'Aucune branche assignée' }, { status: 403 })
      const { paroisses } = await getParoissesDuDistrict(paroisseIdRequise(session))
      const paroisseIds = paroisses.map((p) => p.id)
      if (!paroisseIds.includes(paroisseIdCorps)) {
        return NextResponse.json({ erreur: 'Paroisse invalide ou manquante' }, { status: 400 })
      }
      paroisseId = paroisseIdCorps
      brancheEffective = bt
    } else {
      paroisseId = paroisseIdRequise(session)
      // Un responsable de branche ne peut créer que le programme de sa propre branche
      if (estBranche) {
        const bt = await getBrancheUtilisateur(session.user.id, paroisseId)
        if (!bt) return NextResponse.json({ erreur: 'Aucune branche assignée' }, { status: 403 })
        brancheEffective = bt
      }
    }

    const programme = await prisma.programme.create({
      data: {
        titre,
        description: description ?? null,
        periodeDebut: new Date(periodeDebut),
        periodeFin: new Date(periodeFin),
        brancheType: (brancheEffective as BrancheType | null) ?? null,
        paroisseId,
        creePar: session.user.id,
      },
      include: {
        _count: { select: { lignes: true } },
      },
    })

    return NextResponse.json(programme, { status: 201 })
  } catch (error) {
    logger.error('POST /api/programmes', error)
    return NextResponse.json({ erreur: 'Erreur serveur' }, { status: 500 })
  }
}
