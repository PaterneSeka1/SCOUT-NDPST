import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { hash } from 'bcryptjs'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { Prisma, RoleUtilisateur } from '@/app/generated/prisma/client'
import { motDePasseValide, REGLE_MOT_DE_PASSE } from '@/lib/password'
import { ROLES_GROUPE as ROLES_AUTORISES } from '@/lib/roles'
import { RoleUtilisateurSchema } from '@/lib/validation'
import { logger } from '@/lib/logger'

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
    const roleParam = searchParams.get('role')
    const role = roleParam && RoleUtilisateurSchema.safeParse(roleParam).success ? roleParam : undefined
    const recherche = searchParams.get('recherche') ?? undefined

    const paroisseId = session.user.paroisseId

    // Exclure l'utilisateur connecté et les admins si on est chef de groupe
    const exclusions: Prisma.UtilisateurWhereInput[] = [{ id: session.user.id }]
    if (session.user.role === 'CHEF_GROUPE') exclusions.push({ role: 'ADMIN_PAROISSE' })

    const where: Prisma.UtilisateurWhereInput = {
      paroisseId,
      NOT: exclusions.length === 1 ? exclusions[0] : { OR: exclusions },
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
    logger.error('GET /api/utilisateurs', error)
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
    const { nom, prenom, email, matricule, telephone, role, password } = body as {
      nom?: string
      prenom?: string
      email?: string
      matricule?: string | null
      telephone?: string | null
      role?: string
      password?: string
    }

    if (!nom || !prenom || !role || !password) {
      return NextResponse.json(
        { error: 'Les champs nom, prenom, role et password sont requis' },
        { status: 400 },
      )
    }

    if (!motDePasseValide(password)) {
      return NextResponse.json({ error: REGLE_MOT_DE_PASSE }, { status: 400 })
    }

    if (!(role in RoleUtilisateur)) {
      return NextResponse.json({ error: 'Rôle invalide' }, { status: 400 })
    }

    const estParent = role === 'PARENT'

    if (estParent && !telephone?.trim()) {
      return NextResponse.json(
        { error: 'Le numéro de téléphone est requis pour un parent' },
        { status: 400 },
      )
    }

    if (!estParent && !matricule?.trim()) {
      return NextResponse.json(
        { error: 'Le matricule est requis' },
        { status: 400 },
      )
    }

    const paroisseId = session.user.paroisseId

    if (matricule?.trim()) {
      const existingByMatricule = await prisma.utilisateur.findUnique({
        where: { matricule: matricule.trim() },
        select: { id: true },
      })
      if (existingByMatricule) {
        return NextResponse.json({ error: 'Ce matricule est déjà utilisé' }, { status: 400 })
      }
    }

    if (telephone?.trim()) {
      const existingByTel = await prisma.utilisateur.findUnique({
        where: { telephone: telephone.trim() },
        select: { id: true },
      })
      if (existingByTel) {
        return NextResponse.json({ error: 'Ce numéro de téléphone est déjà utilisé' }, { status: 400 })
      }
    }

    if (email?.trim()) {
      const existingByEmail = await prisma.utilisateur.findUnique({
        where: { email: email.trim() },
        select: { id: true },
      })
      if (existingByEmail) {
        return NextResponse.json({ error: 'Cette adresse e-mail est déjà utilisée' }, { status: 400 })
      }
    }

    const passwordHache = await hash(password, 12)

    const utilisateur = await prisma.utilisateur.create({
      data: {
        nom,
        prenom,
        email: email?.trim() || null,
        matricule: matricule?.trim() || null,
        telephone: telephone?.trim() || null,
        role: role as RoleUtilisateur,
        password: passwordHache,
        paroisseId,
      },
      select: {
        id: true,
        nom: true,
        prenom: true,
        matricule: true,
        telephone: true,
        email: true,
        role: true,
        actif: true,
        createdAt: true,
      },
    })

    return NextResponse.json(utilisateur, { status: 201 })
  } catch (error) {
    logger.error('POST /api/utilisateurs', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
