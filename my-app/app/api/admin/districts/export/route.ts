import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { ROLES_PLATEFORME } from '@/lib/roles'
import { champCsv as champ, dateFichier, reponseCsv } from '@/lib/csv'
import { logger } from '@/lib/logger'
import { enregistrerAudit } from '@/lib/audit'

// Export CSV de la liste complète des districts — action de lecture en masse
// à journaliser, comme les autres exports plateforme. Portée plateforme (pas
// une paroisse en particulier) : paroisseId null, comme RAPPORT_PLATEFORME_EXPORTE.
export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return new NextResponse('Non authentifié', { status: 401 })
    if (!ROLES_PLATEFORME.includes(session.user.role)) return new NextResponse('Accès refusé', { status: 403 })

    const districts = await prisma.district.findMany({
      orderBy: { nom: 'asc' },
      select: {
        id: true,
        nom: true,
        paroisses: { select: { ville: true } },
        _count: { select: { paroisses: true } },
      },
    })

    const districtsAvecCommissaire = await Promise.all(
      districts.map(async (d) => {
        const commissaire = await prisma.utilisateur.findFirst({
          where: { roleDistrict: 'COMMISSAIRE_DISTRICT', actif: true, paroisse: { districtId: d.id } },
          select: { nom: true, prenom: true },
        })
        const villes = Array.from(new Set(d.paroisses.map((p) => p.ville))).sort((a, b) => a.localeCompare(b, 'fr'))
        return { nom: d.nom, nbParoisses: d._count.paroisses, villes, commissaire }
      }),
    )

    const lignes = districtsAvecCommissaire.map((d) => [
      champ(d.nom),
      champ(d.villes.join(', ')),
      d.nbParoisses,
      champ(d.commissaire ? `${d.commissaire.prenom} ${d.commissaire.nom}` : 'Non désigné'),
    ].join(';'))

    await enregistrerAudit({
      paroisseId: null,
      acteurId: session.user.id,
      action: 'DISTRICTS_EXPORTES',
      entite: 'District',
      entiteId: null,
      details: { nombre: districts.length },
    })

    return reponseCsv(`districts_${dateFichier()}.csv`, [
      '"Nom";"Villes couvertes";"Paroisses";"Commissaire de district"',
      ...lignes,
    ])
  } catch (error) {
    logger.error('GET /api/admin/districts/export', error)
    return new NextResponse('Erreur serveur', { status: 500 })
  }
}
