-- Jetons de réinitialisation : seule l'empreinte SHA-256 est conservée.
-- Les jetons en cours sont convertis sur place : les liens déjà envoyés par
-- e-mail restent valides jusqu'à leur expiration.
ALTER TABLE "TokenReinitialisation" RENAME COLUMN "token" TO "empreinte";

UPDATE "TokenReinitialisation" SET "empreinte" = encode(sha256(convert_to("empreinte", 'UTF8')), 'hex');

ALTER INDEX "TokenReinitialisation_token_key" RENAME TO "TokenReinitialisation_empreinte_key";

ALTER INDEX "TokenReinitialisation_token_idx" RENAME TO "TokenReinitialisation_empreinte_idx";
