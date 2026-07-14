import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { Prisma, TypeCotisation, StatutCotisation, BrancheType, RoleUtilisateur } from '@/app/generated/prisma/client'
import { ROLES_TOUT_STAFF, ROLES_GROUPE, ROLES_BRANCHE } from '@/lib/roles'
import { getBrancheUtilisateur } from '@/lib/brancheUtilisateur'
import { anneeScolaireCourante } from '@/lib/cotisations'
import { logger } from '@/lib/logger'
import { enregistrerAudit } from '@/lib/audit'
import { paroisseIdRequise } from '@/lib/session'

// GET — liste des cotisations de la paroisse (staff uniquement). Les
// responsables de branche ne voient que les scouts de leur branche.
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return NextResponse.json({ erreur: 'Non authentifié' }, { status: 401 })
    if (!ROLES_TOUT_STAFF.includes(session.user.role)) {
      return NextResponse.json({ erreur: 'Accès refusé' }, { status: 403 })
    }
    const paroisseId = paroisseIdRequise(session)

    const { searchParams } = new URL(req.url)
    const anneeScolaire = searchParams.get('anneeScolaire') ?? anneeScolaireCourante()
    const statut = searchParams.get('statut') ?? undefined
    const brancheParam = searchParams.get('branche') ?? undefined

    // Les responsables de branche ne voient QUE leur branche — toute valeur
    // "branche" fournie par le client est ignorée pour ce groupe de rôles.
    let filtreBranche = brancheParam
    if (ROLES_BRANCHE.includes(session.user.role)) {
      const bt = await getBrancheUtilisateur(session.user.id, paroisseId)
      // Compte mal configuré (rôle de branche sans brancheType assigné) :
      // aucun résultat plutôt que la paroisse entière par défaut.
      if (!bt) return NextResponse.json({ cotisations: [] })
      filtreBranche = bt
    }

    if (statut !== undefined && !(statut in StatutCotisation)) {
      return NextResponse.json({ erreur: 'Statut invalide' }, { status: 400 })
    }
    if (filtreBranche !== undefined && !(filtreBranche in BrancheType)) {
      return NextResponse.json({ erreur: 'Branche invalide' }, { status: 400 })
    }

    const where: Prisma.CotisationWhereInput = {
      paroisseId,
      anneeScolaire,
      ...(statut ? { statut: statut as StatutCotisation } : {}),
      ...(filtreBranche
        ? {
            OR: [
              { scout: { brancheType: filtreBranche as BrancheType } },
              { utilisateur: { brancheType: filtreBranche as BrancheType } },
            ],
          }
        : {}),
    }

    const cotisations = await prisma.cotisation.findMany({
      where,
      include: {
        scout: { select: { id: true, nom: true, prenom: true, brancheType: true, matricule: true, actif: true } },
        utilisateur: { select: { id: true, nom: true, prenom: true, role: true, brancheType: true, matricule: true, actif: true } },
        enregistrePar: { select: { id: true, nom: true, prenom: true, role: true } },
        collectePar: { select: { id: true, nom: true, prenom: true, role: true } },
      },
      orderBy: [{ statut: 'asc' }, { createdAt: 'desc' }],
    })

    return NextResponse.json({ cotisations })
  } catch (error) {
    logger.error('GET /api/cotisations', error)
    return NextResponse.json({ erreur: 'Erreur serveur' }, { status: 500 })
  }
}

// POST — crée une cotisation (à titre individuel) ou, si `scoutIds` est fourni,
// génère la même cotisation pour plusieurs scouts d'un coup (ex : toute une
// branche en début d'année). Réservé à la direction du groupe : c'est elle qui
// définit ce qui est dû, même si les responsables de branche pourront ensuite
// enregistrer les paiements.
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return NextResponse.json({ erreur: 'Non authentifié' }, { status: 401 })
    if (!ROLES_GROUPE.includes(session.user.role)) {
      return NextResponse.json({ erreur: 'Accès refusé' }, { status: 403 })
    }
    const paroisseId = paroisseIdRequise(session)

    const body = await req.json()
    const { scoutId, scoutIds, utilisateurId, utilisateurIds, cible, branche, type, libelle, montant, anneeScolaire } = body as {
      scoutId?: string
      scoutIds?: string[]
      utilisateurId?: string
      utilisateurIds?: string[]
      cible?: 'SCOUTS_BRANCHE' | 'STAFF_BRANCHE' | 'TOUS_STAFF'
      branche?: string
      type?: string
      libelle?: string
      montant?: number
      anneeScolaire?: string
    }

    if (!type || !(type in TypeCotisation)) {
      return NextResponse.json({ erreur: 'Type de cotisation invalide' }, { status: 400 })
    }
    if (typeof montant !== 'number' || montant < 0 || !Number.isInteger(montant)) {
      return NextResponse.json({ erreur: 'Le montant doit être un entier positif' }, { status: 400 })
    }
    if (branche !== undefined && !(branche in BrancheType)) {
      return NextResponse.json({ erreur: 'Branche invalide' }, { status: 400 })
    }
    const annee = anneeScolaire?.trim() || anneeScolaireCourante()

    let scouts: { id: string }[] = []
    let utilisateurs: { id: string }[] = []

    if (cible === 'SCOUTS_BRANCHE') {
      if (!branche) return NextResponse.json({ erreur: 'La branche est requise' }, { status: 400 })
      scouts = await prisma.scout.findMany({
        where: { paroisseId, actif: true, brancheType: branche as BrancheType },
        select: { id: true },
      })
    } else if (cible === 'STAFF_BRANCHE') {
      if (!branche) return NextResponse.json({ erreur: 'La branche est requise' }, { status: 400 })
      utilisateurs = await prisma.utilisateur.findMany({
        where: {
          paroisseId,
          actif: true,
          role: { in: ROLES_TOUT_STAFF as RoleUtilisateur[] },
          brancheType: branche as BrancheType,
        },
        select: { id: true },
      })
    } else if (cible === 'TOUS_STAFF') {
      utilisateurs = await prisma.utilisateur.findMany({
        where: { paroisseId, actif: true, role: { in: ROLES_TOUT_STAFF as RoleUtilisateur[] } },
        select: { id: true },
      })
    } else {
      const ciblesScouts = scoutIds?.length ? scoutIds : scoutId ? [scoutId] : []
      const ciblesUtilisateurs = utilisateurIds?.length ? utilisateurIds : utilisateurId ? [utilisateurId] : []
      if (ciblesScouts.length === 0 && ciblesUtilisateurs.length === 0) {
        return NextResponse.json({ erreur: 'Choisissez au moins un scout ou un chef/staff' }, { status: 400 })
      }

      scouts = ciblesScouts.length
        ? await prisma.scout.findMany({
            where: { id: { in: ciblesScouts }, paroisseId },
            select: { id: true },
          })
        : []
      utilisateurs = ciblesUtilisateurs.length
        ? await prisma.utilisateur.findMany({
            where: { id: { in: ciblesUtilisateurs }, paroisseId, role: { in: ROLES_TOUT_STAFF as RoleUtilisateur[] } },
            select: { id: true },
          })
        : []

      if (scouts.length !== ciblesScouts.length) {
        return NextResponse.json({ erreur: 'Un ou plusieurs scouts sont introuvables' }, { status: 404 })
      }
      if (utilisateurs.length !== ciblesUtilisateurs.length) {
        return NextResponse.json({ erreur: 'Un ou plusieurs chefs/staff sont introuvables' }, { status: 404 })
      }
    }

    if (scouts.length === 0 && utilisateurs.length === 0) {
      return NextResponse.json({ erreur: 'Aucune personne active ne correspond à cette génération' }, { status: 400 })
    }

    const cotisations = await prisma.$transaction(
      [
        ...scouts.map((s) =>
          prisma.cotisation.create({
            data: {
              scoutId: s.id,
              paroisseId,
              type: type as TypeCotisation,
              libelle: libelle?.trim() || null,
              montant,
              anneeScolaire: annee,
            },
          }),
        ),
        ...utilisateurs.map((u) =>
          prisma.cotisation.create({
            data: {
              utilisateurId: u.id,
              paroisseId,
              type: type as TypeCotisation,
              libelle: libelle?.trim() || null,
              montant,
              anneeScolaire: annee,
            },
          }),
        ),
      ],
    )

    await Promise.all(
      cotisations.map((c) =>
        enregistrerAudit({
          paroisseId,
          acteurId: session.user.id,
          action: 'COTISATION_CREEE',
          entite: 'Cotisation',
          entiteId: c.id,
          details: {
            scoutId: c.scoutId,
            utilisateurId: c.utilisateurId,
            type: c.type,
            montant: c.montant,
            anneeScolaire: c.anneeScolaire,
          },
        }),
      ),
    )

    return NextResponse.json({ cotisations }, { status: 201 })
  } catch (error) {
    logger.error('POST /api/cotisations', error)
    return NextResponse.json({ erreur: 'Erreur serveur' }, { status: 500 })
  }
}
