-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "RoleUtilisateur" ADD VALUE 'COMMISSAIRE_DISTRICT';
ALTER TYPE "RoleUtilisateur" ADD VALUE 'ADJOINT_DISTRICT';
ALTER TYPE "RoleUtilisateur" ADD VALUE 'ASSISTANT_DISTRICT';

-- AlterTable
ALTER TABLE "Utilisateur" ADD COLUMN     "fonction" TEXT;

-- CreateIndex
CREATE INDEX "Paroisse_doyenne_idx" ON "Paroisse"("doyenne");
