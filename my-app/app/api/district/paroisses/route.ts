import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { ROLES_DISTRICT_ETENDU } from '@/lib/roles'
import { paroisseIdRequise } from '@/lib/session'
import { getParoissesDuDistrict, DistrictInvalideError } from '@/lib/district'
import { logger } from '@/lib/logger'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ erreur: 'Non authentifié' }, { status: 401 })
  if (!ROLES_DISTRICT_ETENDU.includes(session.user.role)) {
    return NextResponse.json({ erreur: 'Accès refusé' }, { status: 403 })
  }

  try {
    const paroisseId = paroisseIdRequise(session)
    const { paroisses } = await getParoissesDuDistrict(paroisseId)
    const paroisseIds = paroisses.map((p) => p.id)

    const [chefsGroupe, effectifs] = await Promise.all([
      prisma.utilisateur.findMany({
        where: { paroisseId: { in: paroisseIds }, role: 'CHEF_GROUPE' },
        select: { id: true, nom: true, prenom: true, matricule: true, telephone: true, email: true, paroisseId: true },
        orderBy: { createdAt: 'asc' },
      }),
      prisma.scout.groupBy({
        by: ['paroisseId', 'brancheType'],
        where: { paroisseId: { in: paroisseIds }, actif: true },
        _count: { id: true },
      }),
    ])

    // Un seul CHEF_GROUPE par paroisse en principe — le tri par createdAt asc
    // ci-dessus garantit qu'en cas d'anomalie, on retient le plus ancien.
    const chefParParoisse = new Map<string, (typeof chefsGroupe)[number]>()
    for (const chef of chefsGroupe) {
      if (chef.paroisseId && !chefParParoisse.has(chef.paroisseId)) chefParParoisse.set(chef.paroisseId, chef)
    }

    const effectifsParParoisse = new Map<string, { brancheType: string; count: number }[]>()
    for (const ligne of effectifs) {
      const liste = effectifsParParoisse.get(ligne.paroisseId) ?? []
      liste.push({ brancheType: ligne.brancheType, count: ligne._count.id })
      effectifsParParoisse.set(ligne.paroisseId, liste)
    }

    return NextResponse.json({
      paroisses: paroisses.map((p) => {
        const chef = chefParParoisse.get(p.id)
        return {
          id: p.id,
          nom: p.nom,
          ville: p.ville,
          actif: p.actif,
          chefGroupe: chef
            ? { id: chef.id, nom: chef.nom, prenom: chef.prenom, matricule: chef.matricule, telephone: chef.telephone, email: chef.email }
            : null,
          effectifsParBranche: effectifsParParoisse.get(p.id) ?? [],
        }
      }),
    })
  } catch (error) {
    if (error instanceof DistrictInvalideError) {
      return NextResponse.json({ erreur: error.message }, { status: 400 })
    }
    logger.error('GET /api/district/paroisses', error)
    return NextResponse.json({ erreur: 'Erreur serveur' }, { status: 500 })
  }
}
