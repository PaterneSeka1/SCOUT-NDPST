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
          presencesReunion: {
            include: {
              jourReunion: {
                select: { id: true, titre: true, dateHeure: true, dateReportee: true, brancheType: true },
              },
            },
            orderBy: { jourReunion: { dateHeure: 'desc' } },
            take: 8,
          },
          _count: { select: { presences: true, presencesReunion: true } },
        },
      },
    },
  })

  const enfants = liens.map((l) => l.scout)

  // Responsables de chaque branche représentée
  const branches = [...new Set(enfants.map((s) => s.brancheType))]
  const responsables = await prisma.posteBranche.findMany({
    where: {
      paroisseId: session.user.paroisseId ?? undefined,
      brancheType: { in: branches as never[] },
    },
    include: {
      utilisateur: {
        select: { id: true, prenom: true, nom: true, telephone: true, email: true, role: true },
      },
    },
    orderBy: { role: 'asc' },
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

  // Prochaines réunions
  const prochinesReunions = await prisma.jourReunion.findMany({
    where: {
      paroisseId: session.user.paroisseId ?? undefined,
      statut: { in: ['PLANIFIEE', 'REPORTEE'] },
      dateHeure: { gte: new Date() },
      ...(branches.length > 0 ? { brancheType: { in: branches as never[] } } : {}),
    },
    orderBy: { dateHeure: 'asc' },
    take: 5,
    select: { id: true, titre: true, dateHeure: true, dateReportee: true, lieu: true, brancheType: true },
  })

  return NextResponse.json({ enfants, prochaines, prochinesReunions, responsables })
}
