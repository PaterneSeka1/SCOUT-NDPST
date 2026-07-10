import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { hash } from 'bcryptjs'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { Prisma, RoleUtilisateur, BrancheType } from '@/app/generated/prisma/client'
import { motDePasseValide, REGLE_MOT_DE_PASSE } from '@/lib/password'
import { ROLES_PLATEFORME, ROLES_ASSIGNABLES_PAROISSE, ROLES_DISTRICT_ETENDU, ROLES_BRANCHE, libelleRoleAvecFonction } from '@/lib/roles'
import { RoleUtilisateurSchema, BrancheTypeSchema } from '@/lib/validation'
import { normaliserDistrict } from '@/lib/district'
import { logger } from '@/lib/logger'
import { enregistrerAudit } from '@/lib/audit'
import { envoyerEmailBienvenue } from '@/lib/notifications'

// Gestion transverse des comptes de toutes les paroisses par un admin plateforme.
// Contrairement à /api/utilisateurs (scopé à la paroisse de l'appelant), cette
// surface n'est jamais filtrée par une paroisseId d'appelant — l'admin plateforme
// n'en a pas — mais elle exclut toujours les comptes ADMIN_PLATEFORME : un admin
// plateforme ne gère pas d'autres admins plateforme via cette surface.
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return NextResponse.json({ erreur: 'Non authentifié' }, { status: 401 })
    if (!ROLES_PLATEFORME.includes(session.user.role)) {
      return NextResponse.json({ erreur: 'Accès refusé' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10))
    const limite = Math.max(1, parseInt(searchParams.get('limite') ?? '20', 10))
    const roleParam = searchParams.get('role')
    const role = roleParam && RoleUtilisateurSchema.safeParse(roleParam).success ? roleParam : undefined
    const paroisseId = searchParams.get('paroisseId') ?? undefined
    const recherche = searchParams.get('recherche') ?? undefined

    const where: Prisma.UtilisateurWhereInput = {
      role: { not: 'ADMIN_PLATEFORME', ...(role ? { equals: role as RoleUtilisateur } : {}) },
      ...(paroisseId ? { paroisseId } : {}),
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
          brancheType: true,
          actif: true,
          createdAt: true,
          paroisse: { select: { id: true, nom: true } },
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
    logger.error('GET /api/admin/utilisateurs', error)
    return NextResponse.json({ erreur: 'Erreur serveur' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return NextResponse.json({ erreur: 'Non authentifié' }, { status: 401 })
    if (!ROLES_PLATEFORME.includes(session.user.role)) {
      return NextResponse.json({ erreur: 'Accès refusé' }, { status: 403 })
    }

    const body = await request.json()
    const { paroisseId, nom, prenom, email, matricule, telephone, role, password, fonction, brancheType } = body as {
      paroisseId?: string
      nom?: string
      prenom?: string
      email?: string
      matricule?: string | null
      telephone?: string | null
      role?: string
      password?: string
      fonction?: string | null
      brancheType?: string | null
    }

    if (!paroisseId || !nom || !prenom || !role || !password) {
      return NextResponse.json(
        { erreur: 'Les champs paroisseId, nom, prenom, role et password sont requis' },
        { status: 400 },
      )
    }

    if (!motDePasseValide(password)) {
      return NextResponse.json({ erreur: REGLE_MOT_DE_PASSE }, { status: 400 })
    }

    const paroisse = await prisma.paroisse.findUnique({ where: { id: paroisseId }, select: { id: true, district: true } })
    if (!paroisse) return NextResponse.json({ erreur: 'Paroisse introuvable' }, { status: 404 })

    // Un admin plateforme (transverse, sans paroisse) ne se crée jamais via cette
    // route — ROLES_ASSIGNABLES_PAROISSE exclut déjà ADMIN_PLATEFORME.
    if (!ROLES_ASSIGNABLES_PAROISSE.includes(role)) {
      return NextResponse.json({ erreur: 'Rôle invalide' }, { status: 400 })
    }

    // Un rôle de district n'a de sens que si le périmètre du district (dérivé du
    // district de la paroisse d'ancrage) est résoluble — voir lib/district.ts.
    if (ROLES_DISTRICT_ETENDU.includes(role) && !normaliserDistrict(paroisse.district)) {
      return NextResponse.json(
        { erreur: "Cette paroisse n'a pas de district renseigné — renseignez-le avant d'y rattacher un rôle de district" },
        { status: 400 },
      )
    }

    if (brancheType != null && !BrancheTypeSchema.safeParse(brancheType).success) {
      return NextResponse.json({ erreur: 'Branche invalide' }, { status: 400 })
    }

    // brancheType a un sens pour l'encadrement de branche paroissial (requis) et
    // pour ASSISTANT_DISTRICT chargé d'une branche (optionnel, mutuellement
    // exclusif avec fonction) — null pour tout autre rôle même si fourni.
    const estBranche = ROLES_BRANCHE.includes(role)
    if (estBranche && !brancheType) {
      return NextResponse.json({ erreur: 'La branche est requise pour ce rôle' }, { status: 400 })
    }
    const brancheTypeValeur = (estBranche || (role === 'ASSISTANT_DISTRICT' && brancheType)) ? (brancheType as BrancheType) : null
    const fonctionValeur = role === 'ASSISTANT_DISTRICT' && !brancheTypeValeur ? (fonction?.trim() || null) : null

    const estParent = role === 'PARENT'

    if (estParent && !telephone?.trim()) {
      return NextResponse.json(
        { erreur: 'Le numéro de téléphone est requis pour un parent' },
        { status: 400 },
      )
    }

    if (!estParent && !matricule?.trim()) {
      return NextResponse.json({ erreur: 'Le matricule est requis' }, { status: 400 })
    }

    if (matricule?.trim()) {
      const existingByMatricule = await prisma.utilisateur.findUnique({
        where: { matricule: matricule.trim() },
        select: { id: true },
      })
      if (existingByMatricule) {
        return NextResponse.json({ erreur: 'Ce matricule est déjà utilisé' }, { status: 400 })
      }
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
      // Insensible à la casse : évite qu'un doublon "Jean@x.com" / "jean@x.com"
      // passe inaperçu, ce qui rendrait ensuite la réinitialisation par email ambiguë.
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
        matricule: matricule?.trim() || null,
        telephone: telephone?.trim() || null,
        role: role as RoleUtilisateur,
        fonction: fonctionValeur,
        brancheType: brancheTypeValeur,
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
        brancheType: true,
        actif: true,
        createdAt: true,
        paroisseId: true,
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
        roleLabel: libelleRoleAvecFonction(utilisateur.role, utilisateur.fonction, utilisateur.brancheType),
        nomSite: 'SCOUT ASCCI',
        urlConnexion: `${process.env.NEXTAUTH_URL ?? ''}/login`,
      }).catch((error) => logger.error('admin.utilisateurs.email_bienvenue_echoue', error))
    }

    return NextResponse.json(utilisateur, { status: 201 })
  } catch (error) {
    logger.error('POST /api/admin/utilisateurs', error)
    return NextResponse.json({ erreur: 'Erreur serveur' }, { status: 500 })
  }
}
