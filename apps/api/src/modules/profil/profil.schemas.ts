import { z } from 'zod'

// Schémas des corps de requête de l'espace personnel. Seule la forme des
// données est contrôlée ici ; l'unicité (e-mail, téléphone), la vérification
// du mot de passe actuel, la règle de complexité du nouveau mot de passe et le
// lien parent-enfant restent dans ProfilService.

const MESSAGE_CORPS_INVALIDE = 'Données invalides'

// Seuls les champs auto-modifiables sont conservés : role, actif, matricule ou
// editeurContenu envoyés par un client sont retirés par z.object.
export const SchemaModificationProfil = z.object(
  {
    // nom et prénom sont obligatoires en base : null est refusé.
    nom: z.string({ error: 'Le nom est invalide' }).optional(),
    prenom: z.string({ error: 'Le prénom est invalide' }).optional(),
    email: z.string({ error: 'L’adresse e-mail est invalide' }).nullish(),
    telephone: z.string({ error: 'Le numéro de téléphone est invalide' }).nullish(),
  },
  { error: MESSAGE_CORPS_INVALIDE },
)

export type CorpsModificationProfil = z.infer<typeof SchemaModificationProfil>

const MESSAGE_MOTS_DE_PASSE_REQUIS = 'Le mot de passe actuel et le nouveau mot de passe sont requis'

export const SchemaChangementMotDePasse = z.object(
  {
    motDePasseActuel: z.string({ error: MESSAGE_MOTS_DE_PASSE_REQUIS }).min(1, MESSAGE_MOTS_DE_PASSE_REQUIS),
    // La règle de complexité est vérifiée par le service, après le mot de
    // passe actuel.
    nouveauMotDePasse: z.string({ error: MESSAGE_MOTS_DE_PASSE_REQUIS }).min(1, MESSAGE_MOTS_DE_PASSE_REQUIS),
  },
  { error: MESSAGE_CORPS_INVALIDE },
)

export type CorpsChangementMotDePasse = z.infer<typeof SchemaChangementMotDePasse>

// Consentement parental (droit à l'image, données de santé).
export const SchemaConsentement = z.object(
  {
    consentement: z.boolean({ error: 'Le champ consentement (booléen) est requis' }),
  },
  { error: MESSAGE_CORPS_INVALIDE },
)

export type CorpsConsentement = z.infer<typeof SchemaConsentement>
