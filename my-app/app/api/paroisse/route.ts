import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { estCheminLocalValide } from '@/lib/validation'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ erreur: 'Non autorisé' }, { status: 401 })

  const paroisseId = session.user.paroisseId
  if (!paroisseId) return NextResponse.json({ erreur: 'Aucune paroisse associée' }, { status: 400 })

  const paroisse = await prisma.paroisse.findUnique({
    where: { id: paroisseId },
    include: {
      _count: { select: { scouts: true, utilisateurs: true, activites: true } },
    },
  })

  if (!paroisse) return NextResponse.json({ erreur: 'Paroisse introuvable' }, { status: 404 })

  return NextResponse.json(paroisse)
}

export async function PATCH(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ erreur: 'Non autorisé' }, { status: 401 })

  const ROLES_AUTORISES = ['ADMIN_PAROISSE']
  if (!ROLES_AUTORISES.includes(session.user.role))
    return NextResponse.json({ erreur: 'Accès refusé' }, { status: 403 })

  const paroisseId = session.user.paroisseId
  if (!paroisseId) return NextResponse.json({ erreur: 'Aucune paroisse associée' }, { status: 400 })

  const body = await req.json()
  const { nom, ville, diocese, ocean, doyenne, adresse, telephone, email, logo } = body as {
    nom?: string; ville?: string; diocese?: string; ocean?: string; doyenne?: string
    adresse?: string; telephone?: string; email?: string; logo?: string
  }

  if (logo != null && logo.trim() !== '' && !estCheminLocalValide(logo.trim())) {
    return NextResponse.json({ erreur: 'logo doit être un chemin local (ex : /uploads/…)' }, { status: 400 })
  }

  const paroisse = await prisma.paroisse.update({
    where: { id: paroisseId },
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
    },
  })

  return NextResponse.json(paroisse)
}
