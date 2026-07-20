-- CreateEnum
CREATE TYPE "EtapeCompagnon" AS ENUM ('NOVICIAT', 'APPRENTISSAGE', 'COMPAGNONNAGE', 'DEPART_ROUTIER');

-- CreateEnum
CREATE TYPE "TypeActiviteParcours" AS ENUM ('DUREE', 'EVENEMENT');

-- CreateEnum
CREATE TYPE "TrancheAgeCompagnon" AS ENUM ('DIX_HUIT_ANS', 'DIX_NEUF_ANS', 'VINGT_ANS');

-- CreateEnum
CREATE TYPE "StatutProgressionCompagnon" AS ENUM ('A_VENIR', 'EN_COURS', 'EN_RETARD', 'SOUMISE', 'VALIDEE', 'REJETEE', 'ANNULEE');

-- CreateEnum
CREATE TYPE "StatutParcoursCompagnon" AS ENUM ('ACTIF', 'TERMINE', 'SUSPENDU', 'ABANDONNE');

-- CreateTable
CREATE TABLE "EtapeParcoursCompagnon" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "nom" TEXT NOT NULL,
    "description" TEXT,
    "etape" "EtapeCompagnon" NOT NULL,
    "ordre" INTEGER NOT NULL,
    "type" "TypeActiviteParcours" NOT NULL,
    "dureeDixHuitAns" INTEGER NOT NULL,
    "dureeDixNeufAns" INTEGER NOT NULL,
    "dureeVingtAns" INTEGER NOT NULL,
    "nomAttribut" TEXT,
    "obligatoire" BOOLEAN NOT NULL DEFAULT true,
    "actif" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EtapeParcoursCompagnon_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ParcoursCompagnon" (
    "id" TEXT NOT NULL,
    "dateEntreeParcours" TIMESTAMP(3) NOT NULL,
    "ageEntree" INTEGER NOT NULL,
    "trancheAge" "TrancheAgeCompagnon" NOT NULL,
    "dateFinPrevue" TIMESTAMP(3) NOT NULL,
    "dateFinReelle" TIMESTAMP(3),
    "statut" "StatutParcoursCompagnon" NOT NULL DEFAULT 'ACTIF',
    "scoutId" TEXT NOT NULL,
    "responsableId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ParcoursCompagnon_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProgressionCompagnon" (
    "id" TEXT NOT NULL,
    "dateDebutTheorique" TIMESTAMP(3) NOT NULL,
    "dateLimiteTheorique" TIMESTAMP(3) NOT NULL,
    "dateRealisationDeclaree" TIMESTAMP(3),
    "statut" "StatutProgressionCompagnon" NOT NULL DEFAULT 'A_VENIR',
    "commentaireDeclaration" TEXT,
    "motifRejet" TEXT,
    "preuveUrl" TEXT,
    "numeroSoumission" INTEGER NOT NULL DEFAULT 0,
    "soumisLe" TIMESTAMP(3),
    "valideLe" TIMESTAMP(3),
    "rejeteLe" TIMESTAMP(3),
    "derniereAlerteRetardLe" TIMESTAMP(3),
    "parcoursId" TEXT NOT NULL,
    "etapeActiviteId" TEXT NOT NULL,
    "soumisParId" TEXT,
    "valideParId" TEXT,
    "rejeteParId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProgressionCompagnon_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AttributCompagnon" (
    "id" TEXT NOT NULL,
    "nom" TEXT NOT NULL,
    "obtenuLe" TIMESTAMP(3) NOT NULL,
    "parcoursId" TEXT NOT NULL,
    "etapeActiviteId" TEXT NOT NULL,
    "obtenuParId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AttributCompagnon_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "EtapeParcoursCompagnon_code_key" ON "EtapeParcoursCompagnon"("code");

-- CreateIndex
CREATE INDEX "EtapeParcoursCompagnon_actif_ordre_idx" ON "EtapeParcoursCompagnon"("actif", "ordre");

-- CreateIndex
CREATE UNIQUE INDEX "EtapeParcoursCompagnon_etape_ordre_key" ON "EtapeParcoursCompagnon"("etape", "ordre");

-- CreateIndex
CREATE UNIQUE INDEX "ParcoursCompagnon_scoutId_key" ON "ParcoursCompagnon"("scoutId");

-- CreateIndex
CREATE INDEX "ParcoursCompagnon_statut_idx" ON "ParcoursCompagnon"("statut");

-- CreateIndex
CREATE INDEX "ParcoursCompagnon_dateFinPrevue_idx" ON "ParcoursCompagnon"("dateFinPrevue");

-- CreateIndex
CREATE INDEX "ParcoursCompagnon_trancheAge_idx" ON "ParcoursCompagnon"("trancheAge");

-- CreateIndex
CREATE INDEX "ProgressionCompagnon_statut_idx" ON "ProgressionCompagnon"("statut");

-- CreateIndex
CREATE INDEX "ProgressionCompagnon_dateLimiteTheorique_idx" ON "ProgressionCompagnon"("dateLimiteTheorique");

-- CreateIndex
CREATE UNIQUE INDEX "ProgressionCompagnon_parcoursId_etapeActiviteId_key" ON "ProgressionCompagnon"("parcoursId", "etapeActiviteId");

-- CreateIndex
CREATE UNIQUE INDEX "AttributCompagnon_parcoursId_etapeActiviteId_key" ON "AttributCompagnon"("parcoursId", "etapeActiviteId");

-- AddForeignKey
ALTER TABLE "ParcoursCompagnon" ADD CONSTRAINT "ParcoursCompagnon_scoutId_fkey" FOREIGN KEY ("scoutId") REFERENCES "Scout"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ParcoursCompagnon" ADD CONSTRAINT "ParcoursCompagnon_responsableId_fkey" FOREIGN KEY ("responsableId") REFERENCES "Utilisateur"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProgressionCompagnon" ADD CONSTRAINT "ProgressionCompagnon_parcoursId_fkey" FOREIGN KEY ("parcoursId") REFERENCES "ParcoursCompagnon"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProgressionCompagnon" ADD CONSTRAINT "ProgressionCompagnon_etapeActiviteId_fkey" FOREIGN KEY ("etapeActiviteId") REFERENCES "EtapeParcoursCompagnon"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProgressionCompagnon" ADD CONSTRAINT "ProgressionCompagnon_soumisParId_fkey" FOREIGN KEY ("soumisParId") REFERENCES "Utilisateur"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProgressionCompagnon" ADD CONSTRAINT "ProgressionCompagnon_valideParId_fkey" FOREIGN KEY ("valideParId") REFERENCES "Utilisateur"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProgressionCompagnon" ADD CONSTRAINT "ProgressionCompagnon_rejeteParId_fkey" FOREIGN KEY ("rejeteParId") REFERENCES "Utilisateur"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttributCompagnon" ADD CONSTRAINT "AttributCompagnon_parcoursId_fkey" FOREIGN KEY ("parcoursId") REFERENCES "ParcoursCompagnon"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttributCompagnon" ADD CONSTRAINT "AttributCompagnon_obtenuParId_fkey" FOREIGN KEY ("obtenuParId") REFERENCES "Utilisateur"("id") ON DELETE SET NULL ON UPDATE CASCADE;

