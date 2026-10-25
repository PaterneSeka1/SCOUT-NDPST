import { Prisma } from '../../generated/prisma/client'
import { ACCENTS_CIBLE, ACCENTS_SOURCE, normaliserNom } from '../../common/lib/identite'
/** Détection prudente, accents/espaces/inversion compris ; aucune fusion. */
export async function homonymeFinancier(tx: Prisma.TransactionClient, nomSource: string, prenomSource: string) {
  const nom = normaliserNom(nomSource),
    prenom = normaliserNom(prenomSource)
  const normaliser = (colonne: Prisma.Sql) =>
    Prisma.sql`translate(lower(regexp_replace(trim(${colonne}), '[[:space:]]+', ' ', 'g')), ${ACCENTS_SOURCE}, ${ACCENTS_CIBLE})`
  const sn = normaliser(Prisma.sql`s."nom"`),
    sp = normaliser(Prisma.sql`s."prenom"`),
    un = normaliser(Prisma.sql`u."nom"`),
    up = normaliser(Prisma.sql`u."prenom"`)
  const lignes = await tx.$queryRaw<{ id: string }[]>`SELECT p.id FROM "PersonneAdhesion" p
    LEFT JOIN "Scout" s ON s.id=p."scoutId" LEFT JOIN "Utilisateur" u ON u.id=p."utilisateurId"
    WHERE (${sn}=${nom} AND ${sp}=${prenom}) OR (${sn}=${prenom} AND ${sp}=${nom})
       OR (${un}=${nom} AND ${up}=${prenom}) OR (${un}=${prenom} AND ${up}=${nom}) LIMIT 1`
  return lignes.length > 0
}
