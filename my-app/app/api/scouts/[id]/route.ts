import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { BrancheType, Sexe } from '@/app/generated/prisma/client'

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

export async function GET(_request: NextRequest, { params }: RouteParams) {
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
      include: {
        contactsUrgence: {
          orderBy: [{ principal: 'desc' }, { nom: 'asc' }],
        },
        documents: {
          orderBy: { createdAt: 'desc' },
        },
        liensParents: {
          include: {
            parent: {
              select: {
                id: true,
                nom: true,
                prenom: true,
                telephone: true,
                email: true,
                role: true,
              },
            },
          },
        },
        utilisateur: {
          select: {
            id: true,
            nom: true,
            prenom: true,
            matricule: true,
            actif: true,
          },
        },
      },
    })

    if (!scout) {
      return NextResponse.json({ error: 'Scout introuvable' }, { status: 404 })
    }

    return NextResponse.json(scout)
  } catch (error) {
    console.error('[GET /api/scouts/[id]]', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }

    if (!ROLES_AUTORISES.includes(session.user.role)) {
      return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
    }

    const { id } = await params

    const existant = await prisma.scout.findFirst({
      where: { id, paroisseId: session.user.paroisseId },
      select: { id: true },
    })

    if (!existant) {
      return NextResponse.json({ error: 'Scout introuvable' }, { status: 404 })
    }

    const body = await request.json()
    const { nom, prenom, dateNaissance, sexe, brancheType, actif, photo } = body as {
      nom?: string
      prenom?: string
      dateNaissance?: string
      sexe?: string
      brancheType?: string
      actif?: boolean
      photo?: string
    }

    if (sexe !== undefined && !(sexe in Sexe)) {
      return NextResponse.json({ error: 'Sexe invalide' }, { status: 400 })
    }
    if (brancheType !== undefined && !(brancheType in BrancheType)) {
      return NextResponse.json({ error: 'Branche invalide' }, { status: 400 })
    }

    const scout = await prisma.scout.update({
      where: { id },
      data: {
        ...(nom !== undefined ? { nom: nom.trim() } : {}),
        ...(prenom !== undefined ? { prenom: prenom.trim() } : {}),
        ...(dateNaissance !== undefined ? { dateNaissance: new Date(dateNaissance) } : {}),
        ...(sexe !== undefined ? { sexe: sexe as Sexe } : {}),
        ...(brancheType !== undefined ? { brancheType: brancheType as BrancheType } : {}),
        ...(actif !== undefined ? { actif } : {}),
        ...(photo !== undefined ? { photo: photo?.trim() || null } : {}),
      },
      include: {
        contactsUrgence: true,
      },
    })

    return NextResponse.json(scout)
  } catch (error) {
    console.error('[PUT /api/scouts/[id]]', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
