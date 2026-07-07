import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { BrancheType, Sexe } from '@/app/generated/prisma/client'
import { ROLES_TOUT_STAFF as ROLES_AUTORISES, ROLES_BRANCHE } from '@/lib/roles'
import { getBrancheUtilisateur } from '@/lib/brancheUtilisateur'
import { estCheminLocalValide } from '@/lib/validation'
import { logger } from '@/lib/logger'
import { enregistrerAudit } from '@/lib/audit'

type RouteParams = { params: Promise<{ id: string }> }

export async function GET(_request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }

    if (!ROLES_AUTORISES.includes(session.user.role)) {
      return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
    }

    const { id } = await params

    // Un responsable de branche ne peut consulter que les scouts de sa propre branche.
    let brancheRequise: string | undefined
    if (ROLES_BRANCHE.includes(session.user.role)) {
      const bt = await getBrancheUtilisateur(session.user.id, session.user.paroisseId)
      if (!bt) return NextResponse.json({ error: 'Scout introuvable' }, { status: 404 })
      brancheRequise = bt
    }

    const scout = await prisma.scout.findFirst({
      where: {
        id,
        paroisseId: session.user.paroisseId,
        ...(brancheRequise ? { brancheType: brancheRequise as BrancheType } : {}),
      },
      include: {
        contactsUrgence: {
          orderBy: [{ principal: 'desc' }, { nom: 'asc' }],
        },
        documents: {
          orderBy: { createdAt: 'desc' },
        },
        liensParents: {
          include: {
            parent: {
              select: {
                id: true,
                nom: true,
                prenom: true,
                telephone: true,
                email: true,
                role: true,
              },
            },
          },
        },
        utilisateur: {
          select: {
            id: true,
            nom: true,
            prenom: true,
            matricule: true,
            actif: true,
          },
        },
        cotisations: {
          orderBy: [{ statut: 'asc' }, { anneeScolaire: 'desc' }],
          select: { id: true, type: true, libelle: true, montant: true, anneeScolaire: true, statut: true, datePaiement: true },
        },
      },
    })

    if (!scout) {
      return NextResponse.json({ error: 'Scout introuvable' }, { status: 404 })
    }

    return NextResponse.json(scout)
  } catch (error) {
    logger.error('GET /api/scouts/[id]', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }

    if (!ROLES_AUTORISES.includes(session.user.role)) {
      return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
    }

    const { id } = await params

    // Un responsable de branche ne peut modifier que les scouts de sa propre branche.
    let brancheUtilisateur: string | undefined
    if (ROLES_BRANCHE.includes(session.user.role)) {
      const bt = await getBrancheUtilisateur(session.user.id, session.user.paroisseId)
      if (!bt) return NextResponse.json({ error: 'Scout introuvable' }, { status: 404 })
      brancheUtilisateur = bt
    }

    const existant = await prisma.scout.findFirst({
      where: {
        id,
        paroisseId: session.user.paroisseId,
        ...(brancheUtilisateur ? { brancheType: brancheUtilisateur as BrancheType } : {}),
      },
      select: { id: true, brancheType: true },
    })

    if (!existant) {
      return NextResponse.json({ error: 'Scout introuvable' }, { status: 404 })
    }

    const body = await request.json()
    const { nom, prenom, dateNaissance, sexe, brancheType, actif, photo, allergies, traitementsMedicaux, consentementImage } = body as {
      nom?: string
      prenom?: string
      dateNaissance?: string
      sexe?: string
      brancheType?: string
      actif?: boolean
      photo?: string
      allergies?: string | null
      traitementsMedicaux?: string | null
      consentementImage?: boolean
    }

    if (sexe !== undefined && !(sexe in Sexe)) {
      return NextResponse.json({ error: 'Sexe invalide' }, { status: 400 })
    }
    if (brancheType !== undefined && !(brancheType in BrancheType)) {
      return NextResponse.json({ error: 'Branche invalide' }, { status: 400 })
    }
    // Le changement de branche est réservé au groupe (fonctionnalité dédiée
    // "passage de branche") — un responsable de branche ne peut pas déplacer
    // un scout vers une autre branche via cette route.
    if (brancheUtilisateur && brancheType !== undefined && brancheType !== existant.brancheType) {
      return NextResponse.json({ error: 'Le changement de branche est réservé au groupe' }, { status: 403 })
    }
    if (photo != null && photo !== '' && !estCheminLocalValide(photo)) {
      return NextResponse.json({ error: 'photo doit être un chemin local (ex : /api/fichiers/…)' }, { status: 400 })
    }

    const scout = await prisma.scout.update({
      where: { id },
      data: {
        ...(nom !== undefined ? { nom: nom.trim() } : {}),
        ...(prenom !== undefined ? { prenom: prenom.trim() } : {}),
        ...(dateNaissance !== undefined ? { dateNaissance: new Date(dateNaissance) } : {}),
        ...(sexe !== undefined ? { sexe: sexe as Sexe } : {}),
        ...(brancheType !== undefined ? { brancheType: brancheType as BrancheType } : {}),
        ...(actif !== undefined ? { actif } : {}),
        ...(photo !== undefined ? { photo: photo?.trim() || null } : {}),
        ...(allergies !== undefined ? { allergies: allergies?.trim() || null } : {}),
        ...(traitementsMedicaux !== undefined ? { traitementsMedicaux: traitementsMedicaux?.trim() || null } : {}),
        ...(consentementImage !== undefined
          ? {
              consentementImage,
              consentementImageDate: consentementImage ? new Date() : null,
              consentementImageParId: consentementImage ? session.user.id : null,
            }
          : {}),
      },
      include: {
        contactsUrgence: true,
      },
    })

    if (consentementImage !== undefined) {
      await enregistrerAudit({
        paroisseId: session.user.paroisseId,
        acteurId: session.user.id,
        action: 'SCOUT_CONSENTEMENT_IMAGE_MODIFIE',
        entite: 'Scout',
        entiteId: id,
        details: { consentementImage },
      })
    }

    return NextResponse.json(scout)
  } catch (error) {
    logger.error('PUT /api/scouts/[id]', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
