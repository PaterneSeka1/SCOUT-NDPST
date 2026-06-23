import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { BrancheType, Prisma, Sexe } from '@/app/generated/prisma/client'

const ROLES_AUTORISES = [
  'ADMIN_PAROISSE',
  'CHEF_GROUPE',
  'ADJOINT_GROUPE',
  'ASSISTANT_GROUPE',
  'RESPONSABLE_BRANCHE',
  'ADJOINT_BRANCHE',
  'ASSISTANT_BRANCHE',
]

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }

    if (!ROLES_AUTORISES.includes(session.user.role)) {
      return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10))
    const limite = Math.max(1, parseInt(searchParams.get('limite') ?? '20', 10))
    const branche = searchParams.get('branche') ?? undefined
    const recherche = searchParams.get('recherche') ?? undefined
    const actif = searchParams.get('actif')

    const paroisseId = session.user.paroisseId

    const where: Prisma.ScoutWhereInput = {
      paroisseId,
      ...(branche ? { brancheType: branche as BrancheType } : {}),
      ...(actif !== null ? { actif: actif === 'true' } : {}),
      ...(recherche
        ? {
            OR: [
              { nom: { contains: recherche, mode: 'insensitive' } },
              { prenom: { contains: recherche, mode: 'insensitive' } },
              { matricule: { contains: recherche, mode: 'insensitive' } },
            ],
          }
        : {}),
    }

    const [scouts, total] = await Promise.all([
      prisma.scout.findMany({
        where,
        select: {
          id: true,
          nom: true,
          prenom: true,
          dateNaissance: true,
          sexe: true,
          brancheType: true,
          matricule: true,
          actif: true,
          photo: true,
          paroisseId: true,
          utilisateurId: true,
          createdAt: true,
          _count: { select: { contactsUrgence: true } },
        },
        orderBy: [{ nom: 'asc' }, { prenom: 'asc' }],
        skip: (page - 1) * limite,
        take: limite,
      }),
      prisma.scout.count({ where }),
    ])

    const totalPages = Math.ceil(total / limite)

    return NextResponse.json({ scouts, total, page, totalPages })
  } catch (error) {
    console.error('[GET /api/scouts]', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }

    if (!ROLES_AUTORISES.includes(session.user.role)) {
      return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
    }

    const body = await request.json()
    const { nom, prenom, dateNaissance, sexe, brancheType, photo, contactsUrgence } = body as {
      nom?: string
      prenom?: string
      dateNaissance?: string
      sexe?: string
      brancheType?: string
      photo?: string
      contactsUrgence?: Array<{
        nom?: string
        prenom?: string
        telephone?: string
        relation?: string
        principal?: boolean
      }>
    }

    // Validation des champs obligatoires
    if (!nom?.trim()) {
      return NextResponse.json({ error: 'Le nom est requis' }, { status: 400 })
    }
    if (!prenom?.trim()) {
      return NextResponse.json({ error: 'Le prénom est requis' }, { status: 400 })
    }
    if (!dateNaissance) {
      return NextResponse.json({ error: 'La date de naissance est requise' }, { status: 400 })
    }
    if (!sexe || !(sexe in Sexe)) {
      return NextResponse.json({ error: 'Le sexe est invalide ou manquant' }, { status: 400 })
    }
    if (!brancheType || !(brancheType in BrancheType)) {
      return NextResponse.json({ error: 'La branche est invalide ou manquante' }, { status: 400 })
    }

    // Validation des contacts d'urgence
    if (!Array.isArray(contactsUrgence) || contactsUrgence.length === 0) {
      return NextResponse.json(
        { error: 'Au moins un contact d\'urgence est requis' },
        { status: 400 },
      )
    }

    for (const [i, contact] of contactsUrgence.entries()) {
      if (!contact.nom?.trim()) {
        return NextResponse.json(
          { error: `Le nom du contact ${i + 1} est requis` },
          { status: 400 },
        )
      }
      if (!contact.telephone?.trim()) {
        return NextResponse.json(
          { error: `Le téléphone du contact ${i + 1} est requis` },
          { status: 400 },
        )
      }
    }

    const paroisseId = session.user.paroisseId

    // Créer le scout et ses contacts en transaction
    const scout = await prisma.$transaction(async (tx) => {
      const nouveauScout = await tx.scout.create({
        data: {
          nom: nom.trim(),
          prenom: prenom.trim(),
          dateNaissance: new Date(dateNaissance),
          sexe: sexe as Sexe,
          brancheType: brancheType as BrancheType,
          photo: photo?.trim() || null,
          paroisseId,
        },
      })

      // Créer les contacts d'urgence
      for (const contact of contactsUrgence) {
        await tx.contactUrgence.create({
          data: {
            nom: contact.nom!.trim(),
            prenom: contact.prenom?.trim() || null,
            telephone: contact.telephone!.trim(),
            relation: contact.relation?.trim() || null,
            principal: contact.principal ?? false,
            scoutId: nouveauScout.id,
          },
        })
      }

      return tx.scout.findUnique({
        where: { id: nouveauScout.id },
        include: {
          contactsUrgence: true,
        },
      })
    })

    return NextResponse.json(scout, { status: 201 })
  } catch (error) {
    console.error('[POST /api/scouts]', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
