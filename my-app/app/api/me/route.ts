import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { logger } from '@/lib/logger'

// Route en libre-service : accessible à tout utilisateur authentifié, quel que
// soit son rôle (y compris ADMIN_PLATEFORME, dont paroisseId est toujours nul).
// `paroisse` est incluse via la relation Prisma : elle vaut naturellement
// `null` quand paroisseId est nul, aucune requête séparée n'est nécessaire.
const SELECTION_PROFIL = {
  id: true,
  nom: true,
  prenom: true,
  email: true,
  telephone: true,
  matricule: true,
  role: true,
  fonction: true,
  brancheType: true,
  roleDistrict: true,
  fonctionDistrict: true,
  brancheTypeDistrict: true,
  paroisse: { select: { id: true, nom: true } },
} as const

export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return NextResponse.json({ erreur: 'Non authentifié' }, { status: 401 })

    const utilisateur = await prisma.utilisateur.findUnique({
      where: { id: session.user.id },
      select: SELECTION_PROFIL,
    })

    if (!utilisateur) return NextResponse.json({ erreur: 'Utilisateur introuvable' }, { status: 404 })
    return NextResponse.json(utilisateur)
  } catch (error) {
    logger.error('GET /api/me', error)
    return NextResponse.json({ erreur: 'Erreur serveur' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return NextResponse.json({ erreur: 'Non authentifié' }, { status: 401 })

    const body = await request.json()
    // On ne déstructure volontairement que les champs auto-modifiables : role,
    // actif, matricule et paroisseId n'apparaissent jamais ici, donc même si un
    // client malveillant les inclut dans le corps de la requête, ils sont
    // ignorés silencieusement — rien n'est jamais spread depuis `body` vers les
    // données Prisma, seuls ces quatre champs explicitement lus peuvent
    // atteindre `data`.
    const { nom, prenom, email, telephone } = body as {
      nom?: string
      prenom?: string
      email?: string | null
      telephone?: string | null
    }

    if (email !== undefined && email !== null && email.trim() !== '') {
      // Insensible à la casse, comme pour la route admin équivalente : évite
      // qu'un doublon "Jean@x.com" / "jean@x.com" passe inaperçu.
      const doublon = await prisma.utilisateur.findFirst({
        where: { email: { equals: email.trim(), mode: 'insensitive' }, NOT: { id: session.user.id } },
        select: { id: true },
      })
      if (doublon) return NextResponse.json({ erreur: 'Cette adresse e-mail est déjà utilisée' }, { status: 400 })
    }

    if (telephone !== undefined && telephone !== null && telephone.trim() !== '') {
      const doublon = await prisma.utilisateur.findFirst({
        where: { telephone: telephone.trim(), NOT: { id: session.user.id } },
        select: { id: true },
      })
      if (doublon) return NextResponse.json({ erreur: 'Ce numéro de téléphone est déjà utilisé' }, { status: 400 })
    }

    const utilisateur = await prisma.utilisateur.update({
      where: { id: session.user.id },
      data: {
        ...(nom !== undefined ? { nom } : {}),
        ...(prenom !== undefined ? { prenom } : {}),
        ...(email !== undefined ? { email: email?.trim() || null } : {}),
        ...(telephone !== undefined ? { telephone: telephone?.trim() || null } : {}),
      },
      select: SELECTION_PROFIL,
    })

    return NextResponse.json(utilisateur)
  } catch (error) {
    logger.error('PUT /api/me', error)
    return NextResponse.json({ erreur: 'Erreur serveur' }, { status: 500 })
  }
}
