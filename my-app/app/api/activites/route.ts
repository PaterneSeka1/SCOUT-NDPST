import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { ROLES_TOUT_STAFF, ROLES_BRANCHE } from '@/lib/roles'
import { getBrancheUtilisateur, getBrancheDistrictUtilisateur } from '@/lib/brancheUtilisateur'
import { getParoissesDuDistrict } from '@/lib/district'
import { TypeActiviteSchema, BrancheTypeSchema } from '@/lib/validation'
import { paroisseIdRequise } from '@/lib/session'

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
  }
  if (!ROLES_TOUT_STAFF.includes(session.user.role)) {
    return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
  }
  const paroisseId = paroisseIdRequise(session)

  const { searchParams } = new URL(request.url)
  const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10))
  const limite = Math.max(1, parseInt(searchParams.get('limite') ?? '20', 10))
  const decalage = (page - 1) * limite
  const recherche = searchParams.get('recherche') ?? ''
  const type = searchParams.get('type') ?? ''
  const brancheType = searchParams.get('brancheType') ?? ''

  const where: Record<string, unknown> = {
    paroisseId,
  }

  // Les responsables de branche ne voient que leur branche + les activités
  // inter-branches (brancheType null) — toute valeur "brancheType" fournie
  // par le client est ignorée pour ce groupe de rôles.
  if (ROLES_BRANCHE.includes(session.user.role)) {
    const bt = await getBrancheUtilisateur(session.user.id, paroisseId)
    // Compte mal configuré (rôle de branche sans brancheType assigné) :
    // aucun résultat plutôt que la paroisse entière par défaut.
    if (!bt) {
      return NextResponse.json({ activites: [], pagination: { page, limite, total: 0, totalPages: 0 } })
    }
    where.OR = [{ brancheType: bt }, { brancheType: null }]
  } else if (brancheType) {
    where.brancheType = brancheType
  }

  if (recherche) {
    // `where.OR` peut déjà être occupé par le scoping de branche ci-dessus —
    // on combine les deux conditions avec AND plutôt que d'écraser l'une des deux.
    const rechercheOr = [
      { titre: { contains: recherche, mode: 'insensitive' } },
      { lieu: { contains: recherche, mode: 'insensitive' } },
    ]
    if (where.OR) {
      where.AND = [{ OR: where.OR }, { OR: rechercheOr }]
      delete where.OR
    } else {
      where.OR = rechercheOr
    }
  }
  if (type) where.type = type

  const [activites, total] = await Promise.all([
    prisma.activite.findMany({
      where,
      include: {
        _count: { select: { presences: true } },
      },
      orderBy: { dateDebut: 'desc' },
      skip: decalage,
      take: limite,
    }),
    prisma.activite.count({ where }),
  ])

  return NextResponse.json({
    activites,
    pagination: {
      page,
      limite,
      total,
      totalPages: Math.ceil(total / limite),
    },
  })
}

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
  }
  const estAssistantDistrict = session.user.roleDistrict === 'ASSISTANT_DISTRICT'
  if (!ROLES_TOUT_STAFF.includes(session.user.role) && !estAssistantDistrict) {
    return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
  }

  const corps = await request.json()
  const { titre, description, dateDebut, dateFin, lieu, type, brancheType, paroisseId: paroisseIdCorps } = corps

  if (!titre || !dateDebut) {
    return NextResponse.json({ error: 'Le titre et la date de début sont obligatoires' }, { status: 400 })
  }

  if (type !== undefined && !TypeActiviteSchema.safeParse(type).success) {
    return NextResponse.json({ error: "Type d'activité invalide" }, { status: 400 })
  }
  if (brancheType != null && !BrancheTypeSchema.safeParse(brancheType).success) {
    return NextResponse.json({ error: 'Branche invalide' }, { status: 400 })
  }

  let paroisseId: string
  let brancheEffective = brancheType ?? null

  // La création via le district (choix de la paroisse cible) n'est utilisée
  // que par /district/ma-branche/activites/nouvelle, seule à envoyer
  // paroisseId dans le corps — un ASSISTANT_DISTRICT qui exerce par ailleurs
  // un rôle paroissial de branche crée normalement via l'autre branche
  // ci-dessous quand ce champ est absent (formulaire du tableau de bord).
  if (estAssistantDistrict && paroisseIdCorps) {
    // Assistant au Commissaire de District chargé d'une branche : choisit la
    // paroisse cible parmi celles de son district, brancheType forcé à sa
    // branche — toute valeur envoyée par le client pour brancheType est ignorée.
    const bt = await getBrancheDistrictUtilisateur(session.user.id)
    if (!bt) return NextResponse.json({ error: 'Aucune branche assignée' }, { status: 403 })
    const { paroisses } = await getParoissesDuDistrict(paroisseIdRequise(session))
    const paroisseIds = paroisses.map((p) => p.id)
    if (!paroisseIds.includes(paroisseIdCorps)) {
      return NextResponse.json({ error: 'Paroisse invalide ou manquante' }, { status: 400 })
    }
    paroisseId = paroisseIdCorps
    brancheEffective = bt
  } else {
    paroisseId = paroisseIdRequise(session)
    // Un responsable de branche ne peut créer une activité que pour sa propre
    // branche — décider d'une activité inter-branches (brancheType null) reste
    // une décision du groupe.
    if (ROLES_BRANCHE.includes(session.user.role)) {
      const bt = await getBrancheUtilisateur(session.user.id, paroisseId)
      if (!bt) return NextResponse.json({ error: 'Aucune branche assignée' }, { status: 403 })
      brancheEffective = bt
    }
  }

  const activite = await prisma.activite.create({
    data: {
      titre,
      description: description ?? null,
      dateDebut: new Date(dateDebut),
      dateFin: dateFin ? new Date(dateFin) : null,
      lieu: lieu ?? null,
      type: type ?? 'REUNION',
      brancheType: brancheEffective,
      paroisseId,
      creePar: session.user.id,
    },
    include: {
      _count: { select: { presences: true } },
    },
  })

  return NextResponse.json(activite, { status: 201 })
}
