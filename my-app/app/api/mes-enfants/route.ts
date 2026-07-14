import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { ROLES_BRANCHE } from '@/lib/roles'
import { RoleUtilisateur } from '@/app/generated/prisma/client'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ erreur: 'Non autorisé' }, { status: 401 })

  const utilisateur = await prisma.utilisateur.findUnique({
    where: { id: session.user.id },
    select: { id: true },
  })
  if (!utilisateur) return NextResponse.json({ erreur: 'Utilisateur introuvable' }, { status: 404 })
  if (!session.user.paroisseId) return NextResponse.json({ erreur: 'Accès refusé' }, { status: 403 })

  const paroisseId = session.user.paroisseId

  const liens = await prisma.lienParentScout.findMany({
    where: { parentId: utilisateur.id, scout: { paroisseId } },
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
          cotisations: {
            orderBy: [{ statut: 'asc' }, { anneeScolaire: 'desc' }],
            select: { id: true, type: true, libelle: true, montant: true, anneeScolaire: true, statut: true, datePaiement: true },
          },
        },
      },
    },
  })

  const enfants = liens.map((l) => l.scout)

  // Responsables de chaque branche représentée
  const branches = [...new Set(enfants.map((s) => s.brancheType))]

  // Camps à venir concernant chaque enfant, avec le statut de signature (fiche médicale + autorisation)
  const campsAVenir = await prisma.activite.findMany({
    where: {
      paroisseId,
      type: 'CAMP',
      dateDebut: { gte: new Date() },
      OR: [{ brancheType: null }, { brancheType: { in: branches as never[] } }],
    },
    orderBy: { dateDebut: 'asc' },
    select: {
      id: true, titre: true, dateDebut: true, lieu: true, brancheType: true,
      autorisationsCamp: {
        where: { scoutId: { in: enfants.map((s) => s.id) } },
        select: { scoutId: true, type: true, confirmeLe: true },
      },
    },
  })

  const campsParEnfant: Record<string, unknown[]> = {}
  for (const enfant of enfants) {
    campsParEnfant[enfant.id] = campsAVenir
      .filter((c) => !c.brancheType || c.brancheType === enfant.brancheType)
      .map((c) => {
        const confirmee = (type: string) =>
          c.autorisationsCamp.some((a) => a.scoutId === enfant.id && a.type === type && a.confirmeLe !== null)
        return {
          id: c.id, titre: c.titre, dateDebut: c.dateDebut, lieu: c.lieu,
          ficheMedicale: confirmee('FICHE_MEDICALE'),
          autorisationParentale: confirmee('AUTORISATION_PARENTALE'),
        }
      })
  }

  const responsablesUtilisateurs = await prisma.utilisateur.findMany({
    where: {
      paroisseId,
      brancheType: { in: branches as never[] },
      role: { in: ROLES_BRANCHE as RoleUtilisateur[] },
    },
    select: { id: true, nom: true, prenom: true, telephone: true, email: true, role: true, brancheType: true },
    orderBy: { role: 'asc' },
  })

  const responsables = responsablesUtilisateurs.map((u) => ({
    id: u.id,
    brancheType: u.brancheType,
    role: u.role,
    utilisateur: { id: u.id, prenom: u.prenom, nom: u.nom, telephone: u.telephone, email: u.email, role: u.role },
  }))

  // Prochaines activités de la paroisse
  const prochaines = await prisma.activite.findMany({
    where: {
      paroisseId,
      dateDebut: { gte: new Date() },
    },
    orderBy: { dateDebut: 'asc' },
    take: 5,
    select: { id: true, titre: true, dateDebut: true, lieu: true, type: true, brancheType: true },
  })

  // Prochaines réunions
  const prochinesReunions = await prisma.jourReunion.findMany({
    where: {
      paroisseId,
      statut: { in: ['PLANIFIEE', 'REPORTEE'] },
      dateHeure: { gte: new Date() },
      ...(branches.length > 0 ? { OR: [{ brancheType: null }, { brancheType: { in: branches as never[] } }] } : {}),
    },
    orderBy: { dateHeure: 'asc' },
    take: 5,
    select: { id: true, titre: true, dateHeure: true, dateReportee: true, lieu: true, brancheType: true },
  })

  return NextResponse.json({ enfants, prochaines, prochinesReunions, responsables, campsParEnfant })
}
