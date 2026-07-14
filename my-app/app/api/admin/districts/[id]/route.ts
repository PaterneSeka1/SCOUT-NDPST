import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { ROLES_PLATEFORME } from '@/lib/roles'
import { enregistrerAudit } from '@/lib/audit'
import { logger } from '@/lib/logger'

type RouteParams = { params: Promise<{ id: string }> }

export async function GET(_request: NextRequest, { params }: RouteParams) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ erreur: 'Non authentifié' }, { status: 401 })
  if (!ROLES_PLATEFORME.includes(session.user.role)) {
    return NextResponse.json({ erreur: 'Accès refusé' }, { status: 403 })
  }

  const { id } = await params

  const district = await prisma.district.findUnique({ where: { id }, select: { id: true, nom: true } })
  if (!district) return NextResponse.json({ erreur: 'District introuvable' }, { status: 404 })

  const paroisses = await prisma.paroisse.findMany({
    where: { districtId: id },
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

  const equipe = await prisma.utilisateur.findMany({
    where: {
      role: { in: ['COMMISSAIRE_DISTRICT', 'ADJOINT_DISTRICT', 'ASSISTANT_DISTRICT'] },
      paroisse: { districtId: id },
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
    id: district.id,
    nom: district.nom,
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

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return NextResponse.json({ erreur: 'Non authentifié' }, { status: 401 })
    if (!ROLES_PLATEFORME.includes(session.user.role)) {
      return NextResponse.json({ erreur: 'Accès refusé' }, { status: 403 })
    }

    const { id } = await params
    const existant = await prisma.district.findUnique({ where: { id }, select: { id: true, nom: true } })
    if (!existant) return NextResponse.json({ erreur: 'District introuvable' }, { status: 404 })

    const body = await request.json()
    const { nom } = body as { nom?: string }
    if (!nom?.trim()) {
      return NextResponse.json({ erreur: 'Le nom du district est requis' }, { status: 400 })
    }

    const doublon = await prisma.district.findFirst({
      where: { nom: { equals: nom.trim(), mode: 'insensitive' }, NOT: { id } },
      select: { id: true },
    })
    if (doublon) {
      return NextResponse.json({ erreur: 'Un district portant ce nom existe déjà' }, { status: 400 })
    }

    const district = await prisma.district.update({ where: { id }, data: { nom: nom.trim() } })

    if (district.nom !== existant.nom) {
      await enregistrerAudit({
        paroisseId: null,
        acteurId: session.user.id,
        action: 'DISTRICT_MODIFIE',
        entite: 'District',
        entiteId: id,
        details: { ancienNom: existant.nom, nouveauNom: district.nom },
      })
    }

    return NextResponse.json(district)
  } catch (error) {
    logger.error('PATCH /api/admin/districts/[id]', error)
    return NextResponse.json({ erreur: 'Erreur serveur' }, { status: 500 })
  }
}

export async function DELETE(_request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return NextResponse.json({ erreur: 'Non authentifié' }, { status: 401 })
    if (!ROLES_PLATEFORME.includes(session.user.role)) {
      return NextResponse.json({ erreur: 'Accès refusé' }, { status: 403 })
    }

    const { id } = await params
    const district = await prisma.district.findUnique({
      where: { id },
      select: { id: true, nom: true, _count: { select: { paroisses: true } } },
    })
    if (!district) return NextResponse.json({ erreur: 'District introuvable' }, { status: 404 })

    if (district._count.paroisses > 0) {
      return NextResponse.json(
        {
          erreur: `Ce district contient encore ${district._count.paroisses} paroisse${district._count.paroisses > 1 ? 's' : ''}. Déplacez-les vers un autre district avant de le supprimer.`,
        },
        { status: 409 },
      )
    }

    await prisma.district.delete({ where: { id } })

    await enregistrerAudit({
      paroisseId: null,
      acteurId: session.user.id,
      action: 'DISTRICT_SUPPRIME',
      entite: 'District',
      entiteId: id,
      details: { nom: district.nom },
    })

    return NextResponse.json({ ok: true })
  } catch (error) {
    logger.error('DELETE /api/admin/districts/[id]', error)
    return NextResponse.json({ erreur: 'Erreur serveur' }, { status: 500 })
  }
}
