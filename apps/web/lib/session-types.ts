import type { MandatSession, PermissionAdhesion } from '@scout/shared'
// Forme de la session exposée aux pages (session.user.*), relue auprès de
// l'API à chaque rendu serveur.
export interface Session {
  user: {
    id: string
    matricule: string | null
    email: string
    nom: string
    prenom: string
    doitChangerMotDePasse?: boolean
    role: string
    roleTechnique?: string
    mandatId?: string
    brancheType?: string | null
    mandats?: MandatSession[]
    habilitationsAdhesion?: { permission: PermissionAdhesion; brancheType: string | null }[]
    // Permission explicite de gérer les contenus publics.
    editeurContenu: boolean
  }
}
