BEGIN;
ALTER TABLE "RepriseCotisation" ADD CONSTRAINT "RepriseCotisation_cotisationId_fkey" FOREIGN KEY ("cotisationId") REFERENCES "Cotisation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE TRIGGER "JournalAudit_financier_immuable" BEFORE UPDATE OR DELETE ON "JournalAudit" FOR EACH ROW WHEN (OLD."entite" = 'AdhesionNationale') EXECUTE FUNCTION refuser_mutation_ecriture_adhesion();
COMMIT;
