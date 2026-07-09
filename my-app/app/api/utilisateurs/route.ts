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
import { enregistrerAudit } from '@/lib/audit'
import { envoyerEmailBienvenue } from '@/lib/notifications'
import { LABELS_ROLES } from '@/lib/roles'
import { paroisseIdRequise } from '@/lib/session'

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
    // Accepte un rôle unique ("PARENT") ou une liste séparée par des virgules
    // ("ADJOINT_GROUPE,ASSISTANT_GROUPE,...") — utilisé par la page "Membres"
    // pour exclure les parents sans avoir besoin d'un paramètre dédié.
    const rolesParam = searchParams.get('role')
    const roles = (rolesParam ?? '')
      .split(',')
      .map((r) => r.trim())
      .filter((r) => RoleUtilisateurSchema.safeParse(r).success)
    const recherche = searchParams.get('recherche') ?? undefined

    const paroisseId = paroisseIdRequise(session)

    const where: Prisma.UtilisateurWhereInput = {
      paroisseId,
      NOT: { id: session.user.id },
      ...(roles.length === 1 ? { role: roles[0] as RoleUtilisateur } : {}),
      ...(roles.length > 1 ? { role: { in: roles as RoleUtilisateur[] } } : {}),
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

    if (!ROLES_AUTORISES.includes(session.user.role)) {
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

    // Un admin plateforme (transverse, sans paroisse) ne se crée jamais via
    // cette route — uniquement via la bascule de compte ou un accès base directe.
    if (role === 'ADMIN_PLATEFORME') {
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

    const paroisseId = paroisseIdRequise(session)

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
      // Insensible à la casse : évite qu'un doublon "Jean@x.com" / "jean@x.com"
      // passe inaperçu, ce qui rendrait ensuite la réinitialisation par email ambiguë.
      const existingByEmail = await prisma.utilisateur.findFirst({
        where: { email: { equals: email.trim(), mode: 'insensitive' } },
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

    await enregistrerAudit({
      paroisseId,
      acteurId: session.user.id,
      action: 'UTILISATEUR_CREE',
      entite: 'Utilisateur',
      entiteId: utilisateur.id,
      details: { role: utilisateur.role },
    })

    if (utilisateur.email) {
      // Meilleur effort : un échec d'envoi ne doit jamais faire échouer la création du compte.
      envoyerEmailBienvenue({
        email: utilisateur.email,
        prenom: utilisateur.prenom,
        identifiant: utilisateur.matricule ?? utilisateur.telephone ?? utilisateur.email,
        roleLabel: LABELS_ROLES[utilisateur.role] ?? utilisateur.role,
        nomSite: 'SCOUT ASCCI',
        urlConnexion: `${process.env.NEXTAUTH_URL ?? ''}/login`,
      }).catch((error) => logger.error('utilisateurs.email_bienvenue_echoue', error))
    }

    return NextResponse.json(utilisateur, { status: 201 })
  } catch (error) {
    logger.error('POST /api/utilisateurs', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
