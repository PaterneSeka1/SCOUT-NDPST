import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { ROLES_GROUPE, ROLES_BRANCHE, ROLES_TOUT_STAFF as ROLES_LECTURE } from '@/lib/roles'
import { getBrancheUtilisateur } from '@/lib/brancheUtilisateur'
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
    const statut = searchParams.get('statut') ?? undefined

    // Les responsables de branche ne voient QUE leur branche — on ignore
    // délibérément toute valeur de "branche" fournie par le client pour ce
    // groupe de rôles, sinon un simple `?branche=AUTRE` dans l'URL suffirait
    // à contourner la restriction.
    let filtreBranche = branche
    if (ROLES_BRANCHE.includes(session.user.role)) {
      const bt = await getBrancheUtilisateur(session.user.id, paroisseId)
      // Compte mal configuré (rôle de branche sans brancheType assigné) :
      // aucun résultat plutôt que la paroisse entière par défaut.
      if (!bt) return NextResponse.json([])
      filtreBranche = bt
    }

    const reunions = await prisma.jourReunion.findMany({
      where: {
        paroisseId,
        ...(filtreBranche ? { brancheType: filtreBranche as any } : {}),
        ...(statut ? { statut: statut as any } : {}),
      },
      include: {
        _count: { select: { presences: true } },
        creeParUtilisateur: { select: { prenom: true, nom: true } },
      },
      orderBy: { dateHeure: 'asc' },
    })

    return NextResponse.json(reunions)
  } catch (error) {
    logger.error('GET /api/reunions', error)
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
    const paroisseId = paroisseIdRequise(session)

    const body = await req.json()
    const { dates, brancheType, titre, lieu, dureeMinutes, notes } = body as {
      dates: string[]
      brancheType?: string
      titre?: string
      lieu?: string
      dureeMinutes?: number
      notes?: string
    }

    if (!dates?.length) return NextResponse.json({ erreur: 'Au moins une date est requise' }, { status: 400 })
    if (dates.length > 60) return NextResponse.json({ erreur: 'Maximum 60 réunions par création en série' }, { status: 400 })
    if (brancheType != null && !BrancheTypeSchema.safeParse(brancheType).success) {
      return NextResponse.json({ erreur: 'Branche invalide' }, { status: 400 })
    }

    // Un chef de branche ne peut créer que pour sa propre branche
    let brancheEffective: string | null = brancheType ?? null
    if (estBranche) {
      const bt = await getBrancheUtilisateur(session.user.id, paroisseId)
      if (!bt) return NextResponse.json({ erreur: 'Aucune branche assignée' }, { status: 403 })
      brancheEffective = bt
    }

    const created = await prisma.$transaction(
      dates.map((d) =>
        prisma.jourReunion.create({
          data: {
            paroisseId,
            creePar: session.user.id,
            dateHeure: new Date(d),
            brancheType: brancheEffective as any ?? null,
            titre: titre ?? null,
            lieu: lieu ?? null,
            dureeMinutes: dureeMinutes ?? null,
            notes: notes ?? null,
          },
        })
      )
    )

    return NextResponse.json(created, { status: 201 })
  } catch (error) {
    logger.error('POST /api/reunions', error)
    return NextResponse.json({ erreur: 'Erreur serveur' }, { status: 500 })
  }
}
