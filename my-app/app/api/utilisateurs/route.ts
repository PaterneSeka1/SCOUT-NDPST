import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { hash } from 'bcryptjs'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { genererMatricule } from '@/lib/matricule'
import { RoleUtilisateur } from '@/app/generated/prisma/client'

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }

    if (session.user.role !== 'ADMIN_PAROISSE') {
      return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10))
    const limite = Math.max(1, parseInt(searchParams.get('limite') ?? '20', 10))
    const role = searchParams.get('role') ?? undefined
    const recherche = searchParams.get('recherche') ?? undefined

    const paroisseId = session.user.paroisseId

    const where: Parameters<typeof prisma.utilisateur.findMany>[0]['where'] = {
      paroisseId,
      ...(role ? { role: role as RoleUtilisateur } : {}),
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

    const [utilisateurs, total] = await Promise.all([
      prisma.utilisateur.findMany({
        where,
        select: {
          id: true,
          nom: true,
          prenom: true,
          matricule: true,
          email: true,
          role: true,
          actif: true,
          createdAt: true,
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limite,
        take: limite,
      }),
      prisma.utilisateur.count({ where }),
    ])

    const totalPages = Math.ceil(total / limite)

    return NextResponse.json({ utilisateurs, total, page, totalPages })
  } catch (error) {
    console.error('[GET /api/utilisateurs]', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }

    if (session.user.role !== 'ADMIN_PAROISSE') {
      return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
    }

    const body = await request.json()
    const { nom, prenom, email, matricule, role, password } = body as {
      nom?: string
      prenom?: string
      email?: string
      matricule?: string
      role?: string
      password?: string
    }

    if (!nom || !prenom || !role || !password) {
      return NextResponse.json(
        { error: 'Les champs nom, prenom, role et password sont requis' },
        { status: 400 },
      )
    }

    if (!(role in RoleUtilisateur)) {
      return NextResponse.json({ error: 'Rôle invalide' }, { status: 400 })
    }

    const paroisseId = session.user.paroisseId
    const matriculeFinal = matricule?.trim() || genererMatricule(paroisseId)

    // Verify matricule uniqueness
    const existingByMatricule = await prisma.utilisateur.findFirst({
      where: { matricule: matriculeFinal },
      select: { id: true },
    })
    if (existingByMatricule) {
      return NextResponse.json(
        { error: 'Ce matricule est déjà utilisé' },
        { status: 400 },
      )
    }

    // Verify email uniqueness if provided
    if (email) {
      const existingByEmail = await prisma.utilisateur.findUnique({
        where: { email },
        select: { id: true },
      })
      if (existingByEmail) {
        return NextResponse.json(
          { error: 'Cette adresse e-mail est déjà utilisée' },
          { status: 400 },
        )
      }
    }

    const passwordHache = await hash(password, 10)

    const utilisateur = await prisma.utilisateur.create({
      data: {
        nom,
        prenom,
        email: email ?? '',
        matricule: matriculeFinal,
        role: role as RoleUtilisateur,
        password: passwordHache,
        paroisseId,
      },
      select: {
        id: true,
        nom: true,
        prenom: true,
        matricule: true,
        email: true,
        role: true,
        actif: true,
        createdAt: true,
      },
    })

    return NextResponse.json(utilisateur, { status: 201 })
  } catch (error) {
    console.error('[POST /api/utilisateurs]', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
