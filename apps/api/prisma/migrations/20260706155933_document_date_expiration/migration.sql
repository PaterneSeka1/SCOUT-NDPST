-- AlterTable
ALTER TABLE "Document" ADD COLUMN     "dateExpiration" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "Document_dateExpiration_idx" ON "Document"("dateExpiration");
