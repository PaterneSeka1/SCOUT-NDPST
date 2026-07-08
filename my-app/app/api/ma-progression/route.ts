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

  // Prochaines activités concernant la branche du scout ou toute la paroisse
  const prochainesActivites = await prisma.activite.findMany({
    where: {
      paroisseId: scout.paroisseId,
      dateDebut: { gte: new Date() },
      OR: [{ brancheType: null }, { brancheType: scout.brancheType }],
    },
    orderBy: { dateDebut: 'asc' },
    take: 5,
    select: { id: true, titre: true, dateDebut: true, lieu: true, type: true, brancheType: true },
  })

  // Dernières réunions (présences)
  const dernieresReunions = await prisma.presenceReunion.findMany({
    where: { scoutId: scout.id },
    include: {
      jourReunion: {
        select: { id: true, titre: true, dateHeure: true, dateReportee: true, brancheType: true },
      },
    },
    orderBy: { jourReunion: { dateHeure: 'desc' } },
    take: 10,
  })

  return NextResponse.json({ scout, badgesBranche, prochainesActivites, dernieresReunions })
}
