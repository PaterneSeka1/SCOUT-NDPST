import { NextRequest, NextResponse } from 'next/server'
import { timingSafeEqual } from 'crypto'
import { prisma } from '@/lib/prisma'
import { logger } from '@/lib/logger'
import { envoyerEmailRappelDocuments, type DocumentARenouveler } from '@/lib/notifications'
import { LABELS_TYPE_DOCUMENT } from '@/lib/documents'

const FENETRE_RAPPEL_JOURS = 7

function secretsCorrespondent(a: string, b: string): boolean {
  const bufA = Buffer.from(a)
  const bufB = Buffer.from(b)
  return bufA.length === bufB.length && timingSafeEqual(bufA, bufB)
}

// GET — envoie un rappel par e-mail à chaque parent dont un enfant a un
// document expirant dans les 7 prochains jours. Endpoint destiné à un
// déclencheur externe (cron du serveur, Vercel Cron…) plutôt qu'à un usage
// interactif — d'où l'authentification par secret partagé et non par session.
//
// Cadence recommandée : hebdomadaire. Sans suivi d'un « dernier rappel envoyé »
// par document, un appel plus fréquent renverrait le même rappel plusieurs
// fois — c'est un choix délibéré pour garder l'implémentation simple, à
// corriger si le rythme d'envoi doit un jour être plus fin.
export async function GET(req: NextRequest) {
  try {
    const secretAttendu = process.env.CRON_SECRET
    if (!secretAttendu) {
      return NextResponse.json({ erreur: 'CRON_SECRET non configuré côté serveur' }, { status: 500 })
    }
    const secretRecu = req.headers.get('x-cron-secret')
    if (!secretRecu || !secretsCorrespondent(secretRecu, secretAttendu)) {
      return NextResponse.json({ erreur: 'Non autorisé' }, { status: 401 })
    }

    const seuil = new Date()
    seuil.setDate(seuil.getDate() + FENETRE_RAPPEL_JOURS)
    seuil.setHours(23, 59, 59, 999)
    const maintenant = new Date()

    const documents = await prisma.document.findMany({
      where: {
        dateExpiration: { gte: maintenant, lte: seuil },
        scout: { actif: true },
      },
      select: {
        type: true,
        dateExpiration: true,
        scout: {
          select: {
            nom: true,
            prenom: true,
            liensParents: {
              select: { parent: { select: { id: true, email: true, prenom: true } } },
            },
          },
        },
      },
    })

    const parDestinataire = new Map<
      string,
      { email: string; prenom: string; documents: DocumentARenouveler[] }
    >()

    for (const doc of documents) {
      if (!doc.dateExpiration) continue
      for (const lien of doc.scout.liensParents) {
        const parent = lien.parent
        if (!parent.email) continue
        const entree = parDestinataire.get(parent.id) ?? { email: parent.email, prenom: parent.prenom, documents: [] }
        entree.documents.push({
          scoutNomComplet: `${doc.scout.prenom} ${doc.scout.nom}`,
          typeLabel: LABELS_TYPE_DOCUMENT[doc.type] ?? doc.type,
          dateExpiration: doc.dateExpiration,
        })
        parDestinataire.set(parent.id, entree)
      }
    }

    const urlDocuments = `${process.env.NEXTAUTH_URL ?? ''}/dashboard/mes-enfants`
    let envoyes = 0
    for (const { email, prenom, documents: docsParent } of parDestinataire.values()) {
      await envoyerEmailRappelDocuments({
        email, prenom, nomSite: 'SCOUT ASCCI', documents: docsParent, urlDocuments,
      })
      envoyes += 1
    }

    logger.info('cron.rappels_documents', { documentsConcernes: documents.length, parentsNotifies: envoyes })
    return NextResponse.json({ documentsConcernes: documents.length, parentsNotifies: envoyes })
  } catch (error) {
    logger.error('GET /api/cron/rappels-documents', error)
    return NextResponse.json({ erreur: 'Erreur serveur' }, { status: 500 })
  }
}
