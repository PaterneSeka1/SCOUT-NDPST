import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { hash } from 'bcryptjs'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { Prisma, RoleUtilisateur } from '@/app/generated/prisma/client'
import { motDePasseValide, REGLE_MOT_DE_PASSE } from '@/lib/password'
import { ROLES_DISTRICT as ROLES_AUTORISES, ROLES_ASSIGNABLES_DISTRICT, libelleRoleAvecFonction } from '@/lib/roles'
import { logger } from '@/lib/logger'
import { enregistrerAudit } from '@/lib/audit'
import { envoyerEmailBienvenue } from '@/lib/notifications'
import { paroisseIdRequise } from '@/lib/session'

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json({ erreur: 'Non authentifié' }, { status: 401 })
    }

    if (!ROLES_AUTORISES.includes(session.user.role)) {
      return NextResponse.json({ erreur: 'Accès refusé' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10))
    const limite = Math.max(1, parseInt(searchParams.get('limite') ?? '20', 10))
    const rolesParam = searchParams.get('role')
    const roles = (rolesParam ?? '')
      .split(',')
      .map((r) => r.trim())
      .filter((r) => ROLES_ASSIGNABLES_DISTRICT.includes(r))
    const recherche = searchParams.get('recherche') ?? undefined

    const paroisseId = paroisseIdRequise(session)

    // Toujours scopé par paroisseId ET role dans ROLES_ASSIGNABLES_DISTRICT —
    // jamais paroisseId seul, sans quoi on verrait aussi l'équipe "groupe"
    // normale de la même paroisse d'ancrage.
    const where: Prisma.UtilisateurWhereInput = {
      paroisseId,
      role: { in: ROLES_ASSIGNABLES_DISTRICT as RoleUtilisateur[] },
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
          telephone: true,
          email: true,
          role: true,
          fonction: true,
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
    logger.error('GET /api/district/utilisateurs', error)
    return NextResponse.json({ erreur: 'Erreur serveur' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json({ erreur: 'Non authentifié' }, { status: 401 })
    }

    if (!ROLES_AUTORISES.includes(session.user.role)) {
      return NextResponse.json({ erreur: 'Accès refusé' }, { status: 403 })
    }

    const body = await request.json()
    const { nom, prenom, email, matricule, telephone, role, password, fonction } = body as {
      nom?: string
      prenom?: string
      email?: string
      matricule?: string | null
      telephone?: string | null
      role?: string
      password?: string
      fonction?: string | null
    }

    if (!nom || !prenom || !role || !password) {
      return NextResponse.json(
        { erreur: 'Les champs nom, prenom, role et password sont requis' },
        { status: 400 },
      )
    }

    if (!motDePasseValide(password)) {
      return NextResponse.json({ erreur: REGLE_MOT_DE_PASSE }, { status: 400 })
    }

    // Seuls ADJOINT_DISTRICT et ASSISTANT_DISTRICT sont assignables par le
    // Commissaire de District à sa propre équipe — ni son propre rôle, ni
    // aucun rôle paroissial ou plateforme.
    if (!ROLES_ASSIGNABLES_DISTRICT.includes(role)) {
      return NextResponse.json({ erreur: 'Rôle invalide' }, { status: 400 })
    }

    // Pas de rôle parent possible ici : le matricule reste toujours requis.
    if (!matricule?.trim()) {
      return NextResponse.json({ erreur: 'Le matricule est requis' }, { status: 400 })
    }

    // fonction n'a de sens que pour ASSISTANT_DISTRICT — ignoré/forcé à null
    // pour ADJOINT_DISTRICT.
    const fonctionValeur = role === 'ASSISTANT_DISTRICT' ? (fonction?.trim() || null) : null

    const paroisseId = paroisseIdRequise(session)

    const existingByMatricule = await prisma.utilisateur.findUnique({
      where: { matricule: matricule.trim() },
      select: { id: true },
    })
    if (existingByMatricule) {
      return NextResponse.json({ erreur: 'Ce matricule est déjà utilisé' }, { status: 400 })
    }

    if (telephone?.trim()) {
      const existingByTel = await prisma.utilisateur.findUnique({
        where: { telephone: telephone.trim() },
        select: { id: true },
      })
      if (existingByTel) {
        return NextResponse.json({ erreur: 'Ce numéro de téléphone est déjà utilisé' }, { status: 400 })
      }
    }

    if (email?.trim()) {
      const existingByEmail = await prisma.utilisateur.findFirst({
        where: { email: { equals: email.trim(), mode: 'insensitive' } },
        select: { id: true },
      })
      if (existingByEmail) {
        return NextResponse.json({ erreur: 'Cette adresse e-mail est déjà utilisée' }, { status: 400 })
      }
    }

    const passwordHache = await hash(password, 12)

    const utilisateur = await prisma.utilisateur.create({
      data: {
        nom,
        prenom,
        email: email?.trim() || null,
        matricule: matricule.trim(),
        telephone: telephone?.trim() || null,
        role: role as RoleUtilisateur,
        fonction: fonctionValeur,
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
        fonction: true,
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
      details: { role: utilisateur.role, fonction: utilisateur.fonction },
    })

    if (utilisateur.email) {
      envoyerEmailBienvenue({
        email: utilisateur.email,
        prenom: utilisateur.prenom,
        identifiant: utilisateur.matricule ?? utilisateur.telephone ?? utilisateur.email,
        roleLabel: libelleRoleAvecFonction(utilisateur.role, utilisateur.fonction),
        nomSite: 'SCOUT ASCCI',
        urlConnexion: `${process.env.NEXTAUTH_URL ?? ''}/login`,
      }).catch((error) => logger.error('district_utilisateurs.email_bienvenue_echoue', error))
    }

    return NextResponse.json(utilisateur, { status: 201 })
  } catch (error) {
    logger.error('POST /api/district/utilisateurs', error)
    return NextResponse.json({ erreur: 'Erreur serveur' }, { status: 500 })
  }
}
