import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { ROLES_PLATEFORME, ROLES_TOUT_STAFF } from '@/lib/roles'
import { anneeScolaireCourante } from '@/lib/cotisations'
import { enregistrerAudit } from '@/lib/audit'
import { logger } from '@/lib/logger'

type RouteParams = { params: Promise<{ id: string }> }

// Bascule administrative simplifiée du droit d'adhésion (année pastorale en
// cours) : à jour (PAYEE) ou pas à jour (EN_ATTENTE) — sans le détail du
// workflow de collecte (partiel, argent reçu, payé site...) réservé aux
// responsables de paroisse via PUT /api/cotisations/[id]. Un admin plateforme
// n'a pas de paroisse propre et ne collecte pas d'argent : montant à 0 quand
// il crée lui-même l'enregistrement plutôt que de deviner un montant dû.
export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return NextResponse.json({ erreur: 'Non authentifié' }, { status: 401 })
    if (!ROLES_PLATEFORME.includes(session.user.role)) {
      return NextResponse.json({ erreur: 'Accès refusé' }, { status: 403 })
    }

    const { id } = await params
    const utilisateur = await prisma.utilisateur.findFirst({
      where: { id, role: { not: 'ADMIN_PLATEFORME' } },
      select: { id: true, role: true, paroisseId: true },
    })
    if (!utilisateur) return NextResponse.json({ erreur: 'Utilisateur introuvable' }, { status: 404 })
    if (!ROLES_TOUT_STAFF.includes(utilisateur.role) || !utilisateur.paroisseId) {
      return NextResponse.json({ erreur: "Le droit d'adhésion ne s'applique pas à ce rôle" }, { status: 400 })
    }

    const body = await request.json()
    const { aJour } = body as { aJour?: unknown }
    if (typeof aJour !== 'boolean') {
      return NextResponse.json({ erreur: 'Le champ aJour (booléen) est requis' }, { status: 400 })
    }

    const anneeScolaire = anneeScolaireCourante()
    const existante = await prisma.cotisation.findFirst({
      where: { utilisateurId: utilisateur.id, anneeScolaire, type: 'ADHESION_ANNUELLE' },
    })

    // Déjà "pas à jour" par défaut (aucune cotisation générée) — rien à faire,
    // on ne crée pas de ligne fantôme juste pour confirmer un état déjà vrai.
    if (!existante && !aJour) {
      return NextResponse.json({ statutAdhesion: null })
    }

    const ancienStatut = existante?.statut ?? null

    const cotisation = existante
      ? await prisma.cotisation.update({
          where: { id: existante.id },
          data: aJour
            ? { statut: 'PAYEE', montantPaye: existante.montant, datePaiement: new Date(), enregistreParId: session.user.id }
            : { statut: 'EN_ATTENTE', montantPaye: 0, datePaiement: null, enregistreParId: session.user.id },
        })
      : await prisma.cotisation.create({
          data: {
            type: 'ADHESION_ANNUELLE',
            montant: 0,
            montantPaye: 0,
            anneeScolaire,
            statut: 'PAYEE',
            datePaiement: new Date(),
            utilisateurId: utilisateur.id,
            paroisseId: utilisateur.paroisseId,
            enregistreParId: session.user.id,
          },
        })

    await enregistrerAudit({
      paroisseId: utilisateur.paroisseId,
      acteurId: session.user.id,
      action: 'COTISATION_STATUT_MODIFIE',
      entite: 'Cotisation',
      entiteId: cotisation.id,
      details: { utilisateurId: utilisateur.id, ancienStatut, nouveauStatut: cotisation.statut, source: 'admin_plateforme' },
    })

    return NextResponse.json({ statutAdhesion: cotisation.statut })
  } catch (error) {
    logger.error('PUT /api/admin/utilisateurs/[id]/adhesion', error)
    return NextResponse.json({ erreur: 'Erreur serveur' }, { status: 500 })
  }
}
