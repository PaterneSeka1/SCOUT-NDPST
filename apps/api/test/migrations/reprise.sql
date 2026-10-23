-- Uniquement sur une base locale, vide et explicitement temporaire.
-- Exécution recommandée : bash apps/api/test/migrations/reprise.sh
-- Les données de ce scénario sont entièrement synthétiques.
\set ON_ERROR_STOP on
DO $$ BEGIN
  IF current_database() <> 'ci_reprise' AND current_database() !~ '^scout_test_reprise_[a-z0-9_]+$' THEN
    RAISE EXCEPTION 'Base temporaire ci_reprise ou scout_test_reprise_* requise';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE') THEN
    RAISE EXCEPTION 'Base vide requise : aucune table existante ne sera modifiee';
  END IF;
END $$;

-- Reconstruction de la version précédant l'historisation, à partir des
-- migrations réelles. Ne pas englober dans BEGIN : les valeurs enum doivent
-- être validées avant d'être utilisées par les migrations suivantes.
\ir ../../prisma/migrations/20260706142635_init/migration.sql
\ir ../../prisma/migrations/20260706155933_document_date_expiration/migration.sql
\ir ../../prisma/migrations/20260706161732_scout_infos_sante/migration.sql
\ir ../../prisma/migrations/20260706163044_scout_consentement_image/migration.sql
\ir ../../prisma/migrations/20260706170000_calendrier_token/migration.sql
\ir ../../prisma/migrations/20260706171500_journal_audit/migration.sql
\ir ../../prisma/migrations/20260706173000_cotisations/migration.sql
\ir ../../prisma/migrations/20260708000458_multi_paroisse_fondations/migration.sql
\ir ../../prisma/migrations/20260708010000_retrait_role_admin_paroisse/migration.sql
\ir ../../prisma/migrations/20260709100000_branche_ressources_adultes/migration.sql
\ir ../../prisma/migrations/20260709120000_role_commissaire_district/migration.sql
\ir ../../prisma/migrations/20260709130000_district_branche_type/migration.sql
\ir ../../prisma/migrations/20260709140000_district_obligatoire/migration.sql
\ir ../../prisma/migrations/20260713150000_fixes_pre_production/migration.sql
\ir ../../prisma/migrations/20260713170000_backfill_montant_paye/migration.sql
\ir ../../prisma/migrations/20260713180000_district_entite/migration.sql
\ir ../../prisma/migrations/20260714120000_role_district_additif/migration.sql
\ir ../../prisma/migrations/20261013123020_sessions_utilisateur/migration.sql
\ir ../../prisma/migrations/20261014150000_jetons_reinitialisation_haches/migration.sql
\ir ../../prisma/migrations/20261014150100_index_fichiers_prives/migration.sql
\ir ../../prisma/migrations/20261014150200_rappel_documents/migration.sql
\ir ../../prisma/migrations/20261014160000_consentement_sante_conservation/migration.sql
\ir ../../prisma/migrations/20261023090000_activation_mot_de_passe/migration.sql

-- Affectations existantes avant migration.
INSERT INTO "District" ("id", "nom", "updatedAt") VALUES ('test-district', 'District reprise test', NOW());
INSERT INTO "Paroisse" ("id", "nom", "ville", "diocese", "districtId", "updatedAt") VALUES ('test-paroisse', 'Paroisse test', 'Ville test', 'Diocese test', 'test-district', NOW());
INSERT INTO "Utilisateur" ("id", "nom", "prenom", "password", "role", "paroisseId", "roleDistrict", "fonctionDistrict", "brancheTypeDistrict", "updatedAt") VALUES
('test-commissaire', 'Test', 'Commissaire', 'hash-synthetique', 'ASSISTANT_GROUPE', 'test-paroisse', 'COMMISSAIRE_DISTRICT', NULL, NULL, NOW()),
('test-assistant', 'Test', 'Assistant', 'hash-synthetique', 'ASSISTANT_GROUPE', 'test-paroisse', 'ASSISTANT_DISTRICT', NULL, 'LOUVETEAUX', NOW()),
('test-sans-mandat', 'Test', 'Sans mandat', 'hash-synthetique', 'ASSISTANT_GROUPE', 'test-paroisse', NULL, NULL, NULL, NOW());

-- Migration sous test (aucune duplication de son SQL).
\ir ../../prisma/migrations/20261023120000_historique_affectations_district/migration.sql

DO $$ BEGIN
 IF (SELECT COUNT(*) FROM "AffectationDistrict") <> 2 THEN RAISE EXCEPTION 'Reprise incomplete'; END IF;
 IF EXISTS (SELECT 1 FROM "AffectationDistrict" WHERE NOT "reprise" OR "auteurId" IS NOT NULL OR "finLe" IS NOT NULL) THEN RAISE EXCEPTION 'Metadonnees reprise incorrectes'; END IF;
 IF (SELECT "brancheType" FROM "AffectationDistrict" WHERE "utilisateurId"='test-assistant') <> 'LOUVETEAUX' THEN RAISE EXCEPTION 'Branche perdue'; END IF;
 IF (SELECT "roleDistrict" FROM "Utilisateur" WHERE "id"='test-commissaire') <> 'COMMISSAIRE_DISTRICT' THEN RAISE EXCEPTION 'Projection perdue'; END IF;
 IF (SELECT COUNT(*) FROM "Utilisateur") <> 3 THEN RAISE EXCEPTION 'Compte perdu'; END IF;
 RAISE NOTICE 'OK reprise et projection conservees';
END $$;
DO $$ BEGIN
 BEGIN
 INSERT INTO "AffectationDistrict" ("id","utilisateurId","districtId","role") VALUES ('doublon','test-commissaire','test-district','COMMISSAIRE_DISTRICT');
 RAISE EXCEPTION 'Doublon de mandat actif accepte';
 EXCEPTION WHEN unique_violation THEN RAISE NOTICE 'OK unicite mandat actif'; END;
 BEGIN
 INSERT INTO "AffectationDistrict" ("id","utilisateurId","districtId","role") VALUES ('mauvais-role','test-sans-mandat','test-district','CHEF_GROUPE');
 RAISE EXCEPTION 'Role invalide accepte';
 EXCEPTION WHEN check_violation THEN RAISE NOTICE 'OK role district exclusivement'; END;
 BEGIN
 INSERT INTO "AffectationDistrict" ("id","utilisateurId","districtId","role","debutLe","finLe") VALUES ('mauvaises-dates','test-sans-mandat','test-district','ADJOINT_DISTRICT',NOW(),NOW()-INTERVAL '1 day');
 RAISE EXCEPTION 'Dates invalides acceptees';
 EXCEPTION WHEN check_violation THEN RAISE NOTICE 'OK ordre chronologique'; END;
 BEGIN
 DELETE FROM "Utilisateur" WHERE "id"='test-commissaire';
 RAISE EXCEPTION 'Responsable historique supprime';
 EXCEPTION WHEN foreign_key_violation THEN RAISE NOTICE 'OK conservation responsable'; END;
END $$;
