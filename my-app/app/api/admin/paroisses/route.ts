import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { ROLES_PLATEFORME } from '@/lib/roles'
import { logger } from '@/lib/logger'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ erreur: 'Non authentifié' }, { status: 401 })
  if (!ROLES_PLATEFORME.includes(session.user.role)) {
    return NextResponse.json({ erreur: 'Accès refusé' }, { status: 403 })
  }

  const paroisses = await prisma.paroisse.findMany({
    include: {
      _count: { select: { scouts: true, utilisateurs: true, activites: true } },
      utilisateurs: {
        where: { role: 'CHEF_GROUPE' },
        select: { id: true, nom: true, prenom: true },
        take: 1,
        orderBy: { createdAt: 'asc' },
      },
    },
    orderBy: { nom: 'asc' },
  })

  return NextResponse.json(
    paroisses.map((p) => ({
      id: p.id,
      nom: p.nom,
      ville: p.ville,
      diocese: p.diocese,
      districtId: p.districtId,
      actif: p.actif,
      createdAt: p.createdAt,
      counts: p._count,
      chefGroupe: p.utilisateurs[0] ?? null,
    })),
  )
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return NextResponse.json({ erreur: 'Non authentifié' }, { status: 401 })
    if (!ROLES_PLATEFORME.includes(session.user.role)) {
      return NextResponse.json({ erreur: 'Accès refusé' }, { status: 403 })
    }

    const body = await request.json()
    const { nom, ville, diocese, ocean, districtId, adresse, telephone, email } = body as {
      nom?: string; ville?: string; diocese?: string; ocean?: string; districtId?: string
      adresse?: string; telephone?: string; email?: string
    }

    if (!nom?.trim() || !ville?.trim() || !diocese?.trim() || !districtId?.trim()) {
      return NextResponse.json({ erreur: 'Le nom, la ville, le diocèse et le district sont obligatoires' }, { status: 400 })
    }

    const district = await prisma.district.findUnique({ where: { id: districtId }, select: { id: true } })
    if (!district) return NextResponse.json({ erreur: 'District invalide' }, { status: 400 })

    if (email?.trim()) {
      const doublon = await prisma.paroisse.findUnique({ where: { email: email.trim() }, select: { id: true } })
      if (doublon) return NextResponse.json({ erreur: 'Cette adresse e-mail est déjà utilisée par une autre paroisse' }, { status: 400 })
    }

    const paroisse = await prisma.paroisse.create({
      data: {
        nom: nom.trim(),
        ville: ville.trim(),
        diocese: diocese.trim(),
        ocean: ocean?.trim() || null,
        districtId: district.id,
        adresse: adresse?.trim() || null,
        telephone: telephone?.trim() || null,
        email: email?.trim() || null,
      },
    })

    return NextResponse.json(paroisse, { status: 201 })
  } catch (error) {
    logger.error('POST /api/admin/paroisses', error)
    return NextResponse.json({ erreur: 'Erreur serveur' }, { status: 500 })
  }
}
