// Forme de la session exposée aux pages : identique à l'ancienne session
// next-auth (session.user.*) pour ne pas modifier les composants existants.
export interface Session {
  user: {
    id: string
    matricule: string | null
    email: string
    nom: string
    prenom: string
    role: string
    // Affectation district, additive au rôle paroissial — null si ce compte
    // ne sert pas le district.
    roleDistrict: string | null
    paroisseId: string | null
  }
}
