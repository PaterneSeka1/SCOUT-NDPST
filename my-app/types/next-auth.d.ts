import { DefaultSession } from 'next-auth'

declare module 'next-auth' {
  interface Session {
    user: {
      id: string
      matricule: string | null
      role: string
      // Affectation district, additive au rôle paroissial (role) ci-dessus —
      // null si ce compte ne sert pas le district. Voir lib/auth.ts.
      roleDistrict: string | null
      paroisseId: string | null
      nom: string
      prenom: string
    } & DefaultSession['user']
  }

  interface User {
    id: string
    matricule: string | null
    role: string
    roleDistrict: string | null
    paroisseId: string | null
    nom: string
    prenom: string
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    id: string
    matricule: string | null
    role: string
    roleDistrict: string | null
    paroisseId: string | null
    nom: string
    prenom: string
    // Horodatage (Date.now()) de la dernière revalidation en base de
    // role/roleDistrict/actif/paroisseId — voir lib/auth.ts, callback jwt().
    revalideLe?: number
  }
}
