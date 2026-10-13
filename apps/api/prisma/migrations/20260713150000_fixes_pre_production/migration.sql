-- AlterEnum
ALTER TYPE "StatutCotisation" ADD VALUE 'PARTIELLEMENT_PAYEE';

-- DropForeignKey
ALTER TABLE "Cotisation" DROP CONSTRAINT "Cotisation_paroisseId_fkey";

-- DropForeignKey
ALTER TABLE "Cotisation" DROP CONSTRAINT "Cotisation_scoutId_fkey";

-- DropForeignKey
ALTER TABLE "JournalAudit" DROP CONSTRAINT "JournalAudit_paroisseId_fkey";

-- DropForeignKey
ALTER TABLE "PosteBranche" DROP CONSTRAINT "PosteBranche_paroisseId_fkey";

-- DropForeignKey
ALTER TABLE "PosteBranche" DROP CONSTRAINT "PosteBranche_utilisateurId_fkey";

-- DropForeignKey
ALTER TABLE "PosteGroupe" DROP CONSTRAINT "PosteGroupe_paroisseId_fkey";

-- DropForeignKey
ALTER TABLE "PosteGroupe" DROP CONSTRAINT "PosteGroupe_utilisateurId_fkey";

-- AlterTable
ALTER TABLE "Cotisation" ADD COLUMN     "montantPaye" INTEGER NOT NULL DEFAULT 0;

-- DropTable : modèles jamais utilisés en dehors du client Prisma généré (la
-- branche/le poste réels se pilotent via Utilisateur.role + Utilisateur.brancheType,
-- voir lib/brancheUtilisateur.ts). Les règles d'unicité qu'ils visaient à
-- représenter ("1 seul CHEF_GROUPE par paroisse", "1 seul RESPONSABLE_BRANCHE
-- par paroisse+branche") sont reprises ci-dessous via des index partiels sur
-- Utilisateur, qui reflètent le mécanisme réellement utilisé par le code.
DROP TABLE "PosteBranche";

-- DropTable
DROP TABLE "PosteGroupe";

-- DropEnum
DROP TYPE "RolePosteBranche";

-- DropEnum
DROP TYPE "RolePosteGroupe";

-- CreateIndex
CREATE INDEX "Activite_creePar_idx" ON "Activite"("creePar");

-- CreateIndex
CREATE INDEX "AutorisationCamp_confirmeParId_idx" ON "AutorisationCamp"("confirmeParId");

-- CreateIndex
CREATE INDEX "Cotisation_enregistreParId_idx" ON "Cotisation"("enregistreParId");

-- CreateIndex
CREATE INDEX "JourReunion_creePar_idx" ON "JourReunion"("creePar");

-- CreateIndex
CREATE INDEX "PresenceReunion_marqueParId_idx" ON "PresenceReunion"("marqueParId");

-- CreateIndex
CREATE INDEX "Programme_creePar_idx" ON "Programme"("creePar");

-- CreateIndex
CREATE INDEX "ProgressionScout_valideParId_idx" ON "ProgressionScout"("valideParId");

-- AddForeignKey : Restrict au lieu de Cascade — cohérent avec le reste du schéma
-- (Paroisse/Scout ne sont jamais supprimés physiquement par l'application, voir
-- prisma/schema.prisma) et avec l'objectif du journal d'audit, qui doit survivre
-- à la suppression de l'entité qu'il concerne plutôt que disparaître avec elle.
ALTER TABLE "JournalAudit" ADD CONSTRAINT "JournalAudit_paroisseId_fkey" FOREIGN KEY ("paroisseId") REFERENCES "Paroisse"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Cotisation" ADD CONSTRAINT "Cotisation_scoutId_fkey" FOREIGN KEY ("scoutId") REFERENCES "Scout"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Cotisation" ADD CONSTRAINT "Cotisation_paroisseId_fkey" FOREIGN KEY ("paroisseId") REFERENCES "Paroisse"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Index partiels d'unicité — non exprimables dans le DSL Prisma (pas de clause
-- WHERE sur @@unique), donc ajoutés à la main ici. Les NULL ne sont jamais en
-- conflit entre eux dans un index Postgres : ces contraintes ne portent que sur
-- les lignes qui correspondent réellement au rôle concerné.

-- Un seul CHEF_GROUPE actif par paroisse (direction unique d'un groupe scout).
CREATE UNIQUE INDEX "Utilisateur_chef_groupe_actif_par_paroisse_key"
  ON "Utilisateur" ("paroisseId")
  WHERE "role" = 'CHEF_GROUPE' AND "actif" = true;

-- Un seul RESPONSABLE_BRANCHE actif par (paroisse, branche).
CREATE UNIQUE INDEX "Utilisateur_responsable_branche_actif_par_paroisse_key"
  ON "Utilisateur" ("paroisseId", "brancheType")
  WHERE "role" = 'RESPONSABLE_BRANCHE' AND "actif" = true;
