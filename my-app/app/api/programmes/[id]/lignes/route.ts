import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

type RouteParams = { params: Promise<{ id: string }> }

const ROLES_GROUPE = ['ADMIN_PAROISSE', 'CHEF_GROUPE']
const ROLES_BRANCHE = ['RESPONSABLE_BRANCHE', 'ADJOINT_BRANCHE', 'ASSISTANT_BRANCHE']
const ROLES_GESTION = [...ROLES_GROUPE, ...ROLES_BRANCHE]

async function getBrancheUtilisateur(userId: string, paroisseId: string): Promise<string | null> {
  const poste = await prisma.posteBranche.findFirst({
    where: { utilisateurId: userId, paroisseId },
    select: { brancheType: true },
  })
  return poste?.brancheType ?? null
}

export async function POST(req: NextRequest, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return NextResponse.json({ erreur: 'Non authentifié' }, { status: 401 })
    if (!ROLES_GESTION.includes(session.user.role)) return NextResponse.json({ erreur: 'Accès refusé' }, { status: 403 })

    const { id: programmeId } = await params
    const programme = await prisma.programme.findFirst({
      where: { id: programmeId, paroisseId: session.user.paroisseId },
    })
    if (!programme) return NextResponse.json({ erreur: 'Programme introuvable' }, { status: 404 })

    if (ROLES_BRANCHE.includes(session.user.role)) {
      const bt = await getBrancheUtilisateur(session.user.id, session.user.paroisseId)
      if (!bt || programme.brancheType !== bt) {
        return NextResponse.json({ erreur: 'Accès refusé à ce programme' }, { status: 403 })
      }
    }

    const body = await req.json()
    const { theme, objectif, datePrevue } = body as {
      theme?: string
      objectif?: string
      datePrevue?: string
    }
    if (!theme) return NextResponse.json({ erreur: 'Le thème est obligatoire' }, { status: 400 })

    const dernier = await prisma.ligneProgramme.findFirst({
      where: { programmeId },
      orderBy: { ordre: 'desc' },
      select: { ordre: true },
    })

    const ligne = await prisma.ligneProgramme.create({
      data: {
        programmeId,
        theme,
        objectif: objectif ?? null,
        datePrevue: datePrevue ? new Date(datePrevue) : null,
        ordre: (dernier?.ordre ?? -1) + 1,
      },
    })

    return NextResponse.json(ligne, { status: 201 })
  } catch (error) {
    console.error('[POST /api/programmes/[id]/lignes]', error)
    return NextResponse.json({ erreur: 'Erreur serveur' }, { status: 500 })
  }
}
