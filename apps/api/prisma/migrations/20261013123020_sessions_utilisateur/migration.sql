-- CreateTable
CREATE TABLE "SessionUtilisateur" (
    "id" TEXT NOT NULL,
    "empreinteJeton" TEXT NOT NULL,
    "ancienneEmpreinte" TEXT,
    "ancienneValideJusqua" TIMESTAMP(3),
    "expireLe" TIMESTAMP(3) NOT NULL,
    "revoqueeLe" TIMESTAMP(3),
    "agentUtilisateur" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "utilisateurId" TEXT NOT NULL,

    CONSTRAINT "SessionUtilisateur_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SessionUtilisateur_empreinteJeton_key" ON "SessionUtilisateur"("empreinteJeton");

-- CreateIndex
CREATE UNIQUE INDEX "SessionUtilisateur_ancienneEmpreinte_key" ON "SessionUtilisateur"("ancienneEmpreinte");

-- CreateIndex
CREATE INDEX "SessionUtilisateur_utilisateurId_idx" ON "SessionUtilisateur"("utilisateurId");

-- CreateIndex
CREATE INDEX "SessionUtilisateur_expireLe_idx" ON "SessionUtilisateur"("expireLe");

-- AddForeignKey
ALTER TABLE "SessionUtilisateur" ADD CONSTRAINT "SessionUtilisateur_utilisateurId_fkey" FOREIGN KEY ("utilisateurId") REFERENCES "Utilisateur"("id") ON DELETE CASCADE ON UPDATE CASCADE;
