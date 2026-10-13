-- DropIndex
DROP INDEX "Paroisse_doyenne_idx";

-- RenameColumn (préserve les données existantes — Prisma diff proposerait un DROP+ADD)
ALTER TABLE "Paroisse" RENAME COLUMN "doyenne" TO "district";

-- AlterTable
ALTER TABLE "Utilisateur" ADD COLUMN     "brancheType" "BrancheType";

-- CreateIndex
CREATE INDEX "Paroisse_district_idx" ON "Paroisse"("district");

-- CreateIndex
CREATE INDEX "Utilisateur_brancheType_idx" ON "Utilisateur"("brancheType");
