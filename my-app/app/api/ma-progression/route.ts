import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ erreur: 'Non autorisé' }, { status: 401 })

  // Le scout est lié à un utilisateur
  const scout = await prisma.scout.findFirst({
    where: { utilisateurId: session.user.id },
    include: {
      progressions: {
        include: {
          badge: true,
          validePar: { select: { nom: true, prenom: true } },
        },
        orderBy: { dateValidation: 'desc' },
      },
      presences: {
        include: { activite: { select: { id: true, titre: true, dateDebut: true, type: true } } },
        orderBy: { activite: { dateDebut: 'desc' } },
        take: 10,
      },
      _count: { select: { presences: true } },
    },
  })

  if (!scout) return NextResponse.json({ erreur: 'Aucun profil scout associé à ce compte' }, { status: 404 })

  // Tous les badges de la branche pour calculer la progression
  const badgesBranche = await prisma.badge.findMany({
    where: { brancheType: scout.brancheType },
    orderBy: { ordre: 'asc' },
  })

  return NextResponse.json({ scout, badgesBranche })
}
