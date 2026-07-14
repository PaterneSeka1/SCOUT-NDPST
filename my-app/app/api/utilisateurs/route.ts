import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { hash } from 'bcryptjs'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { Prisma, RoleUtilisateur, BrancheType } from '@/app/generated/prisma/client'
import { motDePasseValide, REGLE_MOT_DE_PASSE } from '@/lib/password'
import { ROLES_GROUPE as ROLES_AUTORISES, ROLES_DISTRICT_ETENDU, ROLES_BRANCHE, ROLES_ASSIGNABLES_PAROISSE } from '@/lib/roles'
import { BrancheTypeSchema } from '@/lib/validation'
import { anneeScolaireCourante } from '@/lib/cotisations'
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
      .filter((r) => ROLES_ASSIGNABLES_PAROISSE.includes(r))
    const recherche = searchParams.get('recherche') ?? undefined

    const paroisseId = paroisseIdRequise(session)

    // Un membre de l'équipe du district (roleDistrict renseigné) reste un
    // membre normal de sa paroisse (role inchangé) : il apparaît donc
    // normalement dans cette liste, comme n'importe quel autre membre du staff.
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

    const [utilisateursBruts, total] = await Promise.all([
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
          brancheType: true,
          actif: true,
          createdAt: true,
          cotisationsPersonnelles: {
            where: { anneeScolaire: anneeScolaireCourante(), type: 'ADHESION_ANNUELLE' },
            select: { statut: true },
            take: 1,
          },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limite,
        take: limite,
      }),
      prisma.utilisateur.count({ where }),
    ])

    const utilisateurs = utilisateursBruts.map(({ cotisationsPersonnelles, ...u }) => ({
      ...u,
      statutAdhesion: cotisationsPersonnelles[0]?.statut ?? null,
    }))

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
    const { nom, prenom, email, matricule, telephone, role, password, scoutIds, brancheType } = body as {
      nom?: string
      prenom?: string
      email?: string
      matricule?: string | null
      telephone?: string | null
      role?: string
      password?: string
      scoutIds?: unknown
      brancheType?: string | null
    }

    if (typeof nom !== 'string' || !nom.trim() || typeof prenom !== 'string' || !prenom.trim() || !role || !password) {
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
    // Les rôles de district non plus : gérés par ADMIN_PLATEFORME (création du
    // Commissaire de District) puis par lui-même via /district/equipe.
    if (role === 'ADMIN_PLATEFORME' || ROLES_DISTRICT_ETENDU.includes(role)) {
      return NextResponse.json({ error: 'Rôle invalide' }, { status: 400 })
    }

    if (brancheType != null && !BrancheTypeSchema.safeParse(brancheType).success) {
      return NextResponse.json({ error: 'Branche invalide' }, { status: 400 })
    }

    // brancheType n'a de sens que pour l'encadrement de branche : requis pour
    // ces rôles, forcé à null pour tout autre rôle même si envoyé par erreur.
    if (ROLES_BRANCHE.includes(role) && !brancheType) {
      return NextResponse.json({ error: 'La branche est requise pour ce rôle' }, { status: 400 })
    }
    const brancheTypeFinal = ROLES_BRANCHE.includes(role) ? (brancheType as BrancheType) : null

    const estParent = role === 'PARENT'

    if (scoutIds !== undefined && !Array.isArray(scoutIds)) {
      return NextResponse.json({ error: 'La liste des enfants est invalide' }, { status: 400 })
    }

    // Un compte staff (Chef de Groupe, encadrement de branche, Ressources
    // Adultes…) peut tout autant être parent d'un scout de la paroisse que
    // quelqu'un créé spécifiquement avec le rôle PARENT — le rattachement à
    // des enfants n'est donc jamais limité à un rôle particulier.
    const scoutIdsUniques = Array.isArray(scoutIds)
      ? [...new Set(scoutIds.map((id) => (typeof id === 'string' ? id.trim() : '')).filter(Boolean))]
      : []

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

    if (scoutIdsUniques.length > 0) {
      const scoutsAutorises = await prisma.scout.count({
        where: { id: { in: scoutIdsUniques }, paroisseId },
      })
      if (scoutsAutorises !== scoutIdsUniques.length) {
        return NextResponse.json(
          { error: 'Un ou plusieurs enfants sélectionnés sont introuvables' },
          { status: 400 },
        )
      }
    }

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

    const utilisateur = await prisma.$transaction(async (tx) => {
      const nouveauUtilisateur = await tx.utilisateur.create({
        data: {
          nom: nom.trim(),
          prenom: prenom.trim(),
          email: email?.trim() || null,
          matricule: matricule?.trim() || null,
          telephone: telephone?.trim() || null,
          role: role as RoleUtilisateur,
          brancheType: brancheTypeFinal,
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
          brancheType: true,
          actif: true,
          createdAt: true,
        },
      })

      if (scoutIdsUniques.length > 0) {
        await tx.lienParentScout.createMany({
          data: scoutIdsUniques.map((scoutId) => ({
            parentId: nouveauUtilisateur.id,
            scoutId,
          })),
          skipDuplicates: true,
        })
      }

      return nouveauUtilisateur
    })

    await enregistrerAudit({
      paroisseId,
      acteurId: session.user.id,
      action: 'UTILISATEUR_CREE',
      entite: 'Utilisateur',
      entiteId: utilisateur.id,
      details: { role: utilisateur.role, scoutIds: scoutIdsUniques },
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
