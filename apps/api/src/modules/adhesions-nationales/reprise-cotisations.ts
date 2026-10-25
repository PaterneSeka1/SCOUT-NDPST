import { homonymeFinancier } from './identite'
import { createHash } from 'crypto'
import { PrismaService } from '../../prisma/prisma.service'

/** Plan sans effet de bord. Les doublons annuels restent à rapprocher manuellement. */
export async function planifierReprise(prisma: PrismaService) {
  const sources = await prisma.cotisation.findMany({ where: { type: 'ADHESION_ANNUELLE' }, orderBy: { id: 'asc' } })
  const groupes = new Map<string, number>()
  for (const c of sources) {
    const cle = `${c.scoutId}/${c.anneeScolaire}`
    groupes.set(cle, (groupes.get(cle) ?? 0) + 1)
  }
  const eligibles = sources.filter(
    (c) =>
      groupes.get(`${c.scoutId}/${c.anneeScolaire}`) === 1 &&
      c.montant >= 0 &&
      c.montantPaye >= 0 &&
      c.montantPaye <= c.montant,
  )
  return {
    sources,
    eligibles,
    rapport: {
      lignesSources: sources.length,
      montantDuSource: sources.reduce((s, c) => s + c.montant, 0),
      montantPayeSource: sources.reduce((s, c) => s + c.montantPaye, 0),
      lignesEligibles: eligibles.length,
      lignesAmbigues: sources.length - eligibles.length,
      empreinte: createHash('sha256').update(JSON.stringify(sources)).digest('hex'),
    },
  }
}

/** Migration additive réservée à une recette avec sauvegarde vérifiée par l'opérateur.
 * Pas de données personnelles dans le résultat. Aucun statut national créé.
 */
export async function appliquerReprise(prisma: PrismaService, acteurId: string, empreinte: string) {
  const avant = await planifierReprise(prisma)
  if (avant.rapport.empreinte !== empreinte) throw new Error('Les sources ont changé : refaire le plan')
  const resultat = await prisma.$transaction(
    async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(20262027)`
      const auteur = await tx.utilisateur.findUnique({
        where: { id: acteurId },
        select: {
          actif: true,
          habilitationsAdhesion: { where: { revoqueeLe: null, permission: 'CORRIGER', brancheType: null } },
        },
      })
      if (!auteur?.actif || !auteur.habilitationsAdhesion.length)
        throw new Error('Habilitation CORRIGER globale explicite requise')
      let importees = 0,
        dejaReprises = 0,
        conflitsIdentite = 0,
        montantDuRepris = 0,
        montantPayeRepris = 0
      for (const source of avant.eligibles) {
        await tx.$queryRaw`SELECT id FROM "Cotisation" WHERE id = ${source.id} FOR SHARE`
        const c = await tx.cotisation.findUniqueOrThrow({ where: { id: source.id }, include: { scout: true } })
        if (
          c.montant !== source.montant ||
          c.montantPaye !== source.montantPaye ||
          c.statut !== source.statut ||
          c.updatedAt.getTime() !== source.updatedAt.getTime()
        )
          throw new Error('Une cotisation source a changé pendant la reprise')
        if (await tx.repriseCotisation.findUnique({ where: { cotisationId: c.id } })) {
          dejaReprises++
          continue
        }
        const utilisateur = c.scout.utilisateurId
          ? await tx.utilisateur.findUnique({ where: { id: c.scout.utilisateurId } })
          : c.scout.matricule
            ? await tx.utilisateur.findUnique({ where: { matricule: c.scout.matricule } })
            : null
        if (utilisateur?.matricule && c.scout.matricule && utilisateur.matricule !== c.scout.matricule) {
          conflitsIdentite++
          continue
        }
        const identites = await tx.personneAdhesion.findMany({
          where: { OR: [{ scoutId: c.scoutId }, ...(utilisateur ? [{ utilisateurId: utilisateur.id }] : [])] },
        })
        if (identites.length > 1 || (identites[0]?.scoutId && identites[0].scoutId !== c.scoutId)) {
          conflitsIdentite++
          continue
        }
        let personne = identites[0]
        if (!personne) {
          const homonyme = await homonymeFinancier(tx, c.scout.nom, c.scout.prenom)
          if (homonyme) {
            conflitsIdentite++
            continue
          }
          personne = await tx.personneAdhesion.create({ data: { scoutId: c.scoutId, utilisateurId: utilisateur?.id } })
        }
        if (
          await tx.adhesionAnnuelle.findUnique({
            where: { personneId_annee: { personneId: personne.id, annee: c.anneeScolaire } },
          })
        ) {
          conflitsIdentite++
          continue
        }
        const a = await tx.adhesionAnnuelle.create({
          data: {
            annee: c.anneeScolaire,
            personneId: personne.id,
            categorie: 'SCOUT',
            brancheType: c.scout.brancheType,
            montantDu: c.montant,
            montantEncaisse: c.montantPaye,
            exoneree: c.statut === 'EXONEREE',
            aVerifier: true,
            motifVerification: 'Reprise historique : montants locaux connus, reversement national non prouvé',
          },
        })
        await tx.repriseCotisation.create({
          data: {
            cotisationId: c.id,
            adhesionId: a.id,
            montantDu: c.montant,
            montantPaye: c.montantPaye,
            statutSource: c.statut,
          },
        })
        if (c.montantPaye > 0)
          await tx.encaissementAdhesion.create({
            data: {
              adhesionId: a.id,
              montant: c.montantPaye,
              mode: c.modePaiement ?? 'REPRISE_HISTORIQUE',
              encaisseLe: c.datePaiement,
              acteurId,
              idempotence: `reprise:${c.id}`,
              note: 'Reprise de cumul historique, détail des versements antérieurs indisponible. Une date absente reste inconnue.',
            },
          })
        await tx.journalAudit.create({
          data: {
            acteurId,
            action: 'COTISATION_HISTORIQUE_REPRISE',
            entite: 'AdhesionNationale',
            entiteId: a.id,
            details: { cotisationId: c.id, montantDu: c.montant, montantPaye: c.montantPaye, empreintePlan: empreinte },
          },
        })
        importees++
        montantDuRepris += c.montant
        montantPayeRepris += c.montantPaye
      }
      return { importees, dejaReprises, conflitsIdentite, montantDuRepris, montantPayeRepris }
    },
    { timeout: 60000 },
  )
  const apres = await planifierReprise(prisma)
  if (apres.rapport.empreinte !== avant.rapport.empreinte)
    throw new Error('Les sources ont changé : contrôler le rapport avant poursuite')
  return { ...avant.rapport, ...resultat, sourcesInchangees: true, confirmationsCreees: 0 }
}
