-- Workflow des droits d'adhésion :
-- 1) l'argent peut être reçu par un chef collecteur sans être encore payé sur
--    le site externe ;
-- 2) les chefs/staff paient aussi leur adhésion annuelle, même sans fiche Scout.

ALTER TYPE "StatutCotisation" ADD VALUE 'ARGENT_RECU';
ALTER TYPE "StatutCotisation" ADD VALUE 'PAYE_SITE';

ALTER TABLE "Cotisation" ADD COLUMN "utilisateurId" TEXT;
ALTER TABLE "Cotisation" ADD COLUMN "collecteParId" TEXT;

ALTER TABLE "Cotisation" ALTER COLUMN "scoutId" DROP NOT NULL;

ALTER TABLE "Cotisation" ADD CONSTRAINT "Cotisation_utilisateurId_fkey"
  FOREIGN KEY ("utilisateurId") REFERENCES "Utilisateur"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Cotisation" ADD CONSTRAINT "Cotisation_collecteParId_fkey"
  FOREIGN KEY ("collecteParId") REFERENCES "Utilisateur"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Cotisation" ADD CONSTRAINT "Cotisation_participant_check"
  CHECK (
    ("scoutId" IS NOT NULL AND "utilisateurId" IS NULL)
    OR
    ("scoutId" IS NULL AND "utilisateurId" IS NOT NULL)
  );

CREATE INDEX "Cotisation_utilisateurId_idx" ON "Cotisation"("utilisateurId");
CREATE INDEX "Cotisation_collecteParId_idx" ON "Cotisation"("collecteParId");
