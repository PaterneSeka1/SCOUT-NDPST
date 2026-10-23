import { randomBytes } from 'crypto'

// 192 bits aléatoires ; préfixe pour respecter la règle de complexité existante.
// Seulement retourné une fois à l'acteur habilité, jamais stocké ni journalisé.
export function genererMotDePasseTemporaire(): string {
  return `Aa1!${randomBytes(24).toString('base64url')}`
}
