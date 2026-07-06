-- AlterTable
ALTER TABLE "Scout" ADD COLUMN     "consentementImage" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "consentementImageDate" TIMESTAMP(3),
ADD COLUMN     "consentementImageParId" TEXT;

-- AddForeignKey
ALTER TABLE "Scout" ADD CONSTRAINT "Scout_consentementImageParId_fkey" FOREIGN KEY ("consentementImageParId") REFERENCES "Utilisateur"("id") ON DELETE SET NULL ON UPDATE CASCADE;
