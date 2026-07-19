import { randomInt } from 'crypto'
import { motDePasseValide } from './password'

// Alphabet réduit (sans 0/O/1/l/I) pour rester lisible/transcriptible à voix
// haute lors d'une communication manuelle (téléphone, en personne) — usage :
// réinitialisation admin d'un mot de passe (voir routes .../reinitialiser-mot-de-passe).
const MAJUSCULES = 'ABCDEFGHJKLMNPQRSTUVWXYZ'
const MINUSCULES = 'abcdefghijkmnpqrstuvwxyz'
const CHIFFRES = '23456789'
const TOUS = MAJUSCULES + MINUSCULES + CHIFFRES

function caractereAleatoire(alphabet: string): string {
  return alphabet[randomInt(alphabet.length)]
}

// Généré côté serveur, jamais stocké en clair — uniquement renvoyé une fois à
// l'appelant pour affichage/communication manuelle. Conforme par construction
// à motDePasseValide() (lib/password.ts).
export function genererMotDePasseTemporaire(longueur = 12): string {
  if (longueur < 3) {
    throw new Error('longueur doit être d’au moins 3 pour garantir majuscule + minuscule + chiffre')
  }

  const caracteres = [
    caractereAleatoire(MAJUSCULES),
    caractereAleatoire(MINUSCULES),
    caractereAleatoire(CHIFFRES),
  ]
  for (let i = caracteres.length; i < longueur; i++) {
    caracteres.push(caractereAleatoire(TOUS))
  }

  // Fisher-Yates : évite d'avoir systématiquement majuscule/minuscule/chiffre
  // dans cet ordre en tête du mot de passe généré.
  for (let i = caracteres.length - 1; i > 0; i--) {
    const j = randomInt(i + 1)
    ;[caracteres[i], caracteres[j]] = [caracteres[j], caracteres[i]]
  }

  const motDePasse = caracteres.join('')
  // Garde-fou : ne devrait jamais se déclencher vu la construction ci-dessus,
  // mais évite de renvoyer silencieusement un mot de passe non conforme si la
  // règle de lib/password.ts venait à changer sans mettre à jour ce fichier.
  if (!motDePasseValide(motDePasse)) {
    throw new Error('Mot de passe temporaire généré non conforme à la règle en vigueur')
  }
  return motDePasse
}
