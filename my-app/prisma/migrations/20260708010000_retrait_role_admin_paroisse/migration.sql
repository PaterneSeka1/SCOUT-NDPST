-- Retrait du rôle hérité ADMIN_PAROISSE (déprécié depuis l'introduction du
-- rôle global ADMIN_PLATEFORME — voir migration "multi_paroisse_fondations").
--
-- ATTENTION — À appliquer UNIQUEMENT après avoir exécuté
-- prisma/migrate-admin-plateforme.ts en production (qui convertit le compte
-- ADMIN_PAROISSE existant en ADMIN_PLATEFORME). Si une ligne "Utilisateur"
-- porte encore le rôle ADMIN_PAROISSE au moment de cette migration, le
-- ALTER COLUMN ci-dessous échoue (garde-fou volontaire, pas de perte de
-- données silencieuse).

BEGIN;

-- La contrainte référence "role" avec un littéral typé sur l'ancien enum ;
-- elle doit être retirée avant le changement de type de colonne, sans quoi
-- Postgres échoue à comparer le nouveau type de colonne à un littéral de
-- l'ancien type ("operator does not exist: RoleUtilisateur_new = RoleUtilisateur").
ALTER TABLE "Utilisateur" DROP CONSTRAINT "chk_utilisateur_paroisse_coherente";

CREATE TYPE "RoleUtilisateur_new" AS ENUM (
  'ADMIN_PLATEFORME',
  'CHEF_GROUPE',
  'ADJOINT_GROUPE',
  'ASSISTANT_GROUPE',
  'RESPONSABLE_BRANCHE',
  'ADJOINT_BRANCHE',
  'ASSISTANT_BRANCHE',
  'PARENT',
  'SCOUT'
);

ALTER TABLE "Utilisateur" ALTER COLUMN "role" TYPE "RoleUtilisateur_new" USING ("role"::text::"RoleUtilisateur_new");

ALTER TYPE "RoleUtilisateur" RENAME TO "RoleUtilisateur_old";
ALTER TYPE "RoleUtilisateur_new" RENAME TO "RoleUtilisateur";
DROP TYPE "RoleUtilisateur_old";

ALTER TABLE "Utilisateur" ADD CONSTRAINT "chk_utilisateur_paroisse_coherente"
  CHECK (
    (role = 'ADMIN_PLATEFORME' AND "paroisseId" IS NULL)
    OR (role <> 'ADMIN_PLATEFORME' AND "paroisseId" IS NOT NULL)
  );

COMMIT;
