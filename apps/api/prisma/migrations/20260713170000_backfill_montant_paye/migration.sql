-- Backfill : les cotisations déjà marquées PAYEE avant l'introduction du
-- champ montantPaye (migration précédente, valeur par défaut 0) doivent
-- refléter qu'elles sont payées intégralement, sinon "Montant perçu"
-- retomberait à 0 pour tout l'historique déjà réglé.
UPDATE "Cotisation" SET "montantPaye" = "montant" WHERE "statut" = 'PAYEE' AND "montantPaye" = 0;
