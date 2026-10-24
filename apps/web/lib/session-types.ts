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
    // Permission explicite de gérer les contenus publics.
    editeurContenu: boolean
  }
}
