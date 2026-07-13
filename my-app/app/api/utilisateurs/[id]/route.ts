import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { RoleUtilisateur, BrancheType } from '@/app/generated/prisma/client'
import { ROLES_GROUPE as ROLES_AUTORISES, ROLES_DISTRICT_ETENDU, ROLES_BRANCHE } from '@/lib/roles'
import { BrancheTypeSchema } from '@/lib/validation'
import { logger } from '@/lib/logger'
import { enregistrerAudit } from '@/lib/audit'
import { paroisseIdRequise } from '@/lib/session'

type RouteParams = { params: Promise<{ id: string }> }

export async function GET(_request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    if (!ROLES_AUTORISES.includes(session.user.role)) return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })

    const paroisseId = paroisseIdRequise(session)
    const { id } = await params

    // Exclut systématiquement les rôles de district : un membre de l'équipe
    // district ancré sur cette paroisse n'apparaît jamais dans cette surface
    // paroissiale, gérée par le Chef de Groupe (voir /district/equipe).
    const utilisateur = await prisma.utilisateur.findFirst({
      where: { id, paroisseId, role: { notIn: ROLES_DISTRICT_ETENDU as RoleUtilisateur[] } },
      select: {
        id: true, nom: true, prenom: true, matricule: true, telephone: true,
        email: true, role: true, brancheType: true, actif: true, paroisseId: true,
        createdAt: true, updatedAt: true,
        liensParent: {
          select: {
            scout: {
              select: { id: true, nom: true, prenom: true, brancheType: true, matricule: true, actif: true },
            },
          },
        },
      },
    })

    if (!utilisateur) return NextResponse.json({ error: 'Utilisateur introuvable' }, { status: 404 })

    const { liensParent, ...reste } = utilisateur
    return NextResponse.json({ ...reste, enfants: liensParent.map((lien) => lien.scout) })
  } catch (error) {
    logger.error('GET /api/utilisateurs/[id]', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    if (!ROLES_AUTORISES.includes(session.user.role)) return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })

    const paroisseId = paroisseIdRequise(session)
    const { id } = await params

    // Exclut les rôles de district : un Chef de Groupe ne peut ni voir ni
    // modifier un compte de l'équipe district ancré sur sa paroisse.
    const existant = await prisma.utilisateur.findFirst({
      where: { id, paroisseId, role: { notIn: ROLES_DISTRICT_ETENDU as RoleUtilisateur[] } },
      select: { id: true, role: true, actif: true, brancheType: true },
    })
    if (!existant) return NextResponse.json({ error: 'Utilisateur introuvable' }, { status: 404 })

    const body = await request.json()
    const { nom, prenom, email, role, actif, brancheType, scoutIds } = body as {
      nom?: string; prenom?: string; email?: string; role?: string; actif?: boolean; brancheType?: string | null
      scoutIds?: unknown
    }

    if (role !== undefined && !(role in RoleUtilisateur))
      return NextResponse.json({ error: 'Rôle invalide' }, { status: 400 })

    if (scoutIds !== undefined && !Array.isArray(scoutIds))
      return NextResponse.json({ error: 'La liste des enfants est invalide' }, { status: 400 })

    // undefined = champ non envoyé, ne touche pas aux enfants rattachés ;
    // tableau (même vide) = remplace intégralement la liste. Un compte staff
    // (Chef de Groupe, encadrement de branche, Ressources Adultes…) peut être
    // rattaché à des enfants tout autant qu'un compte PARENT dédié — voir
    // POST ci-dessus pour la même règle à la création.
    const scoutIdsUniques = Array.isArray(scoutIds)
      ? [...new Set(scoutIds.map((sid) => (typeof sid === 'string' ? sid.trim() : '')).filter(Boolean))]
      : undefined

    if (scoutIdsUniques && scoutIdsUniques.length > 0) {
      const scoutsAutorises = await prisma.scout.count({ where: { id: { in: scoutIdsUniques }, paroisseId } })
      if (scoutsAutorises !== scoutIdsUniques.length) {
        return NextResponse.json({ error: 'Un ou plusieurs enfants sélectionnés sont introuvables' }, { status: 400 })
      }
    }

    if (brancheType != null && !BrancheTypeSchema.safeParse(brancheType).success)
      return NextResponse.json({ error: 'Branche invalide' }, { status: 400 })

    // Un admin plateforme (transverse, sans paroisse) ne se promeut jamais
    // depuis cette route, quel que soit qui l'appelle. Les rôles de district
    // ne sont pas non plus assignables ici : gérés par ADMIN_PLATEFORME (création)
    // puis par le Commissaire de District lui-même via /district/equipe.
    if (role === 'ADMIN_PLATEFORME' || (role !== undefined && ROLES_DISTRICT_ETENDU.includes(role)))
      return NextResponse.json({ error: 'Rôle invalide' }, { status: 400 })

    // Personne ne peut changer son propre rôle ou se désactiver soi-même —
    // sans quoi un compte connaissant son propre id pourrait s'auto-promouvoir
    // ou verrouiller son propre accès.
    if (id === session.user.id && ((role !== undefined && role !== existant.role) || actif === false)) {
      return NextResponse.json({ error: 'Vous ne pouvez pas modifier votre propre rôle ou vous désactiver' }, { status: 403 })
    }

    if (email !== undefined && email !== null && email !== '') {
      const doublon = await prisma.utilisateur.findFirst({
        where: { email: { equals: email, mode: 'insensitive' }, NOT: { id } },
        select: { id: true },
      })
      if (doublon) return NextResponse.json({ error: 'Cette adresse e-mail est déjà utilisée' }, { status: 400 })
    }

    // brancheType n'a de sens que pour l'encadrement de branche : requis pour
    // ces rôles (même si le rôle final n'a pas changé), forcé à null pour tout
    // autre rôle même s'il n'a pas été envoyé — un utilisateur qui change de
    // rôle vers un rôle hors branche ne doit jamais conserver une branche
    // héritée d'un rôle précédent.
    const roleFinal = role !== undefined ? role : existant.role
    const brancheTypeFinal = !ROLES_BRANCHE.includes(roleFinal)
      ? null
      : brancheType !== undefined
        ? (brancheType as BrancheType | null)
        : existant.brancheType

    if (ROLES_BRANCHE.includes(roleFinal) && !brancheTypeFinal) {
      return NextResponse.json({ error: 'La branche est requise pour ce rôle' }, { status: 400 })
    }

    const utilisateur = await prisma.$transaction(async (tx) => {
      const u = await tx.utilisateur.update({
        where: { id },
        data: {
          ...(nom !== undefined ? { nom } : {}),
          ...(prenom !== undefined ? { prenom } : {}),
          ...(email !== undefined ? { email } : {}),
          ...(role !== undefined ? { role: role as RoleUtilisateur } : {}),
          ...(actif !== undefined ? { actif } : {}),
          brancheType: brancheTypeFinal,
        },
        select: {
          id: true, nom: true, prenom: true, matricule: true, telephone: true,
          email: true, role: true, brancheType: true, actif: true, paroisseId: true,
          createdAt: true, updatedAt: true,
        },
      })

      if (scoutIdsUniques !== undefined) {
        // Remplacement intégral de l'ensemble des enfants rattachés (pas un
        // simple ajout) : un tableau vide détache tous les enfants existants.
        await tx.lienParentScout.deleteMany({ where: { parentId: id, scoutId: { notIn: scoutIdsUniques } } })
        if (scoutIdsUniques.length > 0) {
          await tx.lienParentScout.createMany({
            data: scoutIdsUniques.map((scoutId) => ({ parentId: id, scoutId })),
            skipDuplicates: true,
          })
        }
      }

      return u
    })

    // Renvoyé avec le même champ `enfants` que le GET : sans ça, le cache
    // React Query (qui remplace la donnée en place après un PUT réussi)
    // perdrait les enfants rattachés jusqu'au prochain rechargement complet.
    const liensParent = await prisma.lienParentScout.findMany({
      where: { parentId: id },
      select: { scout: { select: { id: true, nom: true, prenom: true, brancheType: true, matricule: true, actif: true } } },
    })

    if (role !== undefined && role !== existant.role) {
      await enregistrerAudit({
        paroisseId,
        acteurId: session.user.id,
        action: 'UTILISATEUR_ROLE_MODIFIE',
        entite: 'Utilisateur',
        entiteId: id,
        details: { ancienRole: existant.role, nouveauRole: role },
      })
    }
    if (actif !== undefined && actif !== existant.actif) {
      await enregistrerAudit({
        paroisseId,
        acteurId: session.user.id,
        action: actif ? 'UTILISATEUR_REACTIVE' : 'UTILISATEUR_DESACTIVE',
        entite: 'Utilisateur',
        entiteId: id,
      })
    }

    return NextResponse.json({ ...utilisateur, enfants: liensParent.map((lien) => lien.scout) })
  } catch (error) {
    logger.error('PUT /api/utilisateurs/[id]', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

export async function DELETE(_request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    if (!ROLES_AUTORISES.includes(session.user.role)) return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })

    const paroisseId = paroisseIdRequise(session)
    const { id } = await params

    if (id === session.user.id) {
      return NextResponse.json({ error: 'Vous ne pouvez pas vous désactiver vous-même' }, { status: 403 })
    }

    const existant = await prisma.utilisateur.findFirst({
      where: { id, paroisseId, role: { notIn: ROLES_DISTRICT_ETENDU as RoleUtilisateur[] } },
      select: { id: true },
    })
    if (!existant) return NextResponse.json({ error: 'Utilisateur introuvable' }, { status: 404 })

    const utilisateur = await prisma.utilisateur.update({
      where: { id },
      data: { actif: false },
      select: {
        id: true, nom: true, prenom: true, matricule: true, telephone: true,
        email: true, role: true, actif: true, paroisseId: true,
        createdAt: true, updatedAt: true,
      },
    })

    await enregistrerAudit({
      paroisseId,
      acteurId: session.user.id,
      action: 'UTILISATEUR_DESACTIVE',
      entite: 'Utilisateur',
      entiteId: id,
    })

    return NextResponse.json(utilisateur)
  } catch (error) {
    logger.error('DELETE /api/utilisateurs/[id]', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
