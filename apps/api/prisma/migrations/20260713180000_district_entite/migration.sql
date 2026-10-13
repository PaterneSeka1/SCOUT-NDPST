-- CreateTable
CREATE TABLE "District" (
    "id" TEXT NOT NULL,
    "nom" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "District_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "District_nom_key" ON "District"("nom");

-- Backfill : un District par valeur distincte de l'ancien Paroisse.district
-- (texte libre), en réutilisant le nom existant tel quel — aucune paroisse
-- ne doit se retrouver sans district après la mise à NOT NULL plus bas.
INSERT INTO "District" ("id", "nom", "createdAt", "updatedAt")
SELECT gen_random_uuid()::text, "district", NOW(), NOW()
FROM "Paroisse"
GROUP BY "district";

-- AlterTable : nouvelle colonne, encore nullable le temps du backfill ci-dessous
ALTER TABLE "Paroisse" ADD COLUMN "districtId" TEXT;

-- Backfill : relie chaque paroisse au District correspondant à son ancienne valeur texte
UPDATE "Paroisse" p
SET "districtId" = d."id"
FROM "District" d
WHERE d."nom" = p."district";

-- AlterTable : la colonne peut maintenant être rendue obligatoire (backfill terminé)
ALTER TABLE "Paroisse" ALTER COLUMN "districtId" SET NOT NULL;

-- DropIndex : ancien index sur le texte libre
DROP INDEX "Paroisse_district_idx";

-- AlterTable : suppression de l'ancien champ texte libre, remplacé par districtId
ALTER TABLE "Paroisse" DROP COLUMN "district";

-- CreateIndex
CREATE INDEX "Paroisse_districtId_idx" ON "Paroisse"("districtId");

-- AddForeignKey
ALTER TABLE "Paroisse" ADD CONSTRAINT "Paroisse_districtId_fkey" FOREIGN KEY ("districtId") REFERENCES "District"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
