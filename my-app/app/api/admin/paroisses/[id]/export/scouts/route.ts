import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { ROLES_PLATEFORME } from '@/lib/roles'
import { LABELS_BRANCHES } from '@/lib/branches'
import { champCsv as champ, contentDispositionTelechargement } from '@/lib/csv'
import { logger } from '@/lib/logger'
import { enregistrerAudit } from '@/lib/audit'

type RouteParams = { params: Promise<{ id: string }> }

const LABELS_SEXE: Record<string, string> = { MASCULIN: 'Masculin', FEMININ: 'Féminin' }

export async function GET(_request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return new NextResponse('Non authentifié', { status: 401 })
    if (!ROLES_PLATEFORME.includes(session.user.role)) return new NextResponse('Accès refusé', { status: 403 })

    const { id } = await params
    const paroisse = await prisma.paroisse.findUnique({ where: { id }, select: { id: true, nom: true } })
    if (!paroisse) return new NextResponse('Paroisse introuvable', { status: 404 })

    const scouts = await prisma.scout.findMany({
      where: { paroisseId: id },
      select: {
        nom: true, prenom: true, matricule: true, brancheType: true, sexe: true,
        dateNaissance: true, actif: true,
      },
      orderBy: [{ nom: 'asc' }, { prenom: 'asc' }],
    })

    const lignes = scouts.map((s) => [
      champ(s.nom.toUpperCase()),
      champ(s.prenom),
      champ(s.matricule),
      champ(LABELS_BRANCHES[s.brancheType] ?? s.brancheType),
      champ(LABELS_SEXE[s.sexe] ?? s.sexe),
      champ(new Date(s.dateNaissance).toLocaleDateString('fr-FR')),
      champ(s.actif ? 'Actif' : 'Inactif'),
    ].join(';'))

    const csv = [
      champ(paroisse.nom),
      champ(`${scouts.length} scout${scouts.length > 1 ? 's' : ''}`),
      '',
      '"Nom";"Prénom";"Matricule";"Branche";"Sexe";"Date de naissance";"Statut"',
      ...lignes,
    ].join('\r\n')

    // Export de données personnelles de mineurs (dont date de naissance) :
    // action sensible à journaliser, comme toute lecture en masse de ces données.
    await enregistrerAudit({
      paroisseId: id,
      acteurId: session.user.id,
      action: 'PAROISSE_SCOUTS_EXPORTES',
      entite: 'Paroisse',
      entiteId: id,
      details: { nombre: scouts.length },
    })

    const bom = '﻿'
    const nomFichier = `scouts_${paroisse.nom.toLowerCase().replace(/\s+/g, '-')}_${new Date().toISOString().slice(0, 10)}.csv`

    return new NextResponse(bom + csv, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': contentDispositionTelechargement(nomFichier),
      },
    })
  } catch (error) {
    logger.error('GET /api/admin/paroisses/[id]/export/scouts', error)
    return new NextResponse('Erreur serveur', { status: 500 })
  }
}
