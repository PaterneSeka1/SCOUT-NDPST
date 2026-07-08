import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { ROLES_PLATEFORME } from '@/lib/roles'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ erreur: 'Non authentifié' }, { status: 401 })
  if (!ROLES_PLATEFORME.includes(session.user.role)) {
    return NextResponse.json({ erreur: 'Accès refusé' }, { status: 403 })
  }

  const paroisses = await prisma.paroisse.findMany({
    include: {
      _count: { select: { scouts: true, utilisateurs: true, activites: true, cotisations: true } },
    },
    orderBy: { nom: 'asc' },
  })

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

  return NextResponse.json({
    totaux,
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
