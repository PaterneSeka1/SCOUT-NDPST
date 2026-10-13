-- AlterEnum
ALTER TYPE "RoleUtilisateur" ADD VALUE 'ADMIN_PLATEFORME';

-- AlterTable
ALTER TABLE "JournalAudit" ALTER COLUMN "paroisseId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "Paroisse" ADD COLUMN     "actif" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "couleurAccent" TEXT,
ADD COLUMN     "couleurFond" TEXT,
ADD COLUMN     "couleurHover" TEXT,
ADD COLUMN     "couleurPrimaire" TEXT;

-- AlterTable
ALTER TABLE "Utilisateur" ALTER COLUMN "paroisseId" DROP NOT NULL;

-- Garde-fou : un ADMIN_PLATEFORME n'appartient à aucune paroisse, tout autre
-- rôle doit obligatoirement en avoir une. Empêche un bug applicatif futur de
-- créer un compte incohérent (rôle métier sans paroisse, ou admin plateforme
-- rattaché par erreur à une paroisse) sur un système gérant des données de mineurs.
ALTER TABLE "Utilisateur" ADD CONSTRAINT "chk_utilisateur_paroisse_coherente"
  CHECK (
    (role = 'ADMIN_PLATEFORME' AND "paroisseId" IS NULL)
    OR (role <> 'ADMIN_PLATEFORME' AND "paroisseId" IS NOT NULL)
  );

-- CreateTable
CREATE TABLE "ConfigurationPlateforme" (
    "id" TEXT NOT NULL DEFAULT 'platform',
    "nomSite" TEXT NOT NULL DEFAULT 'SCOUT ASCCI',
    "sousTitreSite" TEXT NOT NULL DEFAULT 'Côte d''Ivoire',
    "logoUrl" TEXT,
    "couleurPrimaire" TEXT NOT NULL DEFAULT '#1a4731',
    "couleurAccent" TEXT NOT NULL DEFAULT '#27ae60',
    "couleurFond" TEXT NOT NULL DEFAULT '#0f2418',
    "couleurHover" TEXT NOT NULL DEFAULT '#27ae60',
    "heroBadge" TEXT,
    "heroTitre" TEXT,
    "heroSousTitre" TEXT,
    "heroImageUrl" TEXT,
    "heroImageAlt" TEXT,
    "stats" JSONB,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ConfigurationPlateforme_pkey" PRIMARY KEY ("id")
);
