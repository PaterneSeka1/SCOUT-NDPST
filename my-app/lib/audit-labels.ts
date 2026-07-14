// Libellés d'affichage des actions du journal d'audit — extrait de lib/audit.ts
// pour rester importable depuis les composants client (lib/audit.ts importe
// lib/prisma, qui embarque le driver `pg`, incompatible avec un bundle navigateur).

export const LABELS_ACTIONS_AUDIT: Record<string, string> = {
  UTILISATEUR_CREE: 'Création utilisateur',
  UTILISATEUR_ROLE_MODIFIE: 'Changement de rôle',
  UTILISATEUR_DESACTIVE: 'Désactivation utilisateur',
  UTILISATEUR_REACTIVE: 'Réactivation utilisateur',
  UTILISATEUR_MOT_DE_PASSE_REINITIALISE: 'Mot de passe réinitialisé (admin)',
  UTILISATEUR_MOT_DE_PASSE_MODIFIE: "Mot de passe modifié (par l'utilisateur)",
  SCOUT_CREE: 'Création scout',
  SCOUT_MODIFIE: 'Modification scout',
  SCOUT_MATRICULE_ATTRIBUE: 'Attribution matricule',
  SCOUT_CONSENTEMENT_IMAGE_MODIFIE: 'Consentement image modifié',
  DOCUMENT_SUPPRIME: 'Suppression document',
  COTISATION_CREEE: 'Création cotisation',
  COTISATION_STATUT_MODIFIE: 'Changement de statut de cotisation',
  COTISATION_SUPPRIMEE: 'Suppression cotisation',
  SCOUT_BRANCHE_MODIFIEE: 'Passage de branche',
  SCOUT_SORTIE_MOUVEMENT: 'Sortie du mouvement',
  REUNION_SUPPRIMEE: 'Suppression réunion',
  PAROISSE_DESACTIVEE: 'Désactivation paroisse',
  PAROISSE_REACTIVEE: 'Réactivation paroisse',
  PAROISSE_SCOUTS_EXPORTES: 'Export des scouts',
  PAROISSE_UTILISATEURS_EXPORTES: 'Export des utilisateurs',
  PAROISSE_SUPPRIMEE: 'Suppression paroisse',
  DISTRICT_CREE: 'Création district',
  DISTRICT_MODIFIE: 'Renommage district',
  DISTRICT_SUPPRIME: 'Suppression district',
}
