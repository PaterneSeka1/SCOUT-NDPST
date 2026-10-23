-- Ajout compatible : ne jamais requalifier les accords historiques en preuve parentale.
ALTER TABLE "Scout" ADD COLUMN "consentementImageOrigine" TEXT;
ALTER TABLE "Scout" ADD COLUMN "consentementSanteOrigine" TEXT;

UPDATE "Scout" SET "consentementImageOrigine" = 'NON_VERIFIE' WHERE "consentementImage" IS TRUE;
UPDATE "Scout" SET "consentementSanteOrigine" = 'NON_VERIFIE' WHERE "consentementSante" IS TRUE;
