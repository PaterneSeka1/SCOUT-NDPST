import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { ROLES_PLATEFORME, LABELS_ROLES } from '@/lib/roles'
import { champCsv as champ, contentDispositionTelechargement } from '@/lib/csv'
import { logger } from '@/lib/logger'

type RouteParams = { params: Promise<{ id: string }> }

export async function GET(_request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return new NextResponse('Non authentifié', { status: 401 })
    if (!ROLES_PLATEFORME.includes(session.user.role)) return new NextResponse('Accès refusé', { status: 403 })

    const { id } = await params
    const paroisse = await prisma.paroisse.findUnique({ where: { id }, select: { id: true, nom: true } })
    if (!paroisse) return new NextResponse('Paroisse introuvable', { status: 404 })

    const utilisateurs = await prisma.utilisateur.findMany({
      where: { paroisseId: id },
      select: {
        nom: true, prenom: true, matricule: true, telephone: true, email: true, role: true, actif: true,
      },
      orderBy: [{ role: 'asc' }, { nom: 'asc' }, { prenom: 'asc' }],
    })

    const lignes = utilisateurs.map((u) => [
      champ(u.nom.toUpperCase()),
      champ(u.prenom),
      champ(u.matricule),
      champ(u.telephone),
      champ(u.email),
      champ(LABELS_ROLES[u.role] ?? u.role),
      champ(u.actif ? 'Actif' : 'Inactif'),
    ].join(';'))

    const csv = [
      champ(paroisse.nom),
      champ(`${utilisateurs.length} utilisateur${utilisateurs.length > 1 ? 's' : ''}`),
      '',
      '"Nom";"Prénom";"Matricule";"Téléphone";"Email";"Rôle";"Statut"',
      ...lignes,
    ].join('\r\n')

    const bom = '﻿'
    const nomFichier = `utilisateurs_${paroisse.nom.toLowerCase().replace(/\s+/g, '-')}_${new Date().toISOString().slice(0, 10)}.csv`

    return new NextResponse(bom + csv, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': contentDispositionTelechargement(nomFichier),
      },
    })
  } catch (error) {
    logger.error('GET /api/admin/paroisses/[id]/export/utilisateurs', error)
    return new NextResponse('Erreur serveur', { status: 500 })
  }
}
