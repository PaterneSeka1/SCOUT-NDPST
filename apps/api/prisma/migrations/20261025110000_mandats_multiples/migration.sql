BEGIN;
DROP INDEX "Mandat_actif_utilisateur_key";
-- Les mandats ouverts représentent les fonctions courantes. L'API ne crée
-- pas de nomination future et ne permet pas de modifier rétroactivement un mandat.
CREATE UNIQUE INDEX "Mandat_fonction_groupe_ouverte_key" ON "Mandat"("utilisateurId", "role") WHERE "finLe" IS NULL AND "brancheType" IS NULL;
CREATE UNIQUE INDEX "Mandat_fonction_branche_ouverte_key" ON "Mandat"("utilisateurId", "role", "brancheType") WHERE "finLe" IS NULL AND "brancheType" IS NOT NULL;
CREATE UNIQUE INDEX "Mandat_chef_groupe_ouvert_key" ON "Mandat"("role") WHERE "role" = 'CHEF_GROUPE' AND "finLe" IS NULL;
CREATE UNIQUE INDEX "Mandat_responsable_branche_ouvert_key" ON "Mandat"("brancheType") WHERE "role" = 'RESPONSABLE_BRANCHE' AND "finLe" IS NULL;
ALTER TABLE "Mandat" ADD CONSTRAINT "Mandat_perimetre_check" CHECK (
  ("role" IN ('RESPONSABLE_BRANCHE','ADJOINT_BRANCHE','ASSISTANT_BRANCHE') AND "brancheType" IS NOT NULL)
  OR ("role" IN ('CHEF_GROUPE','ADJOINT_GROUPE','ASSISTANT_GROUPE') AND "brancheType" IS NULL)
);
COMMIT;
