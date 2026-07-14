-- Simplifie StatutCotisation de 6 valeurs à 3 : la distinction PAYE_SITE/PAYEE
-- n'apportait rien de concret, et EN_ATTENTE/PARTIELLEMENT_PAYEE/EXONEREE se
-- distinguent déjà pleinement via montantPaye, sans avoir besoin d'un statut
-- dédié pour chacun.
--
-- Mapping : EN_ATTENTE, PARTIELLEMENT_PAYEE -> NON_A_JOUR
--           ARGENT_RECU                     -> ARGENT_RECU (inchangé)
--           PAYE_SITE, PAYEE, EXONEREE      -> A_JOUR
--
-- Un simple cast ("statut"::text::"StatutCotisation_new", ce que génère
-- `prisma migrate diff` naïvement) échouerait pour toute ligne dont l'ancienne
-- valeur ne porte pas exactement le même nom dans le nouvel enum — d'où le
-- CASE explicite ci-dessous.
BEGIN;

CREATE TYPE "StatutCotisation_new" AS ENUM ('NON_A_JOUR', 'ARGENT_RECU', 'A_JOUR');

ALTER TABLE "Cotisation" ALTER COLUMN "statut" DROP DEFAULT;

ALTER TABLE "Cotisation" ALTER COLUMN "statut" TYPE "StatutCotisation_new" USING (
  CASE "statut"::text
    WHEN 'EN_ATTENTE' THEN 'NON_A_JOUR'
    WHEN 'PARTIELLEMENT_PAYEE' THEN 'NON_A_JOUR'
    WHEN 'ARGENT_RECU' THEN 'ARGENT_RECU'
    WHEN 'PAYE_SITE' THEN 'A_JOUR'
    WHEN 'PAYEE' THEN 'A_JOUR'
    WHEN 'EXONEREE' THEN 'A_JOUR'
  END
)::"StatutCotisation_new";

ALTER TYPE "StatutCotisation" RENAME TO "StatutCotisation_old";
ALTER TYPE "StatutCotisation_new" RENAME TO "StatutCotisation";
DROP TYPE "StatutCotisation_old";

ALTER TABLE "Cotisation" ALTER COLUMN "statut" SET DEFAULT 'NON_A_JOUR';

COMMIT;
