import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { TypeDocument } from '@/app/generated/prisma/client'
import { ROLES_TOUT_STAFF as ROLES_AUTORISES } from '@/lib/roles'
import { estCheminLocalValide } from '@/lib/validation'
import { logger } from '@/lib/logger'

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
    const { type, nomFichier, url, dateExpiration } = body as {
      type?: string
      nomFichier?: string
      url?: string
      dateExpiration?: string | null
    }

    if (!type || !(type in TypeDocument)) {
      return NextResponse.json({ error: 'Type de document invalide' }, { status: 400 })
    }
    if (!nomFichier?.trim() || !url?.trim()) {
      return NextResponse.json({ error: 'Le fichier est requis' }, { status: 400 })
    }
    if (!estCheminLocalValide(url.trim())) {
      return NextResponse.json({ error: 'url doit être un chemin local (ex : /api/fichiers/…)' }, { status: 400 })
    }
    let dateExpirationValide: Date | null = null
    if (dateExpiration) {
      dateExpirationValide = new Date(dateExpiration)
      if (Number.isNaN(dateExpirationValide.getTime())) {
        return NextResponse.json({ error: "Date d'expiration invalide" }, { status: 400 })
      }
    }

    const document = await prisma.document.create({
      data: {
        type: type as TypeDocument,
        nomFichier: nomFichier.trim(),
        url: url.trim(),
        dateExpiration: dateExpirationValide,
        scoutId: id,
      },
    })

    return NextResponse.json(document, { status: 201 })
  } catch (error) {
    logger.error('POST /api/scouts/[id]/documents', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
