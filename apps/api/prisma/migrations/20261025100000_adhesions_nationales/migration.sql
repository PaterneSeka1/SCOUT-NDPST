BEGIN;
-- CreateEnum
CREATE TYPE "CategorieAdhesion" AS ENUM ('SCOUT', 'CHEF');

-- CreateEnum
CREATE TYPE "PermissionAdhesion" AS ENUM ('LIRE', 'CREER', 'ENCAISSER', 'REVERSER', 'CONFIRMER', 'CORRIGER', 'BAREMES');

-- CreateEnum
CREATE TYPE "StatutLotNational" AS ENUM ('PREPARE', 'DECLARE', 'PARTIELLEMENT_CONFIRME', 'CONFIRME', 'ANOMALIE', 'ANNULE');

-- CreateTable
CREATE TABLE "PersonneAdhesion" (
    "id" TEXT NOT NULL,
    "scoutId" TEXT,
    "utilisateurId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PersonneAdhesion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HabilitationAdhesion" (
    "id" TEXT NOT NULL,
    "utilisateurId" TEXT NOT NULL,
    "permission" "PermissionAdhesion" NOT NULL,
    "brancheType" "BrancheType",
    "auteurId" TEXT NOT NULL,
    "motif" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revoqueeLe" TIMESTAMP(3),

    CONSTRAINT "HabilitationAdhesion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BaremeAdhesion" (
    "id" TEXT NOT NULL,
    "annee" TEXT NOT NULL,
    "categorie" "CategorieAdhesion" NOT NULL,
    "brancheType" "BrancheType",
    "montant" INTEGER NOT NULL,
    "libelle" TEXT NOT NULL,
    "debutValidite" TIMESTAMP(3) NOT NULL,
    "finValidite" TIMESTAMP(3),
    "actif" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BaremeAdhesion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdhesionAnnuelle" (
    "id" TEXT NOT NULL,
    "annee" TEXT NOT NULL,
    "personneId" TEXT NOT NULL,
    "categorie" "CategorieAdhesion" NOT NULL,
    "brancheType" "BrancheType",
    "baremeId" TEXT,
    "montantDu" INTEGER NOT NULL,
    "montantEncaisse" INTEGER NOT NULL DEFAULT 0,
    "aVerifier" BOOLEAN NOT NULL DEFAULT false,
    "motifVerification" TEXT,
    "exoneree" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AdhesionAnnuelle_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EncaissementAdhesion" (
    "id" TEXT NOT NULL,
    "adhesionId" TEXT NOT NULL,
    "montant" INTEGER NOT NULL,
    "mode" TEXT NOT NULL,
    "encaisseLe" TIMESTAMP(3),
    "acteurId" TEXT NOT NULL,
    "reference" TEXT,
    "note" TEXT,
    "idempotence" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EncaissementAdhesion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AnnulationEncaissement" (
    "id" TEXT NOT NULL,
    "encaissementId" TEXT NOT NULL,
    "acteurId" TEXT NOT NULL,
    "motif" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AnnulationEncaissement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LotReversementNational" (
    "id" TEXT NOT NULL,
    "annee" TEXT NOT NULL,
    "statut" "StatutLotNational" NOT NULL DEFAULT 'PREPARE',
    "montantTotal" INTEGER NOT NULL,
    "responsableId" TEXT NOT NULL,
    "verseLe" TIMESTAMP(3),
    "reference" TEXT,
    "justification" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LotReversementNational_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LigneReversementNational" (
    "id" TEXT NOT NULL,
    "lotId" TEXT NOT NULL,
    "adhesionId" TEXT NOT NULL,
    "montant" INTEGER NOT NULL,
    "engagee" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "LigneReversementNational_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConfirmationNationale" (
    "id" TEXT NOT NULL,
    "adhesionId" TEXT NOT NULL,
    "ligneId" TEXT NOT NULL,
    "acteurId" TEXT NOT NULL,
    "reference" TEXT,
    "commentaire" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ConfirmationNationale_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CorrectionConfirmation" (
    "id" TEXT NOT NULL,
    "confirmationId" TEXT NOT NULL,
    "acteurId" TEXT NOT NULL,
    "motif" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CorrectionConfirmation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RepriseCotisation" (
    "id" TEXT NOT NULL,
    "cotisationId" TEXT NOT NULL,
    "adhesionId" TEXT NOT NULL,
    "montantDu" INTEGER NOT NULL,
    "montantPaye" INTEGER NOT NULL,
    "statutSource" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RepriseCotisation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PersonneAdhesion_scoutId_key" ON "PersonneAdhesion"("scoutId");

-- CreateIndex
CREATE UNIQUE INDEX "PersonneAdhesion_utilisateurId_key" ON "PersonneAdhesion"("utilisateurId");

-- CreateIndex
CREATE INDEX "HabilitationAdhesion_utilisateurId_permission_revoqueeLe_idx" ON "HabilitationAdhesion"("utilisateurId", "permission", "revoqueeLe");

-- CreateIndex
CREATE INDEX "BaremeAdhesion_annee_categorie_actif_idx" ON "BaremeAdhesion"("annee", "categorie", "actif");

-- CreateIndex
CREATE INDEX "AdhesionAnnuelle_annee_brancheType_categorie_idx" ON "AdhesionAnnuelle"("annee", "brancheType", "categorie");

-- CreateIndex
CREATE UNIQUE INDEX "AdhesionAnnuelle_personneId_annee_key" ON "AdhesionAnnuelle"("personneId", "annee");

-- CreateIndex
CREATE UNIQUE INDEX "EncaissementAdhesion_idempotence_key" ON "EncaissementAdhesion"("idempotence");

-- CreateIndex
CREATE INDEX "EncaissementAdhesion_adhesionId_encaisseLe_idx" ON "EncaissementAdhesion"("adhesionId", "encaisseLe");

-- CreateIndex
CREATE UNIQUE INDEX "AnnulationEncaissement_encaissementId_key" ON "AnnulationEncaissement"("encaissementId");

-- CreateIndex
CREATE INDEX "LotReversementNational_annee_statut_idx" ON "LotReversementNational"("annee", "statut");

-- CreateIndex
CREATE INDEX "LigneReversementNational_adhesionId_idx" ON "LigneReversementNational"("adhesionId");

-- CreateIndex
CREATE UNIQUE INDEX "LigneReversementNational_lotId_adhesionId_key" ON "LigneReversementNational"("lotId", "adhesionId");

-- CreateIndex
CREATE INDEX "ConfirmationNationale_adhesionId_idx" ON "ConfirmationNationale"("adhesionId");

-- CreateIndex
CREATE UNIQUE INDEX "CorrectionConfirmation_confirmationId_key" ON "CorrectionConfirmation"("confirmationId");

-- CreateIndex
CREATE UNIQUE INDEX "RepriseCotisation_cotisationId_key" ON "RepriseCotisation"("cotisationId");

-- AddForeignKey
ALTER TABLE "PersonneAdhesion" ADD CONSTRAINT "PersonneAdhesion_scoutId_fkey" FOREIGN KEY ("scoutId") REFERENCES "Scout"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PersonneAdhesion" ADD CONSTRAINT "PersonneAdhesion_utilisateurId_fkey" FOREIGN KEY ("utilisateurId") REFERENCES "Utilisateur"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HabilitationAdhesion" ADD CONSTRAINT "HabilitationAdhesion_utilisateurId_fkey" FOREIGN KEY ("utilisateurId") REFERENCES "Utilisateur"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdhesionAnnuelle" ADD CONSTRAINT "AdhesionAnnuelle_personneId_fkey" FOREIGN KEY ("personneId") REFERENCES "PersonneAdhesion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdhesionAnnuelle" ADD CONSTRAINT "AdhesionAnnuelle_baremeId_fkey" FOREIGN KEY ("baremeId") REFERENCES "BaremeAdhesion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EncaissementAdhesion" ADD CONSTRAINT "EncaissementAdhesion_adhesionId_fkey" FOREIGN KEY ("adhesionId") REFERENCES "AdhesionAnnuelle"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EncaissementAdhesion" ADD CONSTRAINT "EncaissementAdhesion_acteurId_fkey" FOREIGN KEY ("acteurId") REFERENCES "Utilisateur"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnnulationEncaissement" ADD CONSTRAINT "AnnulationEncaissement_encaissementId_fkey" FOREIGN KEY ("encaissementId") REFERENCES "EncaissementAdhesion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LotReversementNational" ADD CONSTRAINT "LotReversementNational_responsableId_fkey" FOREIGN KEY ("responsableId") REFERENCES "Utilisateur"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LigneReversementNational" ADD CONSTRAINT "LigneReversementNational_lotId_fkey" FOREIGN KEY ("lotId") REFERENCES "LotReversementNational"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LigneReversementNational" ADD CONSTRAINT "LigneReversementNational_adhesionId_fkey" FOREIGN KEY ("adhesionId") REFERENCES "AdhesionAnnuelle"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConfirmationNationale" ADD CONSTRAINT "ConfirmationNationale_adhesionId_fkey" FOREIGN KEY ("adhesionId") REFERENCES "AdhesionAnnuelle"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConfirmationNationale" ADD CONSTRAINT "ConfirmationNationale_ligneId_fkey" FOREIGN KEY ("ligneId") REFERENCES "LigneReversementNational"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConfirmationNationale" ADD CONSTRAINT "ConfirmationNationale_acteurId_fkey" FOREIGN KEY ("acteurId") REFERENCES "Utilisateur"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CorrectionConfirmation" ADD CONSTRAINT "CorrectionConfirmation_confirmationId_fkey" FOREIGN KEY ("confirmationId") REFERENCES "ConfirmationNationale"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RepriseCotisation" ADD CONSTRAINT "RepriseCotisation_adhesionId_fkey" FOREIGN KEY ("adhesionId") REFERENCES "AdhesionAnnuelle"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Invariants financiers non exprimables dans le DSL Prisma.
ALTER TABLE "PersonneAdhesion" ADD CONSTRAINT "PersonneAdhesion_cible_check" CHECK ("scoutId" IS NOT NULL OR "utilisateurId" IS NOT NULL);
ALTER TABLE "BaremeAdhesion" ADD CONSTRAINT "BaremeAdhesion_montant_check" CHECK ("montant" > 0), ADD CONSTRAINT "BaremeAdhesion_dates_check" CHECK ("finValidite" IS NULL OR "finValidite" > "debutValidite");
ALTER TABLE "AdhesionAnnuelle" ADD CONSTRAINT "AdhesionAnnuelle_solde_check" CHECK ("montantDu" >= 0 AND "montantEncaisse" >= 0 AND "montantEncaisse" <= "montantDu");
ALTER TABLE "EncaissementAdhesion" ADD CONSTRAINT "EncaissementAdhesion_montant_check" CHECK ("montant" > 0);
ALTER TABLE "LigneReversementNational" ADD CONSTRAINT "LigneReversementNational_montant_check" CHECK ("montant" > 0);
ALTER TABLE "LotReversementNational" ADD CONSTRAINT "LotReversementNational_montant_check" CHECK ("montantTotal" > 0), ADD CONSTRAINT "LotReversementNational_declaration_check" CHECK ("statut" IN ('PREPARE','ANNULE') OR "verseLe" IS NOT NULL);
CREATE UNIQUE INDEX "LigneReversementNational_engagee_key" ON "LigneReversementNational"("adhesionId") WHERE "engagee" = true;
CREATE UNIQUE INDEX "HabilitationAdhesion_globale_active_key" ON "HabilitationAdhesion"("utilisateurId", "permission") WHERE "revoqueeLe" IS NULL AND "brancheType" IS NULL;
CREATE UNIQUE INDEX "HabilitationAdhesion_branche_active_key" ON "HabilitationAdhesion"("utilisateurId", "permission", "brancheType") WHERE "revoqueeLe" IS NULL AND "brancheType" IS NOT NULL;
-- Les journaux et écritures comptables sont append-only. Les corrections
-- sont de nouvelles lignes, jamais des UPDATE/DELETE d'encaissements.
CREATE FUNCTION refuser_mutation_ecriture_adhesion() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'Ecriture financiere immuable : utiliser une correction tracee'; END;
$$;
CREATE TRIGGER "EncaissementAdhesion_immuable" BEFORE UPDATE OR DELETE ON "EncaissementAdhesion" FOR EACH ROW EXECUTE FUNCTION refuser_mutation_ecriture_adhesion();
CREATE TRIGGER "AnnulationEncaissement_immuable" BEFORE UPDATE OR DELETE ON "AnnulationEncaissement" FOR EACH ROW EXECUTE FUNCTION refuser_mutation_ecriture_adhesion();
CREATE TRIGGER "ConfirmationNationale_immuable" BEFORE UPDATE OR DELETE ON "ConfirmationNationale" FOR EACH ROW EXECUTE FUNCTION refuser_mutation_ecriture_adhesion();
CREATE TRIGGER "CorrectionConfirmation_immuable" BEFORE UPDATE OR DELETE ON "CorrectionConfirmation" FOR EACH ROW EXECUTE FUNCTION refuser_mutation_ecriture_adhesion();
CREATE TRIGGER "RepriseCotisation_immuable" BEFORE UPDATE OR DELETE ON "RepriseCotisation" FOR EACH ROW EXECUTE FUNCTION refuser_mutation_ecriture_adhesion();
COMMIT;
