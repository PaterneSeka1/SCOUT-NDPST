import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { TypeCotisation, StatutCotisation } from '@/app/generated/prisma/client'
import { ROLES_TOUT_STAFF, ROLES_GROUPE, ROLES_BRANCHE } from '@/lib/roles'
import { anneeScolaireCourante } from '@/lib/cotisations'
import { logger } from '@/lib/logger'
import { enregistrerAudit } from '@/lib/audit'

async function getBrancheUtilisateur(userId: string, paroisseId: string) {
  const poste = await prisma.posteBranche.findFirst({
    where: { utilisateurId: userId, paroisseId },
    select: { brancheType: true },
    orderBy: { createdAt: 'asc' },
  })
  return poste?.brancheType ?? null
}

// GET — liste des cotisations de la paroisse (staff uniquement). Les
// responsables de branche ne voient que les scouts de leur branche.
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return NextResponse.json({ erreur: 'Non authentifié' }, { status: 401 })
    if (!ROLES_TOUT_STAFF.includes(session.user.role)) {
      return NextResponse.json({ erreur: 'Accès refusé' }, { status: 403 })
    }

    const { searchParams } = new URL(req.url)
    const anneeScolaire = searchParams.get('anneeScolaire') ?? anneeScolaireCourante()
    const statut = searchParams.get('statut') ?? undefined
    const brancheParam = searchParams.get('branche') ?? undefined

    let filtreBranche = brancheParam
    if (ROLES_BRANCHE.includes(session.user.role) && !brancheParam) {
      const bt = await getBrancheUtilisateur(session.user.id, session.user.paroisseId)
      if (bt) filtreBranche = bt
    }

    if (statut !== undefined && !(statut in StatutCotisation)) {
      return NextResponse.json({ erreur: 'Statut invalide' }, { status: 400 })
    }

    const cotisations = await prisma.cotisation.findMany({
      where: {
        paroisseId: session.user.paroisseId,
        anneeScolaire,
        ...(statut ? { statut: statut as StatutCotisation } : {}),
        ...(filtreBranche ? { scout: { brancheType: filtreBranche as never } } : {}),
      },
      include: {
        scout: { select: { id: true, nom: true, prenom: true, brancheType: true, matricule: true, actif: true } },
        enregistrePar: { select: { id: true, nom: true, prenom: true } },
      },
      orderBy: [{ statut: 'asc' }, { scout: { nom: 'asc' } }],
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

    const body = await req.json()
    const { scoutId, scoutIds, type, libelle, montant, anneeScolaire } = body as {
      scoutId?: string
      scoutIds?: string[]
      type?: string
      libelle?: string
      montant?: number
      anneeScolaire?: string
    }

    const cibles = scoutIds?.length ? scoutIds : scoutId ? [scoutId] : []
    if (cibles.length === 0) {
      return NextResponse.json({ erreur: 'scoutId ou scoutIds est requis' }, { status: 400 })
    }
    if (!type || !(type in TypeCotisation)) {
      return NextResponse.json({ erreur: 'Type de cotisation invalide' }, { status: 400 })
    }
    if (typeof montant !== 'number' || montant < 0 || !Number.isInteger(montant)) {
      return NextResponse.json({ erreur: 'Le montant doit être un entier positif' }, { status: 400 })
    }
    const annee = anneeScolaire?.trim() || anneeScolaireCourante()

    const scouts = await prisma.scout.findMany({
      where: { id: { in: cibles }, paroisseId: session.user.paroisseId },
      select: { id: true },
    })
    if (scouts.length !== cibles.length) {
      return NextResponse.json({ erreur: 'Un ou plusieurs scouts sont introuvables' }, { status: 404 })
    }

    const cotisations = await prisma.$transaction(
      scouts.map((s) =>
        prisma.cotisation.create({
          data: {
            scoutId: s.id,
            paroisseId: session.user.paroisseId,
            type: type as TypeCotisation,
            libelle: libelle?.trim() || null,
            montant,
            anneeScolaire: annee,
          },
        }),
      ),
    )

    await Promise.all(
      cotisations.map((c) =>
        enregistrerAudit({
          paroisseId: session.user.paroisseId,
          acteurId: session.user.id,
          action: 'COTISATION_CREEE',
          entite: 'Cotisation',
          entiteId: c.id,
          details: { scoutId: c.scoutId, type: c.type, montant: c.montant, anneeScolaire: c.anneeScolaire },
        }),
      ),
    )

    return NextResponse.json({ cotisations }, { status: 201 })
  } catch (error) {
    logger.error('POST /api/cotisations', error)
    return NextResponse.json({ erreur: 'Erreur serveur' }, { status: 500 })
  }
}
