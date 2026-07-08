import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { ROLES_PLATEFORME } from '@/lib/roles'
import { estCouleurHexValide } from '@/lib/theme'
import { estUrlFichierValide } from '@/lib/validation'
import { urlPubliqueBase } from '@/lib/storage'
import { logger } from '@/lib/logger'

type RouteParams = { params: Promise<{ id: string }> }

export async function GET(_request: NextRequest, { params }: RouteParams) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ erreur: 'Non authentifié' }, { status: 401 })
  if (!ROLES_PLATEFORME.includes(session.user.role)) {
    return NextResponse.json({ erreur: 'Accès refusé' }, { status: 403 })
  }

  const { id } = await params
  const paroisse = await prisma.paroisse.findUnique({
    where: { id },
    include: {
      _count: { select: { scouts: true, utilisateurs: true, activites: true } },
      utilisateurs: {
        where: { role: 'CHEF_GROUPE' },
        select: { id: true, nom: true, prenom: true, matricule: true, telephone: true, email: true, actif: true },
        orderBy: { createdAt: 'asc' },
      },
    },
  })

  if (!paroisse) return NextResponse.json({ erreur: 'Paroisse introuvable' }, { status: 404 })

  const { utilisateurs: chefsGroupe, _count: counts, ...infos } = paroisse
  return NextResponse.json({ ...infos, counts, chefsGroupe })
}

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return NextResponse.json({ erreur: 'Non authentifié' }, { status: 401 })
    if (!ROLES_PLATEFORME.includes(session.user.role)) {
      return NextResponse.json({ erreur: 'Accès refusé' }, { status: 403 })
    }

    const { id } = await params
    const existante = await prisma.paroisse.findUnique({ where: { id }, select: { id: true } })
    if (!existante) return NextResponse.json({ erreur: 'Paroisse introuvable' }, { status: 404 })

    const body = await request.json()
    const {
      nom, ville, diocese, ocean, doyenne, adresse, telephone, email, logo, actif,
      couleurPrimaire, couleurAccent, couleurFond, couleurHover,
    } = body as {
      nom?: string; ville?: string; diocese?: string; ocean?: string; doyenne?: string
      adresse?: string; telephone?: string; email?: string; logo?: string; actif?: boolean
      couleurPrimaire?: string; couleurAccent?: string; couleurFond?: string; couleurHover?: string
    }

    if (logo != null && logo.trim() !== '' && !estUrlFichierValide(logo.trim(), urlPubliqueBase())) {
      return NextResponse.json({ erreur: 'logo doit être un chemin local (ex : /uploads/…) ou une URL de stockage autorisée' }, { status: 400 })
    }

    for (const [champ, valeur] of Object.entries({ couleurPrimaire, couleurAccent, couleurFond, couleurHover })) {
      if (valeur != null && valeur.trim() !== '' && !estCouleurHexValide(valeur)) {
        return NextResponse.json({ erreur: `${champ} doit être une couleur hexadécimale valide (ex : #1a4731)` }, { status: 400 })
      }
    }

    const paroisse = await prisma.paroisse.update({
      where: { id },
      data: {
        ...(nom !== undefined ? { nom: nom.trim() } : {}),
        ...(ville !== undefined ? { ville: ville.trim() } : {}),
        ...(diocese !== undefined ? { diocese: diocese.trim() } : {}),
        ...(ocean !== undefined ? { ocean: ocean.trim() || null } : {}),
        ...(doyenne !== undefined ? { doyenne: doyenne.trim() || null } : {}),
        ...(adresse !== undefined ? { adresse: adresse.trim() || null } : {}),
        ...(telephone !== undefined ? { telephone: telephone.trim() || null } : {}),
        ...(email !== undefined ? { email: email.trim() || null } : {}),
        ...(logo !== undefined ? { logo: logo.trim() || null } : {}),
        ...(actif !== undefined ? { actif } : {}),
        ...(couleurPrimaire !== undefined ? { couleurPrimaire: couleurPrimaire.trim() || null } : {}),
        ...(couleurAccent !== undefined ? { couleurAccent: couleurAccent.trim() || null } : {}),
        ...(couleurFond !== undefined ? { couleurFond: couleurFond.trim() || null } : {}),
        ...(couleurHover !== undefined ? { couleurHover: couleurHover.trim() || null } : {}),
      },
    })

    return NextResponse.json(paroisse)
  } catch (error) {
    logger.error('PATCH /api/admin/paroisses/[id]', error)
    return NextResponse.json({ erreur: 'Erreur serveur' }, { status: 500 })
  }
}
