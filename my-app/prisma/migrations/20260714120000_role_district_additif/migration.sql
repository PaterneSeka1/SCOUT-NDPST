-- AlterTable
ALTER TABLE "Utilisateur" ADD COLUMN     "brancheTypeDistrict" "BrancheType",
ADD COLUMN     "fonctionDistrict" TEXT,
ADD COLUMN     "roleDistrict" "RoleUtilisateur";

-- CreateIndex
CREATE INDEX "Utilisateur_roleDistrict_idx" ON "Utilisateur"("roleDistrict");

-- L'affectation district devient additive au rôle paroissial (`role`) plutôt
-- que de le remplacer : un Chef de Groupe désigné Commissaire de District doit
-- rester Chef de Groupe de sa paroisse. Les comptes déjà affectés à un rôle de
-- district sous l'ancien modèle (role = COMMISSAIRE_DISTRICT/ADJOINT_DISTRICT/
-- ASSISTANT_DISTRICT) ont vu leur rôle paroissial d'origine écrasé à l'époque
-- et il n'est pas récupérable : on bascule leur affectation district dans les
-- nouvelles colonnes, puis on leur attribue ASSISTANT_GROUPE comme rôle
-- paroissial de repli (le seul rôle sans contrainte d'unicité active par
-- paroisse : CHEF_GROUPE et RESPONSABLE_BRANCHE en ont une, ce qui pourrait
-- entrer en conflit avec le titulaire déjà en poste dans leur paroisse
-- d'ancrage). Un administrateur devra leur assigner un rôle paroissial plus
-- approprié si besoin, au cas par cas.
UPDATE "Utilisateur"
SET "roleDistrict" = "role",
    "fonctionDistrict" = "fonction",
    "brancheTypeDistrict" = "brancheType",
    "role" = 'ASSISTANT_GROUPE',
    "fonction" = NULL,
    "brancheType" = NULL
WHERE "role" IN ('COMMISSAIRE_DISTRICT', 'ADJOINT_DISTRICT', 'ASSISTANT_DISTRICT');
