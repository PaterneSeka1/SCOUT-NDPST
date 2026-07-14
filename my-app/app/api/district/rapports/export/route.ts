import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { BrancheType, StatutCotisation } from '@/app/generated/prisma/client'
import { ROLES_DISTRICT } from '@/lib/roles'
import { paroisseIdRequise } from '@/lib/session'
import { getParoissesDuDistrict, DistrictInvalideError } from '@/lib/district'
import { ENTETE_COTISATION_CSV, ligneCotisationCsv } from '@/lib/cotisationsExport'
import { champCsv as champ, dateFichier, reponseCsv } from '@/lib/csv'
import { enregistrerAudit } from '@/lib/audit'
import { logger } from '@/lib/logger'

// Export CSV des droits d'adhésion pour tout le district (même périmètre que
// GET /api/district/rapports, réservé au Commissaire de District lui-même —
// pas ses adjoints/assistants, cohérent avec le reste du rapport district).
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return NextResponse.json({ erreur: 'Non authentifié' }, { status: 401 })
    if (!session.user.roleDistrict || !ROLES_DISTRICT.includes(session.user.roleDistrict)) {
      return NextResponse.json({ erreur: 'Accès refusé' }, { status: 403 })
    }

    const paroisseAncrage = paroisseIdRequise(session)
    const { paroisses } = await getParoissesDuDistrict(paroisseAncrage)
    const paroisseIds = paroisses.map((p) => p.id)

    const { searchParams } = new URL(request.url)
    const paroisseIdFiltre = searchParams.get('paroisseId') || undefined
    const branche = searchParams.get('branche') || undefined
    const statuts = searchParams.getAll('statut')

    // Un commissaire ne doit jamais pouvoir faire fuiter une paroisse hors de
    // son propre district en manipulant le paramètre `paroisseId` (IDOR).
    if (paroisseIdFiltre && !paroisseIds.includes(paroisseIdFiltre)) {
      return NextResponse.json({ erreur: 'Paroisse hors du district' }, { status: 400 })
    }
    if (branche !== undefined && !(branche in BrancheType)) {
      return NextResponse.json({ erreur: 'Branche invalide' }, { status: 400 })
    }
    if (statuts.some((s) => !(s in StatutCotisation))) {
      return NextResponse.json({ erreur: 'Statut invalide' }, { status: 400 })
    }

    const cotisations = await prisma.cotisation.findMany({
      where: {
        paroisseId: paroisseIdFiltre ?? { in: paroisseIds },
        ...(statuts.length ? { statut: { in: statuts as StatutCotisation[] } } : {}),
        ...(branche
          ? {
              OR: [
                { scout: { brancheType: branche as BrancheType } },
                { utilisateur: { brancheType: branche as BrancheType } },
              ],
            }
          : {}),
      },
      select: {
        type: true,
        libelle: true,
        montant: true,
        montantPaye: true,
        anneeScolaire: true,
        statut: true,
        datePaiement: true,
        modePaiement: true,
        scout: { select: { nom: true, prenom: true, matricule: true, brancheType: true } },
        utilisateur: { select: { nom: true, prenom: true, matricule: true, role: true, brancheType: true } },
        collectePar: { select: { nom: true, prenom: true, role: true } },
        enregistrePar: { select: { nom: true, prenom: true, role: true } },
        paroisse: { select: { nom: true, ville: true } },
      },
      orderBy: [{ anneeScolaire: 'desc' }, { paroisse: { nom: 'asc' } }, { createdAt: 'desc' }],
    })

    await enregistrerAudit({
      paroisseId: paroisseAncrage,
      acteurId: session.user.id,
      action: 'RAPPORT_DISTRICT_EXPORTE',
      entite: 'RapportDistrict',
      entiteId: null,
      details: { paroisseId: paroisseIdFiltre ?? null, branche: branche ?? null, statuts },
    })

    return reponseCsv(`rapport-cotisations-district_${dateFichier()}.csv`, [
      `"Paroisse";"Ville";${ENTETE_COTISATION_CSV}`,
      ...cotisations.map((c) => `${champ(c.paroisse.nom)};${champ(c.paroisse.ville)};${ligneCotisationCsv(c)}`),
    ])
  } catch (error) {
    if (error instanceof DistrictInvalideError) {
      return NextResponse.json({ erreur: error.message }, { status: 400 })
    }
    logger.error('GET /api/district/rapports/export', error)
    return NextResponse.json({ erreur: 'Erreur serveur' }, { status: 500 })
  }
}
