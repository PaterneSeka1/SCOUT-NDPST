import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { logger } from '@/lib/logger'

type RouteParams = { params: Promise<{ id: string }> }

const LABELS_BRANCHE: Record<string, string> = {
  OISILLONS: 'Oisillons', LOUVETEAUX: 'Louveteaux', ECLAIREURS: 'Éclaireurs',
  CHEMINOTS: 'Cheminots', COMPAGNONS: 'Compagnons',
}
const LABELS_STATUT: Record<string, string> = {
  PRESENT: 'Présent', ABSENT: 'Absent', EXCUSE: 'Excusé',
}

export async function GET(_req: NextRequest, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return new NextResponse('Non authentifié', { status: 401 })

    const { id } = await params

    const reunion = await prisma.jourReunion.findFirst({
      where: { id, paroisseId: session.user.paroisseId },
    })
    if (!reunion) return new NextResponse('Réunion introuvable', { status: 404 })

    const scouts = await prisma.scout.findMany({
      where: {
        paroisseId: session.user.paroisseId,
        actif: true,
        ...(reunion.brancheType ? { brancheType: reunion.brancheType } : {}),
      },
      select: { id: true, prenom: true, nom: true, brancheType: true, matricule: true },
      orderBy: [{ nom: 'asc' }, { prenom: 'asc' }],
    })

    const presences = await prisma.presenceReunion.findMany({
      where: { jourReunionId: id },
      select: { scoutId: true, statut: true, note: true },
    })
    const presenceMap = Object.fromEntries(presences.map((p) => [p.scoutId, p]))

    const dateEffective = reunion.dateReportee ?? reunion.dateHeure
    const dateStr = new Date(dateEffective).toLocaleDateString('fr-FR', {
      weekday: 'long', day: '2-digit', month: 'long', year: 'numeric',
    })
    const brancheLabel = reunion.brancheType ? LABELS_BRANCHE[reunion.brancheType] ?? reunion.brancheType : 'Toutes branches'
    const titre = reunion.titre ?? `Réunion ${brancheLabel}`

    const stats = { present: 0, absent: 0, excuse: 0 }
    const lignes: string[] = []

    for (const scout of scouts) {
      const p = presenceMap[scout.id]
      const statut = p?.statut ?? 'ABSENT'
      if (statut === 'PRESENT') stats.present++
      else if (statut === 'EXCUSE') stats.excuse++
      else stats.absent++

      lignes.push([
        `"${scout.nom.toUpperCase()}"`,
        `"${scout.prenom}"`,
        `"${scout.matricule ?? ''}"`,
        `"${LABELS_BRANCHE[scout.brancheType] ?? scout.brancheType}"`,
        `"${LABELS_STATUT[statut] ?? statut}"`,
        `"${p?.note ?? ''}"`,
      ].join(';'))
    }

    const total = scouts.length
    const tauxPresence = total > 0 ? Math.round((stats.present / total) * 100) : 0

    const csv = [
      `"${titre}"`,
      `"Date : ${dateStr}"`,
      `"Branche : ${brancheLabel}"`,
      `"Présents : ${stats.present} / ${total} (${tauxPresence}%)  |  Excusés : ${stats.excuse}  |  Absents : ${stats.absent}"`,
      '',
      '"Nom";"Prénom";"Matricule";"Branche";"Statut";"Note"',
      ...lignes,
    ].join('\r\n')

    // BOM UTF-8 pour compatibilité Excel
    const bom = '﻿'
    const nomFichier = `presence_${titre.toLowerCase().replace(/\s+/g, '-')}_${new Date(dateEffective).toISOString().slice(0, 10)}.csv`

    return new NextResponse(bom + csv, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${nomFichier}"`,
      },
    })
  } catch (error) {
    logger.error('GET /api/reunions/[id]/presences/export', error)
    return new NextResponse('Erreur serveur', { status: 500 })
  }
}
