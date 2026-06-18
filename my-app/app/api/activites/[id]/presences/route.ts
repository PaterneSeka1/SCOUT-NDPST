import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
  }

  const { id } = await params

  const activite = await prisma.activite.findFirst({
    where: { id, paroisseId: session.user.paroisseId },
  })

  if (!activite) {
    return NextResponse.json({ error: 'Activité introuvable' }, { status: 404 })
  }

  const presences = await prisma.presence.findMany({
    where: { activiteId: id },
    include: {
      scout: {
        select: {
          id: true,
          nom: true,
          prenom: true,
          numeroAdhesion: true,
          brancheType: true,
        },
      },
    },
  })

  // Si aucune présence n'existe encore, retourner tous les scouts de la branche concernée
  if (presences.length === 0) {
    const whereScout: Record<string, unknown> = {
      paroisseId: session.user.paroisseId,
    }
    if (activite.brancheType) {
      whereScout.brancheType = activite.brancheType
    }

    const scouts = await prisma.scout.findMany({
      where: whereScout,
      select: {
        id: true,
        nom: true,
        prenom: true,
        numeroAdhesion: true,
        brancheType: true,
      },
      orderBy: [{ nom: 'asc' }, { prenom: 'asc' }],
    })

    return NextResponse.json(
      scouts.map((scout) => ({
        id: null,
        present: false,
        commentaire: null,
        scout,
      }))
    )
  }

  return NextResponse.json(presences)
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
  }

  const { id } = await params

  const activite = await prisma.activite.findFirst({
    where: { id, paroisseId: session.user.paroisseId },
  })

  if (!activite) {
    return NextResponse.json({ error: 'Activité introuvable' }, { status: 404 })
  }

  const corps = await request.json()
  const { presences } = corps as {
    presences: Array<{ scoutId: string; present: boolean; commentaire?: string }>
  }

  if (!Array.isArray(presences)) {
    return NextResponse.json({ error: 'Format invalide' }, { status: 400 })
  }

  // Upsert chaque présence
  const resultats = await Promise.all(
    presences.map((p) =>
      prisma.presence.upsert({
        where: { scoutId_activiteId: { scoutId: p.scoutId, activiteId: id } },
        update: { present: p.present, commentaire: p.commentaire ?? null },
        create: {
          scoutId: p.scoutId,
          activiteId: id,
          present: p.present,
          commentaire: p.commentaire ?? null,
        },
      })
    )
  )

  return NextResponse.json({ enregistrees: resultats.length })
}
