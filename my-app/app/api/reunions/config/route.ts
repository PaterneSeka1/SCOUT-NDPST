import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

const ROLES_CREATION = ['ADMIN_PAROISSE', 'CHEF_GROUPE']

export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return NextResponse.json({ erreur: 'Non authentifié' }, { status: 401 })

    const configs = await prisma.configReunionBranche.findMany({
      where: { paroisseId: session.user.paroisseId },
      orderBy: { brancheType: 'asc' },
    })

    return NextResponse.json(configs)
  } catch (error) {
    console.error('[GET /api/reunions/config]', error)
    return NextResponse.json({ erreur: 'Erreur serveur' }, { status: 500 })
  }
}

export async function PUT(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return NextResponse.json({ erreur: 'Non authentifié' }, { status: 401 })
    if (!ROLES_CREATION.includes(session.user.role)) return NextResponse.json({ erreur: 'Accès refusé' }, { status: 403 })

    const body = await req.json()
    const { brancheType, jourSemaine, heureDebut, dureeMinutes, lieu } = body as {
      brancheType: string
      jourSemaine: number
      heureDebut: string
      dureeMinutes?: number
      lieu?: string
    }

    if (!brancheType || jourSemaine === undefined || !heureDebut) {
      return NextResponse.json({ erreur: 'Champs requis manquants' }, { status: 400 })
    }

    const config = await prisma.configReunionBranche.upsert({
      where: { paroisseId_brancheType: { paroisseId: session.user.paroisseId, brancheType: brancheType as any } },
      create: {
        paroisseId: session.user.paroisseId,
        brancheType: brancheType as any,
        jourSemaine,
        heureDebut,
        dureeMinutes: dureeMinutes ?? 90,
        lieu: lieu ?? null,
      },
      update: {
        jourSemaine,
        heureDebut,
        dureeMinutes: dureeMinutes ?? 90,
        lieu: lieu ?? null,
      },
    })

    return NextResponse.json(config)
  } catch (error) {
    console.error('[PUT /api/reunions/config]', error)
    return NextResponse.json({ erreur: 'Erreur serveur' }, { status: 500 })
  }
}
