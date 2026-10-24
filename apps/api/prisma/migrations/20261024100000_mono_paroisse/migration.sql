-- Simplification mono-paroissiale (voir docs/migration-mono-paroisse.md).
--
-- 1. Garde-fou : la migration s'interrompt (et n'applique RIEN, transaction
--    unique) si la base contient plusieurs paroisses ou plusieurs districts.
--    Un arbitrage humain est alors nécessaire avant toute simplification.
-- 2. Archivage : paroisse, district, affectations district, configuration
--    plateforme et colonnes district des comptes sont copiés en JSON dans
--    "ArchiveDonnees" avant toute suppression. Aucune donnée n'est perdue.
-- 3. Reprise : l'identité de la paroisse devient la configuration unique de
--    l'installation ; les responsabilités actuelles ouvrent un mandat.
-- 4. Simplification : retrait des clés paroisseId, des tables District,
--    Paroisse, AffectationDistrict, ConfigurationPlateforme et des rôles
--    district ; ADMIN_PLATEFORME devient ADMINISTRATEUR (administration locale).

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. Garde-fou
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF (SELECT count(*) FROM "Paroisse") > 1 THEN
    RAISE EXCEPTION 'Migration mono-paroisse bloquée : % paroisses en base. Arbitrage requis (docs/migration-mono-paroisse.md).',
      (SELECT count(*) FROM "Paroisse");
  END IF;
  IF (SELECT count(*) FROM "District") > 1 THEN
    RAISE EXCEPTION 'Migration mono-paroisse bloquée : % districts en base. Arbitrage requis (docs/migration-mono-paroisse.md).',
      (SELECT count(*) FROM "District");
  END IF;
  IF EXISTS (
    SELECT 1 FROM "Utilisateur"
    WHERE "role"::text IN ('COMMISSAIRE_DISTRICT', 'ADJOINT_DISTRICT', 'ASSISTANT_DISTRICT')
  ) THEN
    RAISE EXCEPTION 'Migration mono-paroisse bloquée : des comptes ont un rôle principal district. Arbitrage requis.';
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 2. Archivage
-- ---------------------------------------------------------------------------
CREATE TABLE "ArchiveDonnees" (
    "id" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "sourceId" TEXT,
    "donnees" JSONB NOT NULL,
    "motif" TEXT NOT NULL,
    "archiveLe" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ArchiveDonnees_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "ArchiveDonnees_source_idx" ON "ArchiveDonnees"("source");

INSERT INTO "ArchiveDonnees" ("id", "source", "sourceId", "donnees", "motif")
SELECT gen_random_uuid()::text, 'District', d."id", to_jsonb(d), 'Retrait du district (mono-paroisse)'
FROM "District" d;

INSERT INTO "ArchiveDonnees" ("id", "source", "sourceId", "donnees", "motif")
SELECT gen_random_uuid()::text, 'Paroisse', p."id", to_jsonb(p), 'Paroisse devenue configuration de l''installation'
FROM "Paroisse" p;

INSERT INTO "ArchiveDonnees" ("id", "source", "sourceId", "donnees", "motif")
SELECT gen_random_uuid()::text, 'AffectationDistrict', a."id", to_jsonb(a), 'Retrait du district (mono-paroisse)'
FROM "AffectationDistrict" a;

INSERT INTO "ArchiveDonnees" ("id", "source", "sourceId", "donnees", "motif")
SELECT gen_random_uuid()::text, 'ConfigurationPlateforme', c."id", to_jsonb(c), 'Fusion dans ConfigurationInstallation'
FROM "ConfigurationPlateforme" c;

INSERT INTO "ArchiveDonnees" ("id", "source", "sourceId", "donnees", "motif")
SELECT gen_random_uuid()::text, 'Utilisateur.district', u."id",
  jsonb_build_object(
    'paroisseId', u."paroisseId",
    'roleDistrict', u."roleDistrict",
    'fonctionDistrict', u."fonctionDistrict",
    'brancheTypeDistrict', u."brancheTypeDistrict"
  ),
  'Colonnes district retirées des comptes'
FROM "Utilisateur" u
WHERE u."roleDistrict" IS NOT NULL OR u."fonctionDistrict" IS NOT NULL OR u."brancheTypeDistrict" IS NOT NULL;

-- ---------------------------------------------------------------------------
-- 3. Configuration unique de l'installation
-- ---------------------------------------------------------------------------
CREATE TABLE "ConfigurationInstallation" (
    "id" TEXT NOT NULL DEFAULT 'installation',
    "nomParoisse" TEXT NOT NULL DEFAULT '',
    "nomGroupe" TEXT NOT NULL DEFAULT '',
    "ville" TEXT,
    "diocese" TEXT,
    "presentation" TEXT,
    "messageBienvenue" TEXT,
    "anneeHistorique" INTEGER,
    "rangHistorique" TEXT,
    "rangHistoriqueValide" BOOLEAN NOT NULL DEFAULT false,
    "sourceHistorique" TEXT,
    "adresse" TEXT,
    "telephone" TEXT,
    "email" TEXT,
    "horaires" TEXT,
    "logoUrl" TEXT,
    "couleurPrimaire" TEXT NOT NULL DEFAULT '#2f5d3a',
    "couleurAccent" TEXT NOT NULL DEFAULT '#b5653f',
    "couleurFond" TEXT NOT NULL DEFAULT '#1f3a28',
    "couleurHover" TEXT NOT NULL DEFAULT '#c27a52',
    "heroTitre" TEXT,
    "heroSousTitre" TEXT,
    "heroImageUrl" TEXT,
    "heroImageAlt" TEXT,
    "reseauxSociaux" JSONB,
    "inscriptionsOuvertes" BOOLEAN NOT NULL DEFAULT true,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedById" TEXT,

    CONSTRAINT "ConfigurationInstallation_pkey" PRIMARY KEY ("id")
);

-- Année 1956 fournie par le commanditaire. Le rang historique reste « non
-- validé » (jamais affiché publiquement) tant qu'une source ne le confirme pas.
-- Couleurs : celles personnalisées par la paroisse ou la plateforme sont
-- conservées ; les anciennes valeurs par défaut cèdent la place à la charte.
INSERT INTO "ConfigurationInstallation" (
  "id", "nomParoisse", "ville", "diocese", "adresse", "telephone", "email", "logoUrl",
  "couleurPrimaire", "couleurAccent", "couleurFond", "couleurHover",
  "heroTitre", "heroSousTitre", "heroImageUrl", "heroImageAlt",
  "anneeHistorique", "rangHistorique", "rangHistoriqueValide", "updatedAt"
)
SELECT
  'installation',
  COALESCE(p."nom", ''),
  p."ville",
  p."diocese",
  p."adresse",
  p."telephone",
  p."email",
  COALESCE(NULLIF(p."logo", ''), NULLIF(c."logoUrl", '')),
  COALESCE(p."couleurPrimaire", NULLIF(c."couleurPrimaire", '#1a4731'), '#2f5d3a'),
  COALESCE(p."couleurAccent", NULLIF(c."couleurAccent", '#27ae60'), '#b5653f'),
  COALESCE(p."couleurFond", NULLIF(c."couleurFond", '#0f2418'), '#1f3a28'),
  COALESCE(p."couleurHover", NULLIF(c."couleurHover", '#27ae60'), '#c27a52'),
  c."heroTitre",
  c."heroSousTitre",
  NULLIF(c."heroImageUrl", ''),
  c."heroImageAlt",
  1956,
  'Deuxième paroisse de Côte d''Ivoire à accueillir le scoutisme',
  false,
  CURRENT_TIMESTAMP
FROM (SELECT 1) AS un
LEFT JOIN "Paroisse" p ON true
LEFT JOIN "ConfigurationPlateforme" c ON c."id" = 'platform';

-- ---------------------------------------------------------------------------
-- 4. Rôles : ADMIN_PLATEFORME → ADMINISTRATEUR, retrait des rôles district
-- ---------------------------------------------------------------------------
ALTER TABLE "Utilisateur" DROP CONSTRAINT IF EXISTS "chk_utilisateur_paroisse_coherente";
DROP INDEX IF EXISTS "Utilisateur_chef_groupe_actif_par_paroisse_key";
DROP INDEX IF EXISTS "Utilisateur_responsable_branche_actif_par_paroisse_key";

ALTER TABLE "AffectationDistrict" DROP CONSTRAINT "AffectationDistrict_districtId_fkey";
ALTER TABLE "AffectationDistrict" DROP CONSTRAINT "AffectationDistrict_utilisateurId_fkey";
DROP TABLE "AffectationDistrict";

DROP INDEX "Utilisateur_roleDistrict_idx";
ALTER TABLE "Utilisateur" DROP COLUMN "roleDistrict",
  DROP COLUMN "fonctionDistrict",
  DROP COLUMN "brancheTypeDistrict";

CREATE TYPE "RoleUtilisateur_new" AS ENUM ('ADMINISTRATEUR', 'CHEF_GROUPE', 'ADJOINT_GROUPE', 'ASSISTANT_GROUPE', 'RESPONSABLE_BRANCHE', 'ADJOINT_BRANCHE', 'ASSISTANT_BRANCHE', 'PARENT', 'SCOUT');
ALTER TABLE "Utilisateur" ALTER COLUMN "role" TYPE "RoleUtilisateur_new"
  USING (CASE WHEN "role"::text = 'ADMIN_PLATEFORME' THEN 'ADMINISTRATEUR' ELSE "role"::text END)::"RoleUtilisateur_new";
ALTER TYPE "RoleUtilisateur" RENAME TO "RoleUtilisateur_old";
ALTER TYPE "RoleUtilisateur_new" RENAME TO "RoleUtilisateur";
DROP TYPE "RoleUtilisateur_old";

-- Unicité de la direction : un seul Chef de Groupe actif, un seul
-- Responsable actif par branche (une seule paroisse désormais).
CREATE UNIQUE INDEX "Utilisateur_chef_groupe_actif_key"
  ON "Utilisateur"("role") WHERE "role" = 'CHEF_GROUPE' AND "actif" = true;
CREATE UNIQUE INDEX "Utilisateur_responsable_branche_actif_key"
  ON "Utilisateur"("brancheType") WHERE "role" = 'RESPONSABLE_BRANCHE' AND "actif" = true;

-- ---------------------------------------------------------------------------
-- 5. Retrait des clés paroisseId et des tables multi-paroisses
-- ---------------------------------------------------------------------------
ALTER TABLE "Activite" DROP CONSTRAINT "Activite_paroisseId_fkey";
ALTER TABLE "ConfigReunionBranche" DROP CONSTRAINT "ConfigReunionBranche_paroisseId_fkey";
ALTER TABLE "Cotisation" DROP CONSTRAINT "Cotisation_paroisseId_fkey";
ALTER TABLE "JourReunion" DROP CONSTRAINT "JourReunion_paroisseId_fkey";
ALTER TABLE "JournalAudit" DROP CONSTRAINT "JournalAudit_paroisseId_fkey";
ALTER TABLE "Paroisse" DROP CONSTRAINT "Paroisse_districtId_fkey";
ALTER TABLE "Programme" DROP CONSTRAINT "Programme_paroisseId_fkey";
ALTER TABLE "Scout" DROP CONSTRAINT "Scout_paroisseId_fkey";
ALTER TABLE "Utilisateur" DROP CONSTRAINT "Utilisateur_paroisseId_fkey";

DROP INDEX "Activite_paroisseId_idx";
DROP INDEX "ConfigReunionBranche_paroisseId_brancheType_key";
DROP INDEX "ConfigReunionBranche_paroisseId_idx";
DROP INDEX "Cotisation_paroisseId_idx";
DROP INDEX "JourReunion_paroisseId_idx";
DROP INDEX "JournalAudit_paroisseId_createdAt_idx";
DROP INDEX "Programme_paroisseId_idx";
DROP INDEX "Scout_paroisseId_idx";
DROP INDEX "Utilisateur_paroisseId_idx";
-- Redondants avec les index uniques de mêmes colonnes.
DROP INDEX "Utilisateur_matricule_idx";
DROP INDEX "Utilisateur_telephone_idx";

ALTER TABLE "Activite" DROP COLUMN "paroisseId";
ALTER TABLE "ConfigReunionBranche" DROP COLUMN "paroisseId";
ALTER TABLE "Cotisation" DROP COLUMN "paroisseId";
ALTER TABLE "JourReunion" DROP COLUMN "paroisseId";
ALTER TABLE "JournalAudit" DROP COLUMN "paroisseId";
ALTER TABLE "Programme" DROP COLUMN "paroisseId";
ALTER TABLE "Scout" DROP COLUMN "paroisseId";
ALTER TABLE "Utilisateur" DROP COLUMN "paroisseId";

DROP TABLE "ConfigurationPlateforme";
DROP TABLE "Paroisse";
DROP TABLE "District";

CREATE UNIQUE INDEX "ConfigReunionBranche_brancheType_key" ON "ConfigReunionBranche"("brancheType");

-- ---------------------------------------------------------------------------
-- 6. Nouveaux champs et modèles
-- ---------------------------------------------------------------------------
CREATE TYPE "StatutActivite" AS ENUM ('PREVUE', 'EN_COURS', 'TERMINEE', 'ANNULEE');
CREATE TYPE "StatutPublication" AS ENUM ('BROUILLON', 'PUBLIEE', 'ARCHIVEE');
CREATE TYPE "TypeEvenementHistorique" AS ENUM ('ORIGINE', 'FONDATION', 'CHEF_DE_GROUPE', 'CAMP', 'ETAPE', 'TEMOIGNAGE', 'ARCHIVE');
CREATE TYPE "StatutValidationHistorique" AS ENUM ('A_VERIFIER', 'VALIDE');
CREATE TYPE "TypeDemande" AS ENUM ('INSCRIPTION_JEUNE', 'ENGAGEMENT_ADULTE', 'INFORMATION');
CREATE TYPE "StatutDemande" AS ENUM ('NOUVELLE', 'EN_COURS', 'ACCEPTEE', 'REFUSEE', 'ARCHIVEE');

ALTER TABLE "Activite"
  ADD COLUMN "bilan" TEXT,
  ADD COLUMN "descriptionPublique" TEXT,
  ADD COLUMN "publique" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "responsableId" TEXT,
  ADD COLUMN "statut" "StatutActivite" NOT NULL DEFAULT 'PREVUE';
-- Activités passées : terminées (aucune n'est rendue publique).
UPDATE "Activite" SET "statut" = 'TERMINEE' WHERE COALESCE("dateFin", "dateDebut") < CURRENT_TIMESTAMP;

ALTER TABLE "Cotisation" ADD COLUMN "activiteId" TEXT;
ALTER TABLE "Scout" ADD COLUMN "equipeId" TEXT;

ALTER TABLE "Utilisateur"
  ADD COLUMN "biographie" TEXT,
  ADD COLUMN "editeurContenu" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "fonctionPublique" TEXT,
  ADD COLUMN "ordrePublic" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "photoPublique" TEXT,
  ADD COLUMN "profilPublic" BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE "Branche" (
    "id" TEXT NOT NULL,
    "type" "BrancheType" NOT NULL,
    "slug" TEXT NOT NULL,
    "presentation" TEXT,
    "identite" TEXT,
    "objectifs" TEXT,
    "pedagogie" TEXT,
    "activitesTypes" TEXT,
    "imageUrl" TEXT,
    "imageAlt" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "publiee" BOOLEAN NOT NULL DEFAULT true,
    "ordre" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Branche_pkey" PRIMARY KEY ("id")
);

-- Branches du référentiel officiel : textes de présentation laissés vides,
-- à compléter par le groupe (aucun contenu pédagogique inventé).
INSERT INTO "Branche" ("id", "type", "slug", "ordre", "updatedAt") VALUES
  ('branche-oisillons', 'OISILLONS', 'oisillons', 1, CURRENT_TIMESTAMP),
  ('branche-louveteaux', 'LOUVETEAUX', 'louveteaux', 2, CURRENT_TIMESTAMP),
  ('branche-eclaireurs', 'ECLAIREURS', 'eclaireurs', 3, CURRENT_TIMESTAMP),
  ('branche-cheminots', 'CHEMINOTS', 'cheminots', 4, CURRENT_TIMESTAMP),
  ('branche-compagnons', 'COMPAGNONS', 'compagnons', 5, CURRENT_TIMESTAMP),
  ('branche-ressources-adultes', 'RESSOURCES_ADULTES', 'ressources-adultes', 6, CURRENT_TIMESTAMP);

CREATE TABLE "Equipe" (
    "id" TEXT NOT NULL,
    "nom" TEXT NOT NULL,
    "brancheType" "BrancheType" NOT NULL,
    "description" TEXT,
    "actif" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Equipe_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Mandat" (
    "id" TEXT NOT NULL,
    "role" "RoleUtilisateur" NOT NULL,
    "brancheType" "BrancheType",
    "debutLe" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finLe" TIMESTAMP(3),
    "auteurId" TEXT,
    "motif" TEXT,
    "utilisateurId" TEXT NOT NULL,

    CONSTRAINT "Mandat_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "Mandat_dates_check" CHECK ("finLe" IS NULL OR "finLe" >= "debutLe")
);
CREATE UNIQUE INDEX "Mandat_actif_utilisateur_key" ON "Mandat"("utilisateurId") WHERE "finLe" IS NULL;

-- Responsabilités actuelles : un mandat ouvert par compte de maîtrise actif.
-- La date de début réelle est inconnue : la date de reprise est utilisée et
-- signalée comme telle.
INSERT INTO "Mandat" ("id", "role", "brancheType", "debutLe", "motif", "utilisateurId")
SELECT gen_random_uuid()::text, u."role", u."brancheType", CURRENT_TIMESTAMP,
  'Reprise lors de la migration mono-paroissiale (date de début réelle inconnue)', u."id"
FROM "Utilisateur" u
WHERE u."actif" = true AND u."role" IN ('CHEF_GROUPE', 'ADJOINT_GROUPE', 'ASSISTANT_GROUPE', 'RESPONSABLE_BRANCHE', 'ADJOINT_BRANCHE', 'ASSISTANT_BRANCHE');

CREATE TABLE "BaremeCotisation" (
    "id" TEXT NOT NULL,
    "anneeScolaire" TEXT NOT NULL,
    "type" "TypeCotisation" NOT NULL,
    "brancheType" "BrancheType",
    "libelle" TEXT,
    "montant" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BaremeCotisation_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "BaremeCotisation_montant_check" CHECK ("montant" >= 0)
);

CREATE TABLE "CategoriePublication" (
    "id" TEXT NOT NULL,
    "nom" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CategoriePublication_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Publication" (
    "id" TEXT NOT NULL,
    "titre" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "resume" TEXT,
    "contenu" TEXT NOT NULL,
    "imageCouverture" TEXT,
    "imageAlt" TEXT,
    "statut" "StatutPublication" NOT NULL DEFAULT 'BROUILLON',
    "datePublication" TIMESTAMP(3),
    "seoTitre" TEXT,
    "seoDescription" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "categorieId" TEXT,
    "auteurId" TEXT,

    CONSTRAINT "Publication_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Album" (
    "id" TEXT NOT NULL,
    "titre" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "categorie" TEXT,
    "dateEvenement" TIMESTAMP(3),
    "publie" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "activiteId" TEXT,

    CONSTRAINT "Album_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Media" (
    "id" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "legende" TEXT,
    "texteAlt" TEXT,
    "ordre" INTEGER NOT NULL DEFAULT 0,
    "publie" BOOLEAN NOT NULL DEFAULT false,
    "contientMineurs" BOOLEAN NOT NULL DEFAULT true,
    "consentementVerifie" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "albumId" TEXT NOT NULL,

    CONSTRAINT "Media_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "EvenementHistorique" (
    "id" TEXT NOT NULL,
    "annee" INTEGER NOT NULL,
    "date" TIMESTAMP(3),
    "titre" TEXT NOT NULL,
    "description" TEXT,
    "type" "TypeEvenementHistorique" NOT NULL DEFAULT 'ETAPE',
    "auteurTemoignage" TEXT,
    "imageUrl" TEXT,
    "imageAlt" TEXT,
    "documentUrl" TEXT,
    "source" TEXT,
    "statutValidation" "StatutValidationHistorique" NOT NULL DEFAULT 'A_VERIFIER',
    "publie" BOOLEAN NOT NULL DEFAULT false,
    "ordre" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EvenementHistorique_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "DemandeAdhesion" (
    "id" TEXT NOT NULL,
    "type" "TypeDemande" NOT NULL DEFAULT 'INSCRIPTION_JEUNE',
    "nomContact" TEXT NOT NULL,
    "prenomContact" TEXT NOT NULL,
    "telephone" TEXT NOT NULL,
    "email" TEXT,
    "nomJeune" TEXT,
    "prenomJeune" TEXT,
    "dateNaissanceJeune" TIMESTAMP(3),
    "brancheSouhaitee" "BrancheType",
    "message" TEXT,
    "consentementLe" TIMESTAMP(3) NOT NULL,
    "statut" "StatutDemande" NOT NULL DEFAULT 'NOUVELLE',
    "notesInternes" TEXT,
    "traiteeLe" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "traiteeParId" TEXT,

    CONSTRAINT "DemandeAdhesion_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Branche_type_key" ON "Branche"("type");
CREATE UNIQUE INDEX "Branche_slug_key" ON "Branche"("slug");
CREATE INDEX "Equipe_brancheType_idx" ON "Equipe"("brancheType");
CREATE UNIQUE INDEX "Equipe_brancheType_nom_key" ON "Equipe"("brancheType", "nom");
CREATE INDEX "Mandat_utilisateurId_debutLe_idx" ON "Mandat"("utilisateurId", "debutLe");
CREATE INDEX "Mandat_role_idx" ON "Mandat"("role");
CREATE INDEX "BaremeCotisation_anneeScolaire_idx" ON "BaremeCotisation"("anneeScolaire");
CREATE UNIQUE INDEX "CategoriePublication_nom_key" ON "CategoriePublication"("nom");
CREATE UNIQUE INDEX "CategoriePublication_slug_key" ON "CategoriePublication"("slug");
CREATE UNIQUE INDEX "Publication_slug_key" ON "Publication"("slug");
CREATE INDEX "Publication_statut_datePublication_idx" ON "Publication"("statut", "datePublication");
CREATE INDEX "Publication_categorieId_idx" ON "Publication"("categorieId");
CREATE UNIQUE INDEX "Album_slug_key" ON "Album"("slug");
CREATE INDEX "Album_publie_dateEvenement_idx" ON "Album"("publie", "dateEvenement");
CREATE INDEX "Media_albumId_ordre_idx" ON "Media"("albumId", "ordre");
CREATE INDEX "Media_url_idx" ON "Media"("url");
CREATE INDEX "EvenementHistorique_publie_annee_idx" ON "EvenementHistorique"("publie", "annee");
CREATE INDEX "DemandeAdhesion_statut_createdAt_idx" ON "DemandeAdhesion"("statut", "createdAt");
CREATE INDEX "Activite_publique_dateDebut_idx" ON "Activite"("publique", "dateDebut");
CREATE INDEX "Cotisation_activiteId_idx" ON "Cotisation"("activiteId");
CREATE INDEX "JournalAudit_action_idx" ON "JournalAudit"("action");
CREATE INDEX "Scout_equipeId_idx" ON "Scout"("equipeId");
CREATE INDEX "Scout_nom_prenom_idx" ON "Scout"("nom", "prenom");

ALTER TABLE "Mandat" ADD CONSTRAINT "Mandat_utilisateurId_fkey" FOREIGN KEY ("utilisateurId") REFERENCES "Utilisateur"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Scout" ADD CONSTRAINT "Scout_equipeId_fkey" FOREIGN KEY ("equipeId") REFERENCES "Equipe"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Activite" ADD CONSTRAINT "Activite_responsableId_fkey" FOREIGN KEY ("responsableId") REFERENCES "Utilisateur"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Cotisation" ADD CONSTRAINT "Cotisation_activiteId_fkey" FOREIGN KEY ("activiteId") REFERENCES "Activite"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Publication" ADD CONSTRAINT "Publication_categorieId_fkey" FOREIGN KEY ("categorieId") REFERENCES "CategoriePublication"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Publication" ADD CONSTRAINT "Publication_auteurId_fkey" FOREIGN KEY ("auteurId") REFERENCES "Utilisateur"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Album" ADD CONSTRAINT "Album_activiteId_fkey" FOREIGN KEY ("activiteId") REFERENCES "Activite"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Media" ADD CONSTRAINT "Media_albumId_fkey" FOREIGN KEY ("albumId") REFERENCES "Album"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DemandeAdhesion" ADD CONSTRAINT "DemandeAdhesion_traiteeParId_fkey" FOREIGN KEY ("traiteeParId") REFERENCES "Utilisateur"("id") ON DELETE SET NULL ON UPDATE CASCADE;

COMMIT;
