-- Additif : les comptes existants conservent leur accès. Seuls les comptes
-- nouvellement créés/réinitialisés par un responsable seront en activation.
ALTER TABLE "Utilisateur" ADD COLUMN "doitChangerMotDePasse" BOOLEAN NOT NULL DEFAULT false;
