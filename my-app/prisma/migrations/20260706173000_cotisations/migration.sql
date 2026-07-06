-- CreateEnum
CREATE TYPE "TypeCotisation" AS ENUM ('ADHESION_ANNUELLE', 'CAMP', 'AUTRE');

-- CreateEnum
CREATE TYPE "StatutCotisation" AS ENUM ('EN_ATTENTE', 'PAYEE', 'EXONEREE');

-- CreateTable
CREATE TABLE "Cotisation" (
    "id" TEXT NOT NULL,
    "type" "TypeCotisation" NOT NULL DEFAULT 'ADHESION_ANNUELLE',
    "libelle" TEXT,
    "montant" INTEGER NOT NULL,
    "anneeScolaire" TEXT NOT NULL,
    "statut" "StatutCotisation" NOT NULL DEFAULT 'EN_ATTENTE',
    "datePaiement" TIMESTAMP(3),
    "modePaiement" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "scoutId" TEXT NOT NULL,
    "paroisseId" TEXT NOT NULL,
    "enregistreParId" TEXT,

    CONSTRAINT "Cotisation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Cotisation_paroisseId_idx" ON "Cotisation"("paroisseId");

-- CreateIndex
CREATE INDEX "Cotisation_scoutId_idx" ON "Cotisation"("scoutId");

-- CreateIndex
CREATE INDEX "Cotisation_statut_idx" ON "Cotisation"("statut");

-- CreateIndex
CREATE INDEX "Cotisation_anneeScolaire_idx" ON "Cotisation"("anneeScolaire");

-- AddForeignKey
ALTER TABLE "Cotisation" ADD CONSTRAINT "Cotisation_scoutId_fkey" FOREIGN KEY ("scoutId") REFERENCES "Scout"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Cotisation" ADD CONSTRAINT "Cotisation_paroisseId_fkey" FOREIGN KEY ("paroisseId") REFERENCES "Paroisse"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Cotisation" ADD CONSTRAINT "Cotisation_enregistreParId_fkey" FOREIGN KEY ("enregistreParId") REFERENCES "Utilisateur"("id") ON DELETE SET NULL ON UPDATE CASCADE;

