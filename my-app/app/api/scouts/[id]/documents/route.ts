import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { TypeDocument } from '@/app/generated/prisma/client'

type RouteParams = { params: Promise<{ id: string }> }

const ROLES_AUTORISES = [
  'ADMIN_PAROISSE',
  'CHEF_GROUPE',
  'ADJOINT_GROUPE',
  'ASSISTANT_GROUPE',
  'RESPONSABLE_BRANCHE',
  'ADJOINT_BRANCHE',
  'ASSISTANT_BRANCHE',
]

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
    const { type, nomFichier, url } = body as {
      type?: string
      nomFichier?: string
      url?: string
    }

    if (!type || !(type in TypeDocument)) {
      return NextResponse.json({ error: 'Type de document invalide' }, { status: 400 })
    }
    if (!nomFichier?.trim() || !url?.trim()) {
      return NextResponse.json({ error: 'Le fichier est requis' }, { status: 400 })
    }

    const document = await prisma.document.create({
      data: {
        type: type as TypeDocument,
        nomFichier: nomFichier.trim(),
        url: url.trim(),
        scoutId: id,
      },
    })

    return NextResponse.json(document, { status: 201 })
  } catch (error) {
    console.error('[POST /api/scouts/[id]/documents]', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
