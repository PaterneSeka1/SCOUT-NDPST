import type { Request } from 'express'

// Identité portée par le jeton d'accès. Le rôle, l'affectation district et la
// paroisse sont relus en base à chaque rafraîchissement (voir AuthService) :
// une désactivation ou un changement de rôle prend effet au plus tard à
// l'expiration du jeton d'accès (JWT_ACCESS_TTL_SECONDES).
export interface UtilisateurSession {
  id: string
  matricule: string | null
  email: string
  nom: string
  prenom: string
  role: string
  // Affectation district, additive au rôle paroissial — null si ce compte ne
  // sert pas le district.
  roleDistrict: string | null
  paroisseId: string | null
  // Renseigné quand le compte appartient à une AUTRE installation (identifiant
  // de l'émetteur) : administrateur plateforme partagé, absent de cette base.
  externe?: string
}

export type RequeteAuthentifiee = Request & { utilisateur?: UtilisateurSession }
