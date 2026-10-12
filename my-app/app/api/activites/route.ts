import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { ROLES_TOUT_STAFF, ROLES_BRANCHE } from '@/lib/roles'
import { getBrancheUtilisateur, getBrancheDistrictUtilisateur } from '@/lib/brancheUtilisateur'
import { getParoissesDuDistrict } from '@/lib/district'
import { TypeActiviteSchema, BrancheTypeSchema, entierBorne } from '@/lib/validation'
import { paroisseIdRequise } from '@/lib/session'
import { logger } from '@/lib/logger'
import { PERIMETRE_V1 } from '@/lib/perimetreV1'

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }
    if (!ROLES_TOUT_STAFF.includes(session.user.role)) {
      return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
    }
    const paroisseId = paroisseIdRequise(session)

    const { searchParams } = new URL(request.url)
    const page = entierBorne(searchParams.get('page'), 1, 1, Number.MAX_SAFE_INTEGER)
    const limite = entierBorne(searchParams.get('limite'), 20, 1, 100)
    const decalage = (page - 1) * limite
    const recherche = searchParams.get('recherche') ?? ''
    const type = searchParams.get('type') ?? ''
    const brancheType = searchParams.get('brancheType') ?? ''

    if (type && !TypeActiviteSchema.safeParse(type).success) {
      return NextResponse.json({ error: "Type d'activité invalide" }, { status: 400 })
    }

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
      if (!BrancheTypeSchema.safeParse(brancheType).success) {
        return NextResponse.json({ error: 'Branche invalide' }, { status: 400 })
      }
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

    // `?aVenir=1` : uniquement les activités à venir, de la plus proche à la
    // plus lointaine (par défaut : toutes, de la plus récente à la plus ancienne).
    const aVenir = searchParams.get('aVenir') === '1'
    if (aVenir) where.dateDebut = { gte: new Date() }

    const [activites, total] = await Promise.all([
      prisma.activite.findMany({
        where,
        include: {
          _count: { select: { presences: true } },
        },
        orderBy: { dateDebut: aVenir ? 'asc' : 'desc' },
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
  } catch (error) {
    logger.error('GET /api/activites', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }
    const estAssistantDistrict = session.user.roleDistrict === 'ASSISTANT_DISTRICT'
    if (!ROLES_TOUT_STAFF.includes(session.user.role) && !estAssistantDistrict) {
      return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
    }

    let corps: unknown
    try {
      corps = await request.json()
    } catch {
      return NextResponse.json({ error: 'Corps JSON invalide' }, { status: 400 })
    }
    if (typeof corps !== 'object' || corps === null) {
      return NextResponse.json({ error: 'Données invalides' }, { status: 400 })
    }
    const { titre, description, dateDebut, dateFin, lieu, type, brancheType, paroisseId: paroisseIdCorps } =
      corps as Record<string, unknown>

    if (typeof titre !== 'string' || !titre.trim() || typeof dateDebut !== 'string' || !dateDebut) {
      return NextResponse.json({ error: 'Le titre et la date de début sont obligatoires' }, { status: 400 })
    }
    if (dateFin !== undefined && typeof dateFin !== 'string') {
      return NextResponse.json({ error: 'La date de fin est invalide' }, { status: 400 })
    }
    const dateDebutObj = new Date(dateDebut)
    if (Number.isNaN(dateDebutObj.getTime())) {
      return NextResponse.json({ error: 'La date de début est invalide' }, { status: 400 })
    }
    const dateFinObj = dateFin ? new Date(dateFin) : null
    if (dateFin && (!dateFinObj || Number.isNaN(dateFinObj.getTime()))) {
      return NextResponse.json({ error: 'La date de fin est invalide' }, { status: 400 })
    }
    if (dateFinObj && dateFinObj <= dateDebutObj) {
      return NextResponse.json({ error: 'La date de fin doit être après la date de début' }, { status: 400 })
    }

    const typeValide = TypeActiviteSchema.safeParse(type)
    if (type !== undefined && !typeValide.success) {
      return NextResponse.json({ error: "Type d'activité invalide" }, { status: 400 })
    }
    const brancheValide = BrancheTypeSchema.safeParse(brancheType)
    if (brancheType != null && !brancheValide.success) {
      return NextResponse.json({ error: 'Branche invalide' }, { status: 400 })
    }

    let paroisseId: string
    let brancheEffective: string | null = brancheValide.success ? brancheValide.data : null

    // La création via le district (choix de la paroisse cible) n'est utilisée
    // que par /district/ma-branche/activites/nouvelle, seule à envoyer
    // paroisseId dans le corps — un ASSISTANT_DISTRICT qui exerce par ailleurs
    // un rôle paroissial de branche crée normalement via l'autre branche
    // ci-dessous quand ce champ est absent (formulaire du tableau de bord).
    if (estAssistantDistrict && paroisseIdCorps) {
      // Espace district masqué en V1 (voir lib/perimetreV1.ts) : ce chemin
      // reste dans le code mais n'est pas accessible tant que le périmètre V1
      // est actif.
      if (PERIMETRE_V1) {
        return NextResponse.json({ error: 'Fonctionnalité indisponible' }, { status: 403 })
      }
      // Assistant au Commissaire de District chargé d'une branche : choisit la
      // paroisse cible parmi celles de son district, brancheType forcé à sa
      // branche — toute valeur envoyée par le client pour brancheType est ignorée.
      const bt = await getBrancheDistrictUtilisateur(session.user.id)
      if (!bt) return NextResponse.json({ error: 'Aucune branche assignée' }, { status: 403 })
      const { paroisses } = await getParoissesDuDistrict(paroisseIdRequise(session))
      const paroisseIds = paroisses.map((p) => p.id)
      if (typeof paroisseIdCorps !== 'string' || !paroisseIds.includes(paroisseIdCorps)) {
        return NextResponse.json({ error: 'Paroisse invalide ou manquante' }, { status: 400 })
      }
      paroisseId = paroisseIdCorps
      brancheEffective = bt
    } else {
      // Sans paroisseId dans le corps, seul le staff paroissial crée une
      // activité de sa paroisse (un ASSISTANT_DISTRICT sans rôle de staff
      // n'a rien à créer ici).
      if (!ROLES_TOUT_STAFF.includes(session.user.role)) {
        return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
      }
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
        titre: titre.trim(),
        description: typeof description === 'string' ? description.trim() || null : null,
        dateDebut: dateDebutObj,
        dateFin: dateFinObj,
        lieu: typeof lieu === 'string' ? lieu.trim() || null : null,
        type: typeValide.success ? typeValide.data : 'REUNION',
        brancheType: brancheEffective as never,
        paroisseId,
        creePar: session.user.id,
      },
      include: {
        _count: { select: { presences: true } },
      },
    })

    return NextResponse.json(activite, { status: 201 })
  } catch (error) {
    logger.error('POST /api/activites', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
