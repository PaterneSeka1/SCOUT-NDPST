import { DefaultSession } from 'next-auth'

declare module 'next-auth' {
  interface Session {
    user: {
      id: string
      matricule: string | null
      role: string
      paroisseId: string | null
      nom: string
      prenom: string
    } & DefaultSession['user']
  }

  interface User {
    id: string
    matricule: string | null
    role: string
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
    paroisseId: string | null
    nom: string
    prenom: string
  }
}
