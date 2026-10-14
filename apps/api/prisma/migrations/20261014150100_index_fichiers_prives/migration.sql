-- Contrôle d'accès aux fichiers privés : chaque lecture retrouve le scout
-- auquel le fichier est rattaché (photo, document, autorisation de camp).
-- CreateIndex
CREATE INDEX "Scout_photo_idx" ON "Scout"("photo");

-- CreateIndex
CREATE INDEX "Document_url_idx" ON "Document"("url");

-- CreateIndex
CREATE INDEX "AutorisationCamp_documentUrl_idx" ON "AutorisationCamp"("documentUrl");
