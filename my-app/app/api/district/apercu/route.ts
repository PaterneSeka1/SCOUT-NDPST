import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { ROLES_DISTRICT_ETENDU } from '@/lib/roles'
import { paroisseIdRequise } from '@/lib/session'
import { getParoissesDuDistrict, DistrictInvalideError } from '@/lib/district'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ erreur: 'Non authentifié' }, { status: 401 })
  if (!session.user.roleDistrict || !ROLES_DISTRICT_ETENDU.includes(session.user.roleDistrict)) {
    return NextResponse.json({ erreur: 'Accès refusé' }, { status: 403 })
  }

  // Un ASSISTANT_DISTRICT chargé d'une branche précise n'a besoin que des
  // données de sa branche (voir /api/district/ma-branche), jamais de la vue
  // d'ensemble multi-branches de tout le district.
  if (session.user.roleDistrict === 'ASSISTANT_DISTRICT') {
    const utilisateur = await prisma.utilisateur.findUnique({ where: { id: session.user.id }, select: { brancheTypeDistrict: true } })
    if (utilisateur?.brancheTypeDistrict) return NextResponse.json({ erreur: 'Accès refusé' }, { status: 403 })
  }

  const paroisseId = paroisseIdRequise(session)

  let nomDistrict: string
  let idsParoisses: string[]
  try {
    const district = await getParoissesDuDistrict(paroisseId)
    nomDistrict = district.nomDistrict
    idsParoisses = district.paroisses.map((p) => p.id)
  } catch (error) {
    if (error instanceof DistrictInvalideError) {
      return NextResponse.json({ erreur: error.message }, { status: 400 })
    }
    throw error
  }

  const maintenant = new Date()
  const debutMois = new Date(maintenant.getFullYear(), maintenant.getMonth(), 1)

  const [paroisses, activitesMois] = await Promise.all([
    prisma.paroisse.findMany({
      where: { id: { in: idsParoisses } },
      select: {
        id: true,
        nom: true,
        ville: true,
        actif: true,
        _count: {
          select: {
            scouts: true,
            utilisateurs: true,
          },
        },
        utilisateurs: {
          where: { role: 'CHEF_GROUPE' },
          select: { nom: true, prenom: true },
          take: 1,
          orderBy: { createdAt: 'asc' },
        },
      },
      orderBy: { nom: 'asc' },
    }),
    prisma.activite.count({
      where: { paroisseId: { in: idsParoisses }, dateDebut: { gte: debutMois, lte: maintenant } },
    }),
  ])

  const totaux = paroisses.reduce(
    (acc, p) => ({
      paroisses: acc.paroisses + 1,
      paroissesActives: acc.paroissesActives + (p.actif ? 1 : 0),
      scouts: acc.scouts + p._count.scouts,
      utilisateurs: acc.utilisateurs + p._count.utilisateurs,
    }),
    { paroisses: 0, paroissesActives: 0, scouts: 0, utilisateurs: 0 },
  )

  return NextResponse.json({
    nomDistrict,
    totaux: { ...totaux, activitesMois },
    paroisses: paroisses.map((p) => ({
      id: p.id,
      nom: p.nom,
      ville: p.ville,
      actif: p.actif,
      scouts: p._count.scouts,
      utilisateurs: p._count.utilisateurs,
      chefGroupe: p.utilisateurs[0] ?? null,
    })),
  })
}
