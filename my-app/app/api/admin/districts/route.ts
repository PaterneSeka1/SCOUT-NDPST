import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { ROLES_PLATEFORME } from '@/lib/roles'
import { enregistrerAudit } from '@/lib/audit'
import { logger } from '@/lib/logger'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ erreur: 'Non authentifié' }, { status: 401 })
  if (!ROLES_PLATEFORME.includes(session.user.role)) {
    return NextResponse.json({ erreur: 'Accès refusé' }, { status: 403 })
  }

  const districts = await prisma.district.findMany({
    orderBy: { nom: 'asc' },
    select: { id: true, nom: true, _count: { select: { paroisses: true } } },
  })

  const districtsAvecCommissaire = await Promise.all(
    districts.map(async (d) => {
      const commissaire = await prisma.utilisateur.findFirst({
        where: { role: 'COMMISSAIRE_DISTRICT', actif: true, paroisse: { districtId: d.id } },
        select: { id: true, nom: true, prenom: true, actif: true },
      })
      return { id: d.id, nom: d.nom, nbParoisses: d._count.paroisses, commissaire }
    }),
  )

  return NextResponse.json({ districts: districtsAvecCommissaire })
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return NextResponse.json({ erreur: 'Non authentifié' }, { status: 401 })
    if (!ROLES_PLATEFORME.includes(session.user.role)) {
      return NextResponse.json({ erreur: 'Accès refusé' }, { status: 403 })
    }

    const body = await request.json()
    const { nom } = body as { nom?: string }
    if (!nom?.trim()) {
      return NextResponse.json({ erreur: 'Le nom du district est requis' }, { status: 400 })
    }

    const existant = await prisma.district.findFirst({
      where: { nom: { equals: nom.trim(), mode: 'insensitive' } },
      select: { id: true },
    })
    if (existant) {
      return NextResponse.json({ erreur: 'Un district portant ce nom existe déjà' }, { status: 400 })
    }

    const district = await prisma.district.create({ data: { nom: nom.trim() } })

    await enregistrerAudit({
      paroisseId: null,
      acteurId: session.user.id,
      action: 'DISTRICT_CREE',
      entite: 'District',
      entiteId: district.id,
      details: { nom: district.nom },
    })

    return NextResponse.json(district, { status: 201 })
  } catch (error) {
    logger.error('POST /api/admin/districts', error)
    return NextResponse.json({ erreur: 'Erreur serveur' }, { status: 500 })
  }
}
