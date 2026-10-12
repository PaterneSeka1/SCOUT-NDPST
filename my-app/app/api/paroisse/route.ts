import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { Prisma } from '@/app/generated/prisma/client'
import { estUrlFichierValide } from '@/lib/validation'
import { urlPubliqueBase } from '@/lib/storage'
import { ROLES_GROUPE } from '@/lib/roles'
import { logger } from '@/lib/logger'

export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return NextResponse.json({ erreur: 'Non autorisé' }, { status: 401 })

    const paroisseId = session.user.paroisseId
    if (!paroisseId) return NextResponse.json({ erreur: 'Aucune paroisse associée' }, { status: 400 })

    const paroisse = await prisma.paroisse.findUnique({
      where: { id: paroisseId },
      include: {
        district: { select: { id: true, nom: true } },
        _count: { select: { scouts: true, utilisateurs: true, activites: true } },
      },
    })

    if (!paroisse) return NextResponse.json({ erreur: 'Paroisse introuvable' }, { status: 404 })

    return NextResponse.json(paroisse)
  } catch (error) {
    logger.error('GET /api/paroisse', error)
    return NextResponse.json({ erreur: 'Erreur serveur' }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return NextResponse.json({ erreur: 'Non autorisé' }, { status: 401 })

    if (!ROLES_GROUPE.includes(session.user.role))
      return NextResponse.json({ erreur: 'Accès refusé' }, { status: 403 })

    const paroisseId = session.user.paroisseId
    if (!paroisseId) return NextResponse.json({ erreur: 'Aucune paroisse associée' }, { status: 400 })

    let body: unknown
    try {
      body = await req.json()
    } catch {
      return NextResponse.json({ erreur: 'Corps JSON invalide' }, { status: 400 })
    }
    if (typeof body !== 'object' || body === null) {
      return NextResponse.json({ erreur: 'Données invalides' }, { status: 400 })
    }
    // Les couleurs de la paroisse ne sont plus modifiables par le Chef de
    // Groupe (uniquement nom/coordonnées/logo) — pas de champ couleur* ici.
    // district n'est plus modifiable en self-service depuis que ce champ détermine
    // le périmètre d'autorité d'un Commissaire de District (voir lib/district.ts) —
    // seul ADMIN_PLATEFORME peut le modifier, via /admin/paroisses/[id].
    const { nom, ville, diocese, ocean, adresse, telephone, email, logo } = body as {
      nom?: string; ville?: string; diocese?: string; ocean?: string
      adresse?: string; telephone?: string; email?: string; logo?: string
    }

    // Tous ces champs sont des textes : un autre type ferait planter `.trim()`.
    const champsTexte = { nom, ville, diocese, ocean, adresse, telephone, email, logo }
    for (const [champ, valeur] of Object.entries(champsTexte)) {
      if (valeur !== undefined && valeur !== null && typeof valeur !== 'string') {
        return NextResponse.json({ erreur: `${champ} doit être une chaîne de caractères` }, { status: 400 })
      }
    }

    if (logo != null && logo.trim() !== '' && !estUrlFichierValide(logo.trim(), urlPubliqueBase())) {
      return NextResponse.json({ erreur: 'logo doit être un chemin local (ex : /api/fichiers-publics/…) ou une URL de stockage autorisée' }, { status: 400 })
    }

    const paroisse = await prisma.paroisse.update({
      where: { id: paroisseId },
      data: {
        ...(nom != null ? { nom: nom.trim() } : {}),
        ...(ville != null ? { ville: ville.trim() } : {}),
        ...(diocese != null ? { diocese: diocese.trim() } : {}),
        ...(ocean !== undefined ? { ocean: ocean?.trim() || null } : {}),
        ...(adresse !== undefined ? { adresse: adresse?.trim() || null } : {}),
        ...(telephone !== undefined ? { telephone: telephone?.trim() || null } : {}),
        ...(email !== undefined ? { email: email?.trim() || null } : {}),
        ...(logo !== undefined ? { logo: logo?.trim() || null } : {}),
      },
    })

    return NextResponse.json(paroisse)
  } catch (error) {
    // Contrainte d'unicité : seul l'e-mail est unique sur Paroisse.
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      return NextResponse.json({ erreur: 'Cette adresse e-mail est déjà utilisée par une autre paroisse' }, { status: 409 })
    }
    logger.error('PATCH /api/paroisse', error)
    return NextResponse.json({ erreur: 'Erreur serveur' }, { status: 500 })
  }
}
