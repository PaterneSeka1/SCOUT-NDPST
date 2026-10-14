-- Consentement aux données de santé et dates de conservation des scouts.
-- AlterTable
ALTER TABLE "Scout" ADD COLUMN     "anonymiseLe" TIMESTAMP(3),
ADD COLUMN     "consentementSante" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "consentementSanteDate" TIMESTAMP(3),
ADD COLUMN     "consentementSanteParId" TEXT,
ADD COLUMN     "desactiveLe" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "Scout_desactiveLe_idx" ON "Scout"("desactiveLe");

-- CreateIndex
CREATE INDEX "Scout_consentementSanteParId_idx" ON "Scout"("consentementSanteParId");

-- AddForeignKey
ALTER TABLE "Scout" ADD CONSTRAINT "Scout_consentementSanteParId_fkey" FOREIGN KEY ("consentementSanteParId") REFERENCES "Utilisateur"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- CreateIndex
CREATE INDEX "JournalAudit_createdAt_idx" ON "JournalAudit"("createdAt");

-- Scouts déjà inactifs : la date de dernière modification sert de date de
-- désactivation (approximation prudente : elle ne peut être qu'ultérieure).
UPDATE "Scout" SET "desactiveLe" = "updatedAt" WHERE "actif" = false;
