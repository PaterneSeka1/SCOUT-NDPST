import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { BrancheType, Sexe } from '@/app/generated/prisma/client'
import { ROLES_TOUT_STAFF as ROLES_AUTORISES } from '@/lib/roles'
import { logger } from '@/lib/logger'

const MAX_LIGNES = 500

interface LigneImport {
  nom?: string
  prenom?: string
  dateNaissance?: string
  sexe?: string
  brancheType?: string
  matricule?: string
  contactNom?: string
  contactPrenom?: string
  contactTelephone?: string
  contactRelation?: string
}

interface ResultatLigne {
  ligne: number
  succes: boolean
  erreur?: string
  scoutId?: string
  nom?: string
  prenom?: string
}

// Valide une ligne et retourne soit les données prêtes pour Prisma, soit un
// message d'erreur — mêmes règles que la création d'un scout à l'unité
// (POST /api/scouts), pour ne pas avoir deux logiques métier divergentes.
function validerLigne(row: LigneImport): { erreur: string } | {
  nom: string; prenom: string; dateNaissance: Date; sexe: Sexe; brancheType: BrancheType
  matricule: string | null
  contact: { nom: string; prenom: string | null; telephone: string; relation: string | null }
} {
  const nom = row.nom?.trim()
  const prenom = row.prenom?.trim()
  if (!nom) return { erreur: 'Le nom est requis' }
  if (!prenom) return { erreur: 'Le prénom est requis' }
  if (!row.dateNaissance?.trim()) return { erreur: 'La date de naissance est requise' }
  const dateNaissance = new Date(row.dateNaissance.trim())
  if (Number.isNaN(dateNaissance.getTime())) return { erreur: 'Date de naissance invalide (format attendu : AAAA-MM-JJ)' }

  const sexe = row.sexe?.trim().toUpperCase()
  if (!sexe || !(sexe in Sexe)) return { erreur: 'Sexe invalide (MASCULIN ou FEMININ attendu)' }

  const brancheType = row.brancheType?.trim().toUpperCase()
  if (!brancheType || !(brancheType in BrancheType)) {
    return { erreur: 'Branche invalide (OISILLONS, LOUVETEAUX, ECLAIREURS, CHEMINOTS ou COMPAGNONS attendu)' }
  }

  const contactNom = row.contactNom?.trim()
  const contactTelephone = row.contactTelephone?.trim()
  if (!contactNom) return { erreur: 'Le nom du contact d\'urgence est requis' }
  if (!contactTelephone) return { erreur: 'Le téléphone du contact d\'urgence est requis' }

  return {
    nom, prenom, dateNaissance,
    sexe: sexe as Sexe,
    brancheType: brancheType as BrancheType,
    matricule: row.matricule?.trim() || null,
    contact: {
      nom: contactNom,
      prenom: row.contactPrenom?.trim() || null,
      telephone: contactTelephone,
      relation: row.contactRelation?.trim() || null,
    },
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    if (!ROLES_AUTORISES.includes(session.user.role)) {
      return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
    }

    const body = await request.json()
    const { scouts } = body as { scouts?: LigneImport[] }

    if (!Array.isArray(scouts) || scouts.length === 0) {
      return NextResponse.json({ error: 'Aucune ligne à importer' }, { status: 400 })
    }
    if (scouts.length > MAX_LIGNES) {
      return NextResponse.json({ error: `Maximum ${MAX_LIGNES} lignes par import` }, { status: 400 })
    }

    const paroisseId = session.user.paroisseId
    const matriculesVus = new Set<string>()
    const resultats: ResultatLigne[] = []

    for (const [index, row] of scouts.entries()) {
      const numeroLigne = index + 1
      const validation = validerLigne(row)

      if ('erreur' in validation) {
        resultats.push({ ligne: numeroLigne, succes: false, erreur: validation.erreur })
        continue
      }

      if (validation.matricule) {
        if (matriculesVus.has(validation.matricule)) {
          resultats.push({ ligne: numeroLigne, succes: false, erreur: `Matricule "${validation.matricule}" en double dans le fichier` })
          continue
        }
        const existant = await prisma.scout.findUnique({ where: { matricule: validation.matricule }, select: { id: true } })
        if (existant) {
          resultats.push({ ligne: numeroLigne, succes: false, erreur: `Matricule "${validation.matricule}" déjà utilisé` })
          continue
        }
        matriculesVus.add(validation.matricule)
      }

      try {
        const scout = await prisma.$transaction(async (tx) => {
          const nouveauScout = await tx.scout.create({
            data: {
              nom: validation.nom,
              prenom: validation.prenom,
              dateNaissance: validation.dateNaissance,
              sexe: validation.sexe,
              brancheType: validation.brancheType,
              matricule: validation.matricule,
              paroisseId,
            },
          })
          await tx.contactUrgence.create({
            data: {
              nom: validation.contact.nom,
              prenom: validation.contact.prenom,
              telephone: validation.contact.telephone,
              relation: validation.contact.relation,
              principal: true,
              scoutId: nouveauScout.id,
            },
          })
          return nouveauScout
        })

        resultats.push({ ligne: numeroLigne, succes: true, scoutId: scout.id, nom: scout.nom, prenom: scout.prenom })
      } catch (err) {
        logger.error('POST /api/scouts/import ligne', err, { ligne: numeroLigne })
        resultats.push({ ligne: numeroLigne, succes: false, erreur: 'Erreur serveur lors de la création' })
      }
    }

    const nbSucces = resultats.filter((r) => r.succes).length
    return NextResponse.json({ resultats, nbSucces, nbEchecs: resultats.length - nbSucces })
  } catch (error) {
    logger.error('POST /api/scouts/import', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
