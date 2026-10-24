import type { Request } from 'express'

// Identité vérifiée contre la session et le compte courant à chaque requête.
export interface UtilisateurSession {
  id: string
  matricule: string | null
  email: string
  nom: string
  prenom: string
  role: string
  // Permission explicite de gérer les contenus publics (voir peutGererContenus).
  editeurContenu: boolean
  doitChangerMotDePasse?: boolean
}

export type RequeteAuthentifiee = Request & { utilisateur?: UtilisateurSession }
