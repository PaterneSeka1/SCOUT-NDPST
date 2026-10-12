import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { BrancheType } from '@/app/generated/prisma/client'
import { ROLES_TOUT_STAFF, ROLES_GROUPE, ROLES_BRANCHE } from '@/lib/roles'
import { getBrancheUtilisateur } from '@/lib/brancheUtilisateur'
import { anneeScolaireCourante, anneeScolaireValide, STATUTS_COTISANT } from '@/lib/cotisations'
import { logger } from '@/lib/logger'
import { enregistrerAudit } from '@/lib/audit'
import { paroisseIdRequise } from '@/lib/session'

// Cotisations V1 (voir lib/perimetreV1.ts) : on ne suit plus les montants ni
// les paiements partiels, seulement « cotisant / non cotisant » par scout et
// par année scolaire. Un scout est cotisant s'il a, pour l'année, une
// cotisation ADHESION_ANNUELLE au statut PAYEE (ou EXONEREE, héritée de
// l'ancien suivi détaillé). Le modèle Cotisation n'est pas modifié.

// GET — liste des scouts actifs avec leur statut de cotisation. Lecture
// ouverte à tout le staff ; l'encadrement de branche ne voit que sa branche.
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
    if (!anneeScolaireValide(anneeScolaire)) {
      return NextResponse.json({ erreur: 'Année scolaire invalide' }, { status: 400 })
    }

    let filtreBranche = searchParams.get('branche') || undefined
    if (ROLES_BRANCHE.includes(session.user.role)) {
      const bt = await getBrancheUtilisateur(session.user.id, paroisseId)
      if (!bt) return NextResponse.json({ anneeScolaire, scouts: [] })
      filtreBranche = bt
    }
    if (filtreBranche && !(filtreBranche in BrancheType)) {
      return NextResponse.json({ erreur: 'Branche invalide' }, { status: 400 })
    }

    const scouts = await prisma.scout.findMany({
      where: {
        paroisseId,
        actif: true,
        ...(filtreBranche ? { brancheType: filtreBranche as BrancheType } : {}),
      },
      select: {
        id: true,
        nom: true,
        prenom: true,
        matricule: true,
        brancheType: true,
        cotisations: {
          where: { anneeScolaire, type: 'ADHESION_ANNUELLE', statut: { in: STATUTS_COTISANT } },
          select: { id: true },
          take: 1,
        },
      },
      orderBy: [{ nom: 'asc' }, { prenom: 'asc' }],
    })

    return NextResponse.json({
      anneeScolaire,
      scouts: scouts.map(({ cotisations, ...s }) => ({ ...s, cotisant: cotisations.length > 0 })),
    })
  } catch (error) {
    logger.error('GET /api/cotisations/statuts', error)
    return NextResponse.json({ erreur: 'Erreur serveur' }, { status: 500 })
  }
}

// PUT — marque un scout cotisant ou non cotisant pour une année. Réservé au
// Chef de Groupe (administrateur de la paroisse).
export async function PUT(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return NextResponse.json({ erreur: 'Non authentifié' }, { status: 401 })
    if (!ROLES_GROUPE.includes(session.user.role)) {
      return NextResponse.json({ erreur: 'Accès refusé' }, { status: 403 })
    }
    const paroisseId = paroisseIdRequise(session)

    const body = await req.json()
    const { scoutId, cotisant, anneeScolaire: anneeCorps } = body as {
      scoutId?: string
      cotisant?: boolean
      anneeScolaire?: string
    }
    if (typeof scoutId !== 'string' || !scoutId || typeof cotisant !== 'boolean') {
      return NextResponse.json({ erreur: 'scoutId et cotisant sont requis' }, { status: 400 })
    }
    const anneeScolaire = anneeCorps ?? anneeScolaireCourante()
    if (!anneeScolaireValide(anneeScolaire)) {
      return NextResponse.json({ erreur: 'Année scolaire invalide' }, { status: 400 })
    }

    const scout = await prisma.scout.findFirst({ where: { id: scoutId, paroisseId }, select: { id: true } })
    if (!scout) return NextResponse.json({ erreur: 'Scout introuvable' }, { status: 404 })

    // L'ancien suivi détaillé a pu laisser plusieurs lignes ADHESION_ANNUELLE
    // pour la même année : on raisonne sur l'ensemble, comme le GET (cotisant
    // dès qu'une ligne est PAYEE/EXONEREE).
    const lignes = await prisma.cotisation.findMany({
      where: { scoutId, paroisseId, anneeScolaire, type: 'ADHESION_ANNUELLE' },
      orderBy: { createdAt: 'desc' },
    })
    const lignesCotisant = lignes.filter((l) => STATUTS_COTISANT.includes(l.statut))

    if ((lignesCotisant.length > 0) === cotisant) {
      return NextResponse.json({ scoutId, anneeScolaire, cotisant })
    }

    // On ne supprime jamais une ligne : le passage à « non cotisant » repasse
    // les cotisations EN_ATTENTE, pour garder l'historique (et l'audit) cohérents.
    let modifiees: { id: string; ancienStatut: string }[]
    if (cotisant) {
      const derniere = lignes[0]
      const donnees = { statut: 'PAYEE' as const, datePaiement: new Date(), enregistreParId: session.user.id }
      const cotisation = derniere
        ? await prisma.cotisation.update({ where: { id: derniere.id }, data: { ...donnees, montantPaye: derniere.montant } })
        : await prisma.cotisation.create({
            data: { scoutId, paroisseId, anneeScolaire, type: 'ADHESION_ANNUELLE', montant: 0, ...donnees },
          })
      modifiees = [{ id: cotisation.id, ancienStatut: derniere?.statut ?? 'AUCUNE' }]
    } else {
      await prisma.cotisation.updateMany({
        where: { id: { in: lignesCotisant.map((l) => l.id) } },
        data: { statut: 'EN_ATTENTE', montantPaye: 0, datePaiement: null, enregistreParId: null },
      })
      modifiees = lignesCotisant.map((l) => ({ id: l.id, ancienStatut: l.statut }))
    }

    await Promise.all(
      modifiees.map((m) =>
        enregistrerAudit({
          paroisseId,
          acteurId: session.user.id,
          action: 'COTISATION_STATUT_MODIFIE',
          entite: 'Cotisation',
          entiteId: m.id,
          details: { scoutId, anneeScolaire, ancienStatut: m.ancienStatut, nouveauStatut: cotisant ? 'PAYEE' : 'EN_ATTENTE' },
        }),
      ),
    )

    return NextResponse.json({ scoutId, anneeScolaire, cotisant })
  } catch (error) {
    logger.error('PUT /api/cotisations/statuts', error)
    return NextResponse.json({ erreur: 'Erreur serveur' }, { status: 500 })
  }
}
