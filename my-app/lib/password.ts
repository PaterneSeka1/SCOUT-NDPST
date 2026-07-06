// Politique de mot de passe partagée entre le client (retour immédiat dans les
// formulaires) et le serveur (contrôle faisant foi, jamais fait confiance au
// client seul). Règle volontairement simple — au moins 8 caractères avec une
// lettre et un chiffre — pour rester accessible aux parents/scouts tout en
// écartant les mots de passe triviaux (ex : "123456").
export const REGLE_MOT_DE_PASSE = 'Au moins 8 caractères, avec une lettre et un chiffre.'

export function motDePasseValide(motDePasse: string): boolean {
  return motDePasse.length >= 8 && /[a-zA-Z]/.test(motDePasse) && /[0-9]/.test(motDePasse)
}
