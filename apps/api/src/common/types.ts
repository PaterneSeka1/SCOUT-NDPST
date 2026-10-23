import type { Request } from 'express'

// Identité vérifiée contre la session et le compte courant à chaque requête.
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
  doitChangerMotDePasse?: boolean
  externe?: string
}

export type RequeteAuthentifiee = Request & { utilisateur?: UtilisateurSession }
