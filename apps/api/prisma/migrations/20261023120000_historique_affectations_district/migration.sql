-- Migration additive : aucune projection existante n'est effacée.
CREATE TABLE "AffectationDistrict" (
  "id" TEXT NOT NULL,
  "utilisateurId" TEXT NOT NULL,
  "districtId" TEXT NOT NULL,
  "role" "RoleUtilisateur" NOT NULL,
  "fonction" TEXT,
  "brancheType" "BrancheType",
  "debutLe" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "finLe" TIMESTAMP(3),
  "auteurId" TEXT,
  "motif" TEXT,
  "revoqueParId" TEXT,
  "motifRevocation" TEXT,
  "reprise" BOOLEAN NOT NULL DEFAULT false,
  CONSTRAINT "AffectationDistrict_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "AffectationDistrict_utilisateurId_fkey" FOREIGN KEY ("utilisateurId") REFERENCES "Utilisateur"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "AffectationDistrict_districtId_fkey" FOREIGN KEY ("districtId") REFERENCES "District"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "AffectationDistrict_role_check" CHECK ("role" IN ('COMMISSAIRE_DISTRICT', 'ADJOINT_DISTRICT', 'ASSISTANT_DISTRICT')),
  CONSTRAINT "AffectationDistrict_dates_check" CHECK ("finLe" IS NULL OR "finLe" >= "debutLe")
);
CREATE INDEX "AffectationDistrict_districtId_debutLe_idx" ON "AffectationDistrict"("districtId", "debutLe");
CREATE INDEX "AffectationDistrict_utilisateurId_debutLe_idx" ON "AffectationDistrict"("utilisateurId", "debutLe");
CREATE UNIQUE INDEX "AffectationDistrict_active_utilisateur_key" ON "AffectationDistrict"("utilisateurId") WHERE "finLe" IS NULL;

-- La date historique et l'auteur ne sont pas récupérables depuis la projection.
-- La reprise marque une date d'observation, sans inventer un début de mandat.
INSERT INTO "AffectationDistrict" ("id", "utilisateurId", "districtId", "role", "fonction", "brancheType", "reprise", "motif")
SELECT 'reprise-' || u."id", u."id", p."districtId", u."roleDistrict", u."fonctionDistrict", u."brancheTypeDistrict", true,
       'Reprise de la projection existante ; début réel et auteur inconnus'
FROM "Utilisateur" u JOIN "Paroisse" p ON p."id" = u."paroisseId"
WHERE u."roleDistrict" IS NOT NULL;
