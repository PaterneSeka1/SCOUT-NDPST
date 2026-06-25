import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ erreur: 'Non autorisé' }, { status: 401 })

  const utilisateur = await prisma.utilisateur.findUnique({
    where: { id: session.user.id },
    select: { id: true },
  })
  if (!utilisateur) return NextResponse.json({ erreur: 'Utilisateur introuvable' }, { status: 404 })

  const liens = await prisma.lienParentScout.findMany({
    where: { parentId: utilisateur.id },
    include: {
      scout: {
        include: {
          presences: {
            include: { activite: { select: { titre: true, dateDebut: true, type: true } } },
            orderBy: { activite: { dateDebut: 'desc' } },
            take: 5,
          },
          _count: { select: { presences: true } },
        },
      },
    },
  })

  // Prochaines activités de la paroisse
  const prochaines = await prisma.activite.findMany({
    where: {
      paroisseId: session.user.paroisseId ?? undefined,
      dateDebut: { gte: new Date() },
    },
    orderBy: { dateDebut: 'asc' },
    take: 5,
    select: { id: true, titre: true, dateDebut: true, lieu: true, type: true, brancheType: true },
  })

  return NextResponse.json({ enfants: liens.map((l) => l.scout), prochaines })
}
