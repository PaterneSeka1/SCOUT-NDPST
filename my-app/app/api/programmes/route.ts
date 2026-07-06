import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { BrancheType } from '@/app/generated/prisma/client'
import { ROLES_GROUPE, ROLES_BRANCHE, ROLES_TOUT_STAFF as ROLES_LECTURE } from '@/lib/roles'
import { BrancheTypeSchema } from '@/lib/validation'
import { logger } from '@/lib/logger'

async function getBrancheUtilisateur(userId: string, paroisseId: string) {
  const poste = await prisma.posteBranche.findFirst({
    where: { utilisateurId: userId, paroisseId },
    select: { brancheType: true },
    orderBy: { createdAt: 'asc' },
  })
  return poste?.brancheType ?? null
}

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return NextResponse.json({ erreur: 'Non authentifié' }, { status: 401 })
    if (!ROLES_LECTURE.includes(session.user.role)) return NextResponse.json({ erreur: 'Accès refusé' }, { status: 403 })

    const { searchParams } = new URL(req.url)
    const branche = searchParams.get('branche') ?? undefined

    // Les responsables de branche ne voient que leur branche par défaut
    let filtreBranche = branche
    if (ROLES_BRANCHE.includes(session.user.role) && !branche) {
      const bt = await getBrancheUtilisateur(session.user.id, session.user.paroisseId)
      if (bt) filtreBranche = bt
    }

    const programmes = await prisma.programme.findMany({
      where: {
        paroisseId: session.user.paroisseId,
        ...(filtreBranche ? { brancheType: filtreBranche as BrancheType } : {}),
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
    if (!estGroupe && !estBranche) return NextResponse.json({ erreur: 'Accès refusé' }, { status: 403 })

    const body = await req.json()
    const { titre, description, periodeDebut, periodeFin, brancheType } = body as {
      titre?: string
      description?: string
      periodeDebut?: string
      periodeFin?: string
      brancheType?: string
    }

    if (!titre || !periodeDebut || !periodeFin) {
      return NextResponse.json({ erreur: 'Le titre et la période sont obligatoires' }, { status: 400 })
    }
    if (new Date(periodeFin) <= new Date(periodeDebut)) {
      return NextResponse.json({ erreur: 'La date de fin doit être après la date de début' }, { status: 400 })
    }
    if (brancheType != null && !BrancheTypeSchema.safeParse(brancheType).success) {
      return NextResponse.json({ erreur: 'Branche invalide' }, { status: 400 })
    }

    // Un responsable de branche ne peut créer que le programme de sa propre branche
    let brancheEffective: string | null = brancheType ?? null
    if (estBranche) {
      const bt = await getBrancheUtilisateur(session.user.id, session.user.paroisseId)
      if (!bt) return NextResponse.json({ erreur: 'Aucune branche assignée' }, { status: 403 })
      brancheEffective = bt
    }

    const programme = await prisma.programme.create({
      data: {
        titre,
        description: description ?? null,
        periodeDebut: new Date(periodeDebut),
        periodeFin: new Date(periodeFin),
        brancheType: (brancheEffective as BrancheType | null) ?? null,
        paroisseId: session.user.paroisseId,
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
