-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "BrancheType" AS ENUM ('OISILLONS', 'LOUVETEAUX', 'ECLAIREURS', 'CHEMINOTS', 'COMPAGNONS');

-- CreateEnum
CREATE TYPE "RoleUtilisateur" AS ENUM ('ADMIN_PAROISSE', 'CHEF_GROUPE', 'ADJOINT_GROUPE', 'ASSISTANT_GROUPE', 'RESPONSABLE_BRANCHE', 'ADJOINT_BRANCHE', 'ASSISTANT_BRANCHE', 'PARENT', 'SCOUT');

-- CreateEnum
CREATE TYPE "RolePosteGroupe" AS ENUM ('CHEF_GROUPE', 'ADJOINT_GROUPE', 'ASSISTANT_GROUPE');

-- CreateEnum
CREATE TYPE "RolePosteBranche" AS ENUM ('RESPONSABLE', 'ADJOINT', 'ASSISTANT');

-- CreateEnum
CREATE TYPE "Sexe" AS ENUM ('MASCULIN', 'FEMININ');

-- CreateEnum
CREATE TYPE "TypeActivite" AS ENUM ('REUNION', 'SORTIE', 'CAMP', 'SERVICE', 'CELEBRATION', 'FORMATION', 'AUTRE');

-- CreateEnum
CREATE TYPE "TypeDocument" AS ENUM ('AUTORISATION_PARENTALE', 'CERTIFICAT_MEDICAL', 'PHOTO_IDENTITE', 'AUTRE');

-- CreateEnum
CREATE TYPE "StatutReunion" AS ENUM ('PLANIFIEE', 'REPORTEE', 'ANNULEE', 'TERMINEE');

-- CreateEnum
CREATE TYPE "StatutPresenceReunion" AS ENUM ('PRESENT', 'ABSENT', 'EXCUSE');

-- CreateEnum
CREATE TYPE "TypeAutorisationCamp" AS ENUM ('FICHE_MEDICALE', 'AUTORISATION_PARENTALE');

-- CreateTable
CREATE TABLE "Paroisse" (
    "id" TEXT NOT NULL,
    "nom" TEXT NOT NULL,
    "ville" TEXT NOT NULL,
    "diocese" TEXT NOT NULL,
    "ocean" TEXT,
    "doyenne" TEXT,
    "adresse" TEXT,
    "telephone" TEXT,
    "email" TEXT,
    "logo" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Paroisse_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Utilisateur" (
    "id" TEXT NOT NULL,
    "nom" TEXT NOT NULL,
    "prenom" TEXT NOT NULL,
    "matricule" TEXT,
    "telephone" TEXT,
    "email" TEXT,
    "password" TEXT NOT NULL,
    "role" "RoleUtilisateur" NOT NULL,
    "actif" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "paroisseId" TEXT NOT NULL,

    CONSTRAINT "Utilisateur_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PosteGroupe" (
    "id" TEXT NOT NULL,
    "role" "RolePosteGroupe" NOT NULL,
    "fonction" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "utilisateurId" TEXT NOT NULL,
    "paroisseId" TEXT NOT NULL,

    CONSTRAINT "PosteGroupe_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PosteBranche" (
    "id" TEXT NOT NULL,
    "brancheType" "BrancheType" NOT NULL,
    "role" "RolePosteBranche" NOT NULL,
    "fonction" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "utilisateurId" TEXT NOT NULL,
    "paroisseId" TEXT NOT NULL,

    CONSTRAINT "PosteBranche_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Scout" (
    "id" TEXT NOT NULL,
    "nom" TEXT NOT NULL,
    "prenom" TEXT NOT NULL,
    "dateNaissance" TIMESTAMP(3) NOT NULL,
    "sexe" "Sexe" NOT NULL,
    "brancheType" "BrancheType" NOT NULL,
    "matricule" TEXT,
    "actif" BOOLEAN NOT NULL DEFAULT true,
    "photo" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "paroisseId" TEXT NOT NULL,
    "utilisateurId" TEXT,

    CONSTRAINT "Scout_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContactUrgence" (
    "id" TEXT NOT NULL,
    "nom" TEXT NOT NULL,
    "prenom" TEXT,
    "telephone" TEXT NOT NULL,
    "relation" TEXT,
    "principal" BOOLEAN NOT NULL DEFAULT false,
    "scoutId" TEXT NOT NULL,
    "utilisateurId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ContactUrgence_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LienParentScout" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "parentId" TEXT NOT NULL,
    "scoutId" TEXT NOT NULL,

    CONSTRAINT "LienParentScout_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Activite" (
    "id" TEXT NOT NULL,
    "titre" TEXT NOT NULL,
    "description" TEXT,
    "dateDebut" TIMESTAMP(3) NOT NULL,
    "dateFin" TIMESTAMP(3),
    "lieu" TEXT,
    "type" "TypeActivite" NOT NULL DEFAULT 'REUNION',
    "brancheType" "BrancheType",
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "paroisseId" TEXT NOT NULL,
    "creePar" TEXT NOT NULL,

    CONSTRAINT "Activite_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Presence" (
    "id" TEXT NOT NULL,
    "present" BOOLEAN NOT NULL DEFAULT false,
    "commentaire" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "scoutId" TEXT NOT NULL,
    "activiteId" TEXT NOT NULL,

    CONSTRAINT "Presence_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Badge" (
    "id" TEXT NOT NULL,
    "nom" TEXT NOT NULL,
    "description" TEXT,
    "brancheType" "BrancheType" NOT NULL,
    "ordre" INTEGER NOT NULL DEFAULT 0,
    "icone" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Badge_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProgressionScout" (
    "id" TEXT NOT NULL,
    "dateValidation" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "commentaire" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "scoutId" TEXT NOT NULL,
    "badgeId" TEXT NOT NULL,
    "valideParId" TEXT NOT NULL,

    CONSTRAINT "ProgressionScout_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Document" (
    "id" TEXT NOT NULL,
    "type" "TypeDocument" NOT NULL,
    "nomFichier" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "dateUpload" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "valide" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "scoutId" TEXT NOT NULL,

    CONSTRAINT "Document_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JourReunion" (
    "id" TEXT NOT NULL,
    "brancheType" "BrancheType",
    "titre" TEXT,
    "dateHeure" TIMESTAMP(3) NOT NULL,
    "dureeMinutes" INTEGER,
    "lieu" TEXT,
    "statut" "StatutReunion" NOT NULL DEFAULT 'PLANIFIEE',
    "dateReportee" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "paroisseId" TEXT NOT NULL,
    "creePar" TEXT NOT NULL,

    CONSTRAINT "JourReunion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PresenceReunion" (
    "id" TEXT NOT NULL,
    "statut" "StatutPresenceReunion" NOT NULL DEFAULT 'ABSENT',
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "jourReunionId" TEXT NOT NULL,
    "scoutId" TEXT NOT NULL,
    "marqueParId" TEXT,

    CONSTRAINT "PresenceReunion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TokenReinitialisation" (
    "id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "utilise" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "utilisateurId" TEXT NOT NULL,

    CONSTRAINT "TokenReinitialisation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConfigReunionBranche" (
    "id" TEXT NOT NULL,
    "brancheType" "BrancheType" NOT NULL,
    "jourSemaine" INTEGER NOT NULL,
    "heureDebut" TEXT NOT NULL,
    "dureeMinutes" INTEGER NOT NULL DEFAULT 90,
    "lieu" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "paroisseId" TEXT NOT NULL,

    CONSTRAINT "ConfigReunionBranche_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Programme" (
    "id" TEXT NOT NULL,
    "titre" TEXT NOT NULL,
    "description" TEXT,
    "periodeDebut" TIMESTAMP(3) NOT NULL,
    "periodeFin" TIMESTAMP(3) NOT NULL,
    "brancheType" "BrancheType",
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "paroisseId" TEXT NOT NULL,
    "creePar" TEXT NOT NULL,

    CONSTRAINT "Programme_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LigneProgramme" (
    "id" TEXT NOT NULL,
    "theme" TEXT NOT NULL,
    "objectif" TEXT,
    "datePrevue" TIMESTAMP(3),
    "ordre" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "programmeId" TEXT NOT NULL,
    "activiteId" TEXT,

    CONSTRAINT "LigneProgramme_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AutorisationCamp" (
    "id" TEXT NOT NULL,
    "type" "TypeAutorisationCamp" NOT NULL,
    "documentNomFichier" TEXT,
    "documentUrl" TEXT,
    "confirmeLe" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "activiteId" TEXT NOT NULL,
    "scoutId" TEXT NOT NULL,
    "confirmeParId" TEXT,

    CONSTRAINT "AutorisationCamp_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Paroisse_email_key" ON "Paroisse"("email");

-- CreateIndex
CREATE INDEX "Paroisse_ville_idx" ON "Paroisse"("ville");

-- CreateIndex
CREATE INDEX "Paroisse_diocese_idx" ON "Paroisse"("diocese");

-- CreateIndex
CREATE UNIQUE INDEX "Utilisateur_matricule_key" ON "Utilisateur"("matricule");

-- CreateIndex
CREATE UNIQUE INDEX "Utilisateur_telephone_key" ON "Utilisateur"("telephone");

-- CreateIndex
CREATE UNIQUE INDEX "Utilisateur_email_key" ON "Utilisateur"("email");

-- CreateIndex
CREATE INDEX "Utilisateur_matricule_idx" ON "Utilisateur"("matricule");

-- CreateIndex
CREATE INDEX "Utilisateur_telephone_idx" ON "Utilisateur"("telephone");

-- CreateIndex
CREATE INDEX "Utilisateur_paroisseId_idx" ON "Utilisateur"("paroisseId");

-- CreateIndex
CREATE INDEX "Utilisateur_role_idx" ON "Utilisateur"("role");

-- CreateIndex
CREATE UNIQUE INDEX "PosteGroupe_utilisateurId_key" ON "PosteGroupe"("utilisateurId");

-- CreateIndex
CREATE INDEX "PosteGroupe_paroisseId_idx" ON "PosteGroupe"("paroisseId");

-- CreateIndex
CREATE INDEX "PosteGroupe_role_idx" ON "PosteGroupe"("role");

-- CreateIndex
CREATE INDEX "PosteBranche_paroisseId_idx" ON "PosteBranche"("paroisseId");

-- CreateIndex
CREATE INDEX "PosteBranche_brancheType_idx" ON "PosteBranche"("brancheType");

-- CreateIndex
CREATE INDEX "PosteBranche_utilisateurId_idx" ON "PosteBranche"("utilisateurId");

-- CreateIndex
CREATE UNIQUE INDEX "Scout_matricule_key" ON "Scout"("matricule");

-- CreateIndex
CREATE UNIQUE INDEX "Scout_utilisateurId_key" ON "Scout"("utilisateurId");

-- CreateIndex
CREATE INDEX "Scout_paroisseId_idx" ON "Scout"("paroisseId");

-- CreateIndex
CREATE INDEX "Scout_brancheType_idx" ON "Scout"("brancheType");

-- CreateIndex
CREATE INDEX "Scout_actif_idx" ON "Scout"("actif");

-- CreateIndex
CREATE INDEX "ContactUrgence_scoutId_idx" ON "ContactUrgence"("scoutId");

-- CreateIndex
CREATE INDEX "LienParentScout_parentId_idx" ON "LienParentScout"("parentId");

-- CreateIndex
CREATE INDEX "LienParentScout_scoutId_idx" ON "LienParentScout"("scoutId");

-- CreateIndex
CREATE UNIQUE INDEX "LienParentScout_parentId_scoutId_key" ON "LienParentScout"("parentId", "scoutId");

-- CreateIndex
CREATE INDEX "Activite_paroisseId_idx" ON "Activite"("paroisseId");

-- CreateIndex
CREATE INDEX "Activite_brancheType_idx" ON "Activite"("brancheType");

-- CreateIndex
CREATE INDEX "Activite_dateDebut_idx" ON "Activite"("dateDebut");

-- CreateIndex
CREATE INDEX "Presence_scoutId_idx" ON "Presence"("scoutId");

-- CreateIndex
CREATE INDEX "Presence_activiteId_idx" ON "Presence"("activiteId");

-- CreateIndex
CREATE UNIQUE INDEX "Presence_scoutId_activiteId_key" ON "Presence"("scoutId", "activiteId");

-- CreateIndex
CREATE INDEX "Badge_brancheType_idx" ON "Badge"("brancheType");

-- CreateIndex
CREATE INDEX "Badge_ordre_idx" ON "Badge"("ordre");

-- CreateIndex
CREATE UNIQUE INDEX "Badge_brancheType_nom_key" ON "Badge"("brancheType", "nom");

-- CreateIndex
CREATE INDEX "ProgressionScout_scoutId_idx" ON "ProgressionScout"("scoutId");

-- CreateIndex
CREATE INDEX "ProgressionScout_badgeId_idx" ON "ProgressionScout"("badgeId");

-- CreateIndex
CREATE UNIQUE INDEX "ProgressionScout_scoutId_badgeId_key" ON "ProgressionScout"("scoutId", "badgeId");

-- CreateIndex
CREATE INDEX "Document_scoutId_idx" ON "Document"("scoutId");

-- CreateIndex
CREATE INDEX "Document_type_idx" ON "Document"("type");

-- CreateIndex
CREATE INDEX "Document_valide_idx" ON "Document"("valide");

-- CreateIndex
CREATE INDEX "JourReunion_paroisseId_idx" ON "JourReunion"("paroisseId");

-- CreateIndex
CREATE INDEX "JourReunion_brancheType_idx" ON "JourReunion"("brancheType");

-- CreateIndex
CREATE INDEX "JourReunion_dateHeure_idx" ON "JourReunion"("dateHeure");

-- CreateIndex
CREATE INDEX "JourReunion_statut_idx" ON "JourReunion"("statut");

-- CreateIndex
CREATE INDEX "PresenceReunion_jourReunionId_idx" ON "PresenceReunion"("jourReunionId");

-- CreateIndex
CREATE INDEX "PresenceReunion_scoutId_idx" ON "PresenceReunion"("scoutId");

-- CreateIndex
CREATE UNIQUE INDEX "PresenceReunion_jourReunionId_scoutId_key" ON "PresenceReunion"("jourReunionId", "scoutId");

-- CreateIndex
CREATE UNIQUE INDEX "TokenReinitialisation_token_key" ON "TokenReinitialisation"("token");

-- CreateIndex
CREATE INDEX "TokenReinitialisation_token_idx" ON "TokenReinitialisation"("token");

-- CreateIndex
CREATE INDEX "TokenReinitialisation_utilisateurId_idx" ON "TokenReinitialisation"("utilisateurId");

-- CreateIndex
CREATE INDEX "ConfigReunionBranche_paroisseId_idx" ON "ConfigReunionBranche"("paroisseId");

-- CreateIndex
CREATE UNIQUE INDEX "ConfigReunionBranche_paroisseId_brancheType_key" ON "ConfigReunionBranche"("paroisseId", "brancheType");

-- CreateIndex
CREATE INDEX "Programme_paroisseId_idx" ON "Programme"("paroisseId");

-- CreateIndex
CREATE INDEX "Programme_brancheType_idx" ON "Programme"("brancheType");

-- CreateIndex
CREATE INDEX "Programme_periodeDebut_idx" ON "Programme"("periodeDebut");

-- CreateIndex
CREATE UNIQUE INDEX "LigneProgramme_activiteId_key" ON "LigneProgramme"("activiteId");

-- CreateIndex
CREATE INDEX "LigneProgramme_programmeId_idx" ON "LigneProgramme"("programmeId");

-- CreateIndex
CREATE INDEX "AutorisationCamp_activiteId_idx" ON "AutorisationCamp"("activiteId");

-- CreateIndex
CREATE INDEX "AutorisationCamp_scoutId_idx" ON "AutorisationCamp"("scoutId");

-- CreateIndex
CREATE UNIQUE INDEX "AutorisationCamp_activiteId_scoutId_type_key" ON "AutorisationCamp"("activiteId", "scoutId", "type");

-- AddForeignKey
ALTER TABLE "Utilisateur" ADD CONSTRAINT "Utilisateur_paroisseId_fkey" FOREIGN KEY ("paroisseId") REFERENCES "Paroisse"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PosteGroupe" ADD CONSTRAINT "PosteGroupe_utilisateurId_fkey" FOREIGN KEY ("utilisateurId") REFERENCES "Utilisateur"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PosteGroupe" ADD CONSTRAINT "PosteGroupe_paroisseId_fkey" FOREIGN KEY ("paroisseId") REFERENCES "Paroisse"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PosteBranche" ADD CONSTRAINT "PosteBranche_utilisateurId_fkey" FOREIGN KEY ("utilisateurId") REFERENCES "Utilisateur"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PosteBranche" ADD CONSTRAINT "PosteBranche_paroisseId_fkey" FOREIGN KEY ("paroisseId") REFERENCES "Paroisse"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Scout" ADD CONSTRAINT "Scout_paroisseId_fkey" FOREIGN KEY ("paroisseId") REFERENCES "Paroisse"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Scout" ADD CONSTRAINT "Scout_utilisateurId_fkey" FOREIGN KEY ("utilisateurId") REFERENCES "Utilisateur"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContactUrgence" ADD CONSTRAINT "ContactUrgence_scoutId_fkey" FOREIGN KEY ("scoutId") REFERENCES "Scout"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContactUrgence" ADD CONSTRAINT "ContactUrgence_utilisateurId_fkey" FOREIGN KEY ("utilisateurId") REFERENCES "Utilisateur"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LienParentScout" ADD CONSTRAINT "LienParentScout_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Utilisateur"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LienParentScout" ADD CONSTRAINT "LienParentScout_scoutId_fkey" FOREIGN KEY ("scoutId") REFERENCES "Scout"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Activite" ADD CONSTRAINT "Activite_paroisseId_fkey" FOREIGN KEY ("paroisseId") REFERENCES "Paroisse"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Activite" ADD CONSTRAINT "Activite_creePar_fkey" FOREIGN KEY ("creePar") REFERENCES "Utilisateur"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Presence" ADD CONSTRAINT "Presence_scoutId_fkey" FOREIGN KEY ("scoutId") REFERENCES "Scout"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Presence" ADD CONSTRAINT "Presence_activiteId_fkey" FOREIGN KEY ("activiteId") REFERENCES "Activite"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProgressionScout" ADD CONSTRAINT "ProgressionScout_scoutId_fkey" FOREIGN KEY ("scoutId") REFERENCES "Scout"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProgressionScout" ADD CONSTRAINT "ProgressionScout_badgeId_fkey" FOREIGN KEY ("badgeId") REFERENCES "Badge"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProgressionScout" ADD CONSTRAINT "ProgressionScout_valideParId_fkey" FOREIGN KEY ("valideParId") REFERENCES "Utilisateur"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_scoutId_fkey" FOREIGN KEY ("scoutId") REFERENCES "Scout"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JourReunion" ADD CONSTRAINT "JourReunion_paroisseId_fkey" FOREIGN KEY ("paroisseId") REFERENCES "Paroisse"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JourReunion" ADD CONSTRAINT "JourReunion_creePar_fkey" FOREIGN KEY ("creePar") REFERENCES "Utilisateur"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PresenceReunion" ADD CONSTRAINT "PresenceReunion_jourReunionId_fkey" FOREIGN KEY ("jourReunionId") REFERENCES "JourReunion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PresenceReunion" ADD CONSTRAINT "PresenceReunion_scoutId_fkey" FOREIGN KEY ("scoutId") REFERENCES "Scout"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PresenceReunion" ADD CONSTRAINT "PresenceReunion_marqueParId_fkey" FOREIGN KEY ("marqueParId") REFERENCES "Utilisateur"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TokenReinitialisation" ADD CONSTRAINT "TokenReinitialisation_utilisateurId_fkey" FOREIGN KEY ("utilisateurId") REFERENCES "Utilisateur"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConfigReunionBranche" ADD CONSTRAINT "ConfigReunionBranche_paroisseId_fkey" FOREIGN KEY ("paroisseId") REFERENCES "Paroisse"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Programme" ADD CONSTRAINT "Programme_paroisseId_fkey" FOREIGN KEY ("paroisseId") REFERENCES "Paroisse"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Programme" ADD CONSTRAINT "Programme_creePar_fkey" FOREIGN KEY ("creePar") REFERENCES "Utilisateur"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LigneProgramme" ADD CONSTRAINT "LigneProgramme_programmeId_fkey" FOREIGN KEY ("programmeId") REFERENCES "Programme"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LigneProgramme" ADD CONSTRAINT "LigneProgramme_activiteId_fkey" FOREIGN KEY ("activiteId") REFERENCES "Activite"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AutorisationCamp" ADD CONSTRAINT "AutorisationCamp_activiteId_fkey" FOREIGN KEY ("activiteId") REFERENCES "Activite"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AutorisationCamp" ADD CONSTRAINT "AutorisationCamp_scoutId_fkey" FOREIGN KEY ("scoutId") REFERENCES "Scout"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AutorisationCamp" ADD CONSTRAINT "AutorisationCamp_confirmeParId_fkey" FOREIGN KEY ("confirmeParId") REFERENCES "Utilisateur"("id") ON DELETE SET NULL ON UPDATE CASCADE;

