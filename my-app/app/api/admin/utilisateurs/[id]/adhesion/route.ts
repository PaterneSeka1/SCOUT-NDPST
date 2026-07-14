import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { StatutCotisation } from '@/app/generated/prisma/client'
import { ROLES_PLATEFORME } from '@/lib/roles'
import { anneeScolaireCourante, estAssujettiAdhesion } from '@/lib/cotisations'
import { enregistrerAudit } from '@/lib/audit'
import { logger } from '@/lib/logger'

type RouteParams = { params: Promise<{ id: string }> }

// Mêmes transitions que PUT /api/cotisations/[id] (montantPaye/collecteParId
// selon le statut) — dupliquées ici volontairement : cette route opère sur
// scoutId OU utilisateurId selon le rôle, pas seulement sur un id de
// cotisation déjà résolu, et reste une surface simplifiée à part (pas de
// distinction "payé" / "exonéré" ici, contrairement au workflow paroissial —
// un admin plateforme n'a pas de montant réel à faire correspondre).
function donneesTransition(statut: StatutCotisation, montant: number, acteurId: string, collecteParExistant: string | null) {
  switch (statut) {
    case 'NON_A_JOUR':
      return { statut, montantPaye: 0, datePaiement: null, enregistreParId: null, collecteParId: null }
    case 'ARGENT_RECU':
      return { statut, montantPaye: montant, datePaiement: new Date(), enregistreParId: acteurId, collecteParId: acteurId }
    case 'A_JOUR':
      return {
        statut,
        montantPaye: montant,
        datePaiement: new Date(),
        enregistreParId: acteurId,
        collecteParId: collecteParExistant ?? acteurId,
      }
  }
}

// Bascule administrative du droit d'adhésion (année pastorale en cours) —
// mêmes 3 statuts que partout ailleurs dans l'application. Un admin
// plateforme n'a pas de paroisse propre et ne collecte pas d'argent : montant
// à 0 quand il crée lui-même l'enregistrement plutôt que de deviner un
// montant dû.
//
// S'applique au staff (Cotisation.utilisateurId) ET aux comptes SCOUT, dont
// l'adhésion réelle vit sur leur fiche Scout liée (Cotisation.scoutId) —
// jamais à PARENT, qui ne paie pas d'adhésion.
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
      select: { id: true, role: true, paroisseId: true, ficheScout: { select: { id: true } } },
    })
    if (!utilisateur) return NextResponse.json({ erreur: 'Utilisateur introuvable' }, { status: 404 })
    if (!estAssujettiAdhesion(utilisateur.role) || !utilisateur.paroisseId) {
      return NextResponse.json({ erreur: "Le droit d'adhésion ne s'applique pas à ce rôle" }, { status: 400 })
    }
    if (utilisateur.role === 'SCOUT' && !utilisateur.ficheScout) {
      return NextResponse.json({ erreur: "Ce compte scout n'est lié à aucune fiche scout" }, { status: 400 })
    }

    const body = await request.json()
    const { statut } = body as { statut?: unknown }
    if (typeof statut !== 'string' || !(statut in StatutCotisation)) {
      return NextResponse.json({ erreur: 'Statut invalide' }, { status: 400 })
    }

    // La cible réelle de la Cotisation diffère selon le rôle : un compte SCOUT
    // pointe vers sa fiche Scout (scoutId), tout le reste vers l'utilisateur
    // lui-même (utilisateurId) — jamais les deux (contrainte CHECK en base).
    // `undefined` sur le champ non concerné : Prisma l'ignore aussi bien dans
    // un `where` que dans un `create`.
    const estScout = utilisateur.role === 'SCOUT'
    const scoutId = estScout ? utilisateur.ficheScout!.id : undefined
    const utilisateurId = estScout ? undefined : utilisateur.id

    const anneeScolaire = anneeScolaireCourante()
    const existante = await prisma.cotisation.findFirst({
      where: { scoutId, utilisateurId, anneeScolaire, type: 'ADHESION_ANNUELLE' },
    })

    const ancienStatut = existante?.statut ?? null
    const transition = donneesTransition(statut as StatutCotisation, existante?.montant ?? 0, session.user.id, existante?.collecteParId ?? null)

    const cotisation = existante
      ? await prisma.cotisation.update({ where: { id: existante.id }, data: transition })
      : await prisma.cotisation.create({
          data: {
            type: 'ADHESION_ANNUELLE',
            montant: 0,
            anneeScolaire,
            scoutId,
            utilisateurId,
            paroisseId: utilisateur.paroisseId,
            ...transition,
          },
        })

    await enregistrerAudit({
      paroisseId: utilisateur.paroisseId,
      acteurId: session.user.id,
      action: 'COTISATION_STATUT_MODIFIE',
      entite: 'Cotisation',
      entiteId: cotisation.id,
      details: {
        utilisateurId: utilisateurId ?? null,
        scoutId: scoutId ?? null,
        ancienStatut,
        nouveauStatut: cotisation.statut,
        source: 'admin_plateforme',
      },
    })

    return NextResponse.json({ statutAdhesion: cotisation.statut })
  } catch (error) {
    logger.error('PUT /api/admin/utilisateurs/[id]/adhesion', error)
    return NextResponse.json({ erreur: 'Erreur serveur' }, { status: 500 })
  }
}
