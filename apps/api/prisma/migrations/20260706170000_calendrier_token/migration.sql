-- AlterTable
ALTER TABLE "Utilisateur" ADD COLUMN     "tokenCalendrier" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Utilisateur_tokenCalendrier_key" ON "Utilisateur"("tokenCalendrier");
