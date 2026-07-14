import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { BrancheType, Prisma, Sexe } from '@/app/generated/prisma/client'
import { ROLES_TOUT_STAFF as ROLES_AUTORISES, ROLES_BRANCHE } from '@/lib/roles'
import { getBrancheUtilisateur } from '@/lib/brancheUtilisateur'
import { estCheminLocalValide } from '@/lib/validation'
import { anneeScolaireCourante } from '@/lib/cotisations'
import { logger } from '@/lib/logger'
import { enregistrerAudit } from '@/lib/audit'
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
    const recherche = searchParams.get('recherche') ?? undefined
    const actif = searchParams.get('actif')

    const paroisseId = paroisseIdRequise(session)

    // Les responsables de branche ne voient QUE leur branche — toute valeur
    // "branche" fournie par le client est ignorée pour ce groupe de rôles,
    // sinon un simple `?branche=AUTRE` dans l'URL suffirait à voir toute la paroisse.
    let branche = searchParams.get('branche') ?? undefined
    if (ROLES_BRANCHE.includes(session.user.role)) {
      const bt = await getBrancheUtilisateur(session.user.id, paroisseId)
      // Compte mal configuré (rôle de branche sans brancheType assigné) :
      // aucun résultat plutôt que la paroisse entière par défaut.
      if (!bt) return NextResponse.json({ scouts: [], total: 0, page, totalPages: 0 })
      branche = bt
    }

    const where: Prisma.ScoutWhereInput = {
      paroisseId,
      ...(branche ? { brancheType: branche as BrancheType } : {}),
      ...(actif !== null ? { actif: actif === 'true' } : {}),
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

    const [scoutsBruts, total] = await Promise.all([
      prisma.scout.findMany({
        where,
        select: {
          id: true,
          nom: true,
          prenom: true,
          dateNaissance: true,
          sexe: true,
          brancheType: true,
          matricule: true,
          actif: true,
          photo: true,
          paroisseId: true,
          utilisateurId: true,
          createdAt: true,
          _count: { select: { contactsUrgence: true } },
          cotisations: {
            where: { anneeScolaire: anneeScolaireCourante(), type: 'ADHESION_ANNUELLE' },
            select: { statut: true },
            take: 1,
          },
        },
        orderBy: [{ nom: 'asc' }, { prenom: 'asc' }],
        skip: (page - 1) * limite,
        take: limite,
      }),
      prisma.scout.count({ where }),
    ])

    // "Droit d'adhésion" désigne précisément le type ADHESION_ANNUELLE (pas les
    // frais de camp/autres) — null = aucune cotisation générée cette année,
    // distinct de NON_A_JOUR (générée, pas encore réglée).
    const scouts = scoutsBruts.map(({ cotisations, ...s }) => ({
      ...s,
      statutAdhesion: cotisations[0]?.statut ?? null,
    }))

    const totalPages = Math.ceil(total / limite)

    return NextResponse.json({ scouts, total, page, totalPages })
  } catch (error) {
    logger.error('GET /api/scouts', error)
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

    const paroisseId = paroisseIdRequise(session)

    const body = await request.json()
    const { nom, prenom, dateNaissance, sexe, brancheType, photo, allergies, traitementsMedicaux, contactsUrgence } = body as {
      nom?: string
      prenom?: string
      dateNaissance?: string
      sexe?: string
      brancheType?: string
      photo?: string
      allergies?: string
      traitementsMedicaux?: string
      contactsUrgence?: Array<{
        nom?: string
        prenom?: string
        telephone?: string
        relation?: string
        principal?: boolean
      }>
    }

    // Validation des champs obligatoires
    if (!nom?.trim()) {
      return NextResponse.json({ error: 'Le nom est requis' }, { status: 400 })
    }
    if (!prenom?.trim()) {
      return NextResponse.json({ error: 'Le prénom est requis' }, { status: 400 })
    }
    if (!dateNaissance) {
      return NextResponse.json({ error: 'La date de naissance est requise' }, { status: 400 })
    }
    if (!sexe || !(sexe in Sexe)) {
      return NextResponse.json({ error: 'Le sexe est invalide ou manquant' }, { status: 400 })
    }
    if (!brancheType || !(brancheType in BrancheType)) {
      return NextResponse.json({ error: 'La branche est invalide ou manquante' }, { status: 400 })
    }
    if (photo != null && photo !== '' && !estCheminLocalValide(photo)) {
      return NextResponse.json({ error: 'photo doit être un chemin local (ex : /api/fichiers/…)' }, { status: 400 })
    }

    // Un responsable de branche ne peut inscrire un scout que dans sa propre branche.
    let brancheEffective = brancheType
    if (ROLES_BRANCHE.includes(session.user.role)) {
      const bt = await getBrancheUtilisateur(session.user.id, paroisseId)
      if (!bt) return NextResponse.json({ error: 'Aucune branche assignée' }, { status: 403 })
      brancheEffective = bt
    }

    // Validation des contacts d'urgence
    if (!Array.isArray(contactsUrgence) || contactsUrgence.length === 0) {
      return NextResponse.json(
        { error: 'Au moins un contact d\'urgence est requis' },
        { status: 400 },
      )
    }

    for (const [i, contact] of contactsUrgence.entries()) {
      if (!contact.nom?.trim()) {
        return NextResponse.json(
          { error: `Le nom du contact ${i + 1} est requis` },
          { status: 400 },
        )
      }
      if (!contact.telephone?.trim()) {
        return NextResponse.json(
          { error: `Le téléphone du contact ${i + 1} est requis` },
          { status: 400 },
        )
      }
    }

    // Créer le scout et ses contacts en transaction
    const scout = await prisma.$transaction(async (tx) => {
      const nouveauScout = await tx.scout.create({
        data: {
          nom: nom.trim(),
          prenom: prenom.trim(),
          dateNaissance: new Date(dateNaissance),
          sexe: sexe as Sexe,
          brancheType: brancheEffective as BrancheType,
          photo: photo?.trim() || null,
          allergies: allergies?.trim() || null,
          traitementsMedicaux: traitementsMedicaux?.trim() || null,
          paroisseId,
        },
      })

      // Créer les contacts d'urgence
      for (const contact of contactsUrgence) {
        await tx.contactUrgence.create({
          data: {
            nom: contact.nom!.trim(),
            prenom: contact.prenom?.trim() || null,
            telephone: contact.telephone!.trim(),
            relation: contact.relation?.trim() || null,
            principal: contact.principal ?? false,
            scoutId: nouveauScout.id,
          },
        })
      }

      return tx.scout.findUnique({
        where: { id: nouveauScout.id },
        include: {
          contactsUrgence: true,
        },
      })
    })

    await enregistrerAudit({
      paroisseId,
      acteurId: session.user.id,
      action: 'SCOUT_CREE',
      entite: 'Scout',
      entiteId: scout!.id,
      details: { nom: scout!.nom, prenom: scout!.prenom },
    })

    return NextResponse.json(scout, { status: 201 })
  } catch (error) {
    logger.error('POST /api/scouts', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
