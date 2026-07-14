import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { ROLES_PLATEFORME, ROLES_TOUT_STAFF } from '@/lib/roles'
import { STATUTS_COTISATION_A_FINALISER } from '@/lib/cotisations'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ erreur: 'Non authentifié' }, { status: 401 })
  if (!ROLES_PLATEFORME.includes(session.user.role)) {
    return NextResponse.json({ erreur: 'Accès refusé' }, { status: 403 })
  }

  // Une activité pas encore passée ne doit pas compter dans un rapport
  // (rétrospectif par nature) — seul le décompte des activités est concerné
  // ici, scouts/utilisateurs/cotisations n'ont pas de notion de date future.
  const maintenant = new Date()
  const debutMois = new Date(maintenant.getFullYear(), maintenant.getMonth(), 1)
  const finMois = new Date(maintenant.getFullYear(), maintenant.getMonth() + 1, 0, 23, 59, 59)

  const [paroisses, activitesMois, totalPresences, presencesPositives, cotisationsParStatut, utilisateursParRole] =
    await Promise.all([
      prisma.paroisse.findMany({
        include: {
          _count: {
            select: {
              scouts: true,
              utilisateurs: true,
              activites: { where: { dateDebut: { lte: maintenant } } },
              cotisations: true,
            },
          },
        },
        orderBy: { nom: 'asc' },
      }),
      prisma.activite.count({ where: { dateDebut: { gte: debutMois, lte: finMois } } }),
      prisma.presence.count(),
      prisma.presence.count({ where: { present: true } }),
      prisma.cotisation.groupBy({ by: ['statut'], _sum: { montant: true } }),
      prisma.utilisateur.groupBy({ by: ['role'], where: { paroisseId: { not: null } }, _count: { _all: true } }),
    ])

  const totaux = paroisses.reduce(
    (acc, p) => ({
      paroisses: acc.paroisses + 1,
      paroissesActives: acc.paroissesActives + (p.actif ? 1 : 0),
      scouts: acc.scouts + p._count.scouts,
      utilisateurs: acc.utilisateurs + p._count.utilisateurs,
      activites: acc.activites + p._count.activites,
    }),
    { paroisses: 0, paroissesActives: 0, scouts: 0, utilisateurs: 0, activites: 0 },
  )

  const tauxPresence = totalPresences > 0 ? Math.round((presencesPositives / totalPresences) * 100) : 0

  const montantParStatut = (statut: string) =>
    cotisationsParStatut.find((c) => c.statut === statut)?._sum.montant ?? 0
  const cotisationsAFinaliser = STATUTS_COTISATION_A_FINALISER.reduce((somme, statut) => somme + montantParStatut(statut), 0)

  const staff = utilisateursParRole
    .filter((u) => ROLES_TOUT_STAFF.includes(u.role))
    .reduce((somme, u) => somme + u._count._all, 0)
  const parents = utilisateursParRole.find((u) => u.role === 'PARENT')?._count._all ?? 0
  const comptesScouts = utilisateursParRole.find((u) => u.role === 'SCOUT')?._count._all ?? 0

  return NextResponse.json({
    totaux,
    kpis: {
      activitesMois,
      tauxPresence,
      cotisationsPayees: montantParStatut('PAYEE'),
      cotisationsEnAttente: cotisationsAFinaliser,
      utilisateursParCategorie: { staff, parents, comptesScouts },
    },
    paroisses: paroisses.map((p) => ({
      id: p.id,
      nom: p.nom,
      ville: p.ville,
      actif: p.actif,
      scouts: p._count.scouts,
      utilisateurs: p._count.utilisateurs,
      activites: p._count.activites,
      cotisations: p._count.cotisations,
    })),
  })
}
