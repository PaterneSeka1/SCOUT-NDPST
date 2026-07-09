import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { ROLES_PLATEFORME } from '@/lib/roles'

type RouteParams = { params: Promise<{ key: string }> }

export async function GET(_request: NextRequest, { params }: RouteParams) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ erreur: 'Non authentifié' }, { status: 401 })
  if (!ROLES_PLATEFORME.includes(session.user.role)) {
    return NextResponse.json({ erreur: 'Accès refusé' }, { status: 403 })
  }

  const { key } = await params
  const nom = decodeURIComponent(key)

  const paroisses = await prisma.paroisse.findMany({
    where: { district: nom },
    select: {
      id: true,
      nom: true,
      ville: true,
      actif: true,
      _count: { select: { scouts: true, utilisateurs: true } },
      utilisateurs: {
        where: { role: 'CHEF_GROUPE' },
        select: { id: true, nom: true, prenom: true },
        take: 1,
      },
    },
    orderBy: { nom: 'asc' },
  })

  if (paroisses.length === 0) return NextResponse.json({ erreur: 'District introuvable' }, { status: 404 })

  const equipe = await prisma.utilisateur.findMany({
    where: {
      role: { in: ['COMMISSAIRE_DISTRICT', 'ADJOINT_DISTRICT', 'ASSISTANT_DISTRICT'] },
      paroisse: { district: nom },
    },
    select: {
      id: true,
      nom: true,
      prenom: true,
      matricule: true,
      telephone: true,
      email: true,
      actif: true,
      role: true,
      fonction: true,
      brancheType: true,
      createdAt: true,
      paroisse: { select: { id: true, nom: true } },
    },
    orderBy: [{ role: 'asc' }, { nom: 'asc' }, { prenom: 'asc' }],
  })

  return NextResponse.json({
    nom,
    paroisses: paroisses.map((p) => ({
      id: p.id,
      nom: p.nom,
      ville: p.ville,
      actif: p.actif,
      scouts: p._count.scouts,
      utilisateurs: p._count.utilisateurs,
      chefGroupe: p.utilisateurs[0] ?? null,
    })),
    equipe,
  })
}
