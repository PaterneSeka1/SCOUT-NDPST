import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { ROLES_TOUT_STAFF as ROLES_AUTORISES } from '@/lib/roles'

type RouteParams = { params: Promise<{ id: string }> }

export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }

    if (!ROLES_AUTORISES.includes(session.user.role)) {
      return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
    }

    const { id } = await params

    const scout = await prisma.scout.findFirst({
      where: { id, paroisseId: session.user.paroisseId },
      select: { id: true },
    })

    if (!scout) {
      return NextResponse.json({ error: 'Scout introuvable' }, { status: 404 })
    }

    const body = await request.json()
    const { nom, prenom, telephone, relation, principal } = body as {
      nom?: string
      prenom?: string
      telephone?: string
      relation?: string
      principal?: boolean
    }

    if (!nom?.trim()) {
      return NextResponse.json({ error: 'Le nom du contact est requis' }, { status: 400 })
    }
    if (!telephone?.trim()) {
      return NextResponse.json({ error: 'Le téléphone du contact est requis' }, { status: 400 })
    }

    // Si le nouveau contact est principal, retirer le statut des autres
    if (principal) {
      await prisma.contactUrgence.updateMany({
        where: { scoutId: id, principal: true },
        data: { principal: false },
      })
    }

    const contact = await prisma.contactUrgence.create({
      data: {
        nom: nom.trim(),
        prenom: prenom?.trim() || null,
        telephone: telephone.trim(),
        relation: relation?.trim() || null,
        principal: principal ?? false,
        scoutId: id,
      },
    })

    return NextResponse.json(contact, { status: 201 })
  } catch (error) {
    console.error('[POST /api/scouts/[id]/contacts]', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
