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
    include: {
      _count: { select: { presences: true } },
    },
  })

  if (!activite) {
    return NextResponse.json({ error: 'Activité introuvable' }, { status: 404 })
  }

  return NextResponse.json(activite)
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
  }

  const { id } = await params

  const existante = await prisma.activite.findFirst({
    where: { id, paroisseId: session.user.paroisseId },
  })

  if (!existante) {
    return NextResponse.json({ error: 'Activité introuvable' }, { status: 404 })
  }

  const corps = await request.json()
  const { titre, description, dateDebut, dateFin, lieu, type, brancheType } = corps

  const activite = await prisma.activite.update({
    where: { id },
    data: {
      ...(titre !== undefined && { titre }),
      ...(description !== undefined && { description }),
      ...(dateDebut !== undefined && { dateDebut: new Date(dateDebut) }),
      ...(dateFin !== undefined && { dateFin: dateFin ? new Date(dateFin) : null }),
      ...(lieu !== undefined && { lieu }),
      ...(type !== undefined && { type }),
      ...(brancheType !== undefined && { brancheType: brancheType || null }),
    },
    include: {
      _count: { select: { presences: true } },
    },
  })

  return NextResponse.json(activite)
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
  }

  const { id } = await params

  const existante = await prisma.activite.findFirst({
    where: { id, paroisseId: session.user.paroisseId },
  })

  if (!existante) {
    return NextResponse.json({ error: 'Activité introuvable' }, { status: 404 })
  }

  const peutSupprimer =
    existante.creePar === session.user.id || session.user.role === 'ADMIN_PAROISSE'

  if (!peutSupprimer) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 403 })
  }

  await prisma.activite.delete({ where: { id } })

  return NextResponse.json({ message: 'Activité supprimée' })
}
