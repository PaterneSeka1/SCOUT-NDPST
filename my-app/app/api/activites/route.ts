import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const page = parseInt(searchParams.get('page') ?? '1')
  const limite = 20
  const decalage = (page - 1) * limite
  const recherche = searchParams.get('recherche') ?? ''
  const type = searchParams.get('type') ?? ''
  const brancheType = searchParams.get('brancheType') ?? ''

  const where: Record<string, unknown> = {
    paroisseId: session.user.paroisseId,
  }

  if (recherche) {
    where.OR = [
      { titre: { contains: recherche, mode: 'insensitive' } },
      { lieu: { contains: recherche, mode: 'insensitive' } },
    ]
  }
  if (type) where.type = type
  if (brancheType) where.brancheType = brancheType

  const [activites, total] = await Promise.all([
    prisma.activite.findMany({
      where,
      include: {
        _count: { select: { presences: true } },
      },
      orderBy: { dateDebut: 'desc' },
      skip: decalage,
      take: limite,
    }),
    prisma.activite.count({ where }),
  ])

  return NextResponse.json({
    activites,
    pagination: {
      page,
      limite,
      total,
      totalPages: Math.ceil(total / limite),
    },
  })
}

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
  }

  const corps = await request.json()
  const { titre, description, dateDebut, dateFin, lieu, type, brancheType } = corps

  if (!titre || !dateDebut) {
    return NextResponse.json({ error: 'Le titre et la date de début sont obligatoires' }, { status: 400 })
  }

  const activite = await prisma.activite.create({
    data: {
      titre,
      description: description ?? null,
      dateDebut: new Date(dateDebut),
      dateFin: dateFin ? new Date(dateFin) : null,
      lieu: lieu ?? null,
      type: type ?? 'REUNION',
      brancheType: brancheType ?? null,
      paroisseId: session.user.paroisseId,
      creePar: session.user.id,
    },
    include: {
      _count: { select: { presences: true } },
    },
  })

  return NextResponse.json(activite, { status: 201 })
}
