-- Rappel d'expiration envoyé une seule fois par document, quelle que soit la
-- fréquence du déclencheur.
-- AlterTable
ALTER TABLE "Document" ADD COLUMN "rappelEnvoyeLe" TIMESTAMP(3);
