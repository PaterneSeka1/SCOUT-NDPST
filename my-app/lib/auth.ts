import { NextAuthOptions } from 'next-auth'
import CredentialsProvider from 'next-auth/providers/credentials'
import { compare } from 'bcryptjs'
import { prisma } from './prisma'

export const authOptions: NextAuthOptions = {
  session: {
    strategy: 'jwt',
  },
  providers: [
    CredentialsProvider({
      name: 'Credentials',
      credentials: {
        identifiant: { label: 'Matricule ou téléphone', type: 'text' },
        password: { label: 'Mot de passe', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.identifiant || !credentials?.password) {
          return null
        }

        const utilisateur = await prisma.utilisateur.findFirst({
          where: {
            OR: [
              { matricule: credentials.identifiant },
              { telephone: credentials.identifiant },
            ],
          },
          select: {
            id: true,
            matricule: true,
            telephone: true,
            email: true,
            nom: true,
            prenom: true,
            role: true,
            paroisseId: true,
            password: true,
            actif: true,
          },
        })

        if (!utilisateur || !utilisateur.actif) {
          return null
        }

        const passwordValide = await compare(credentials.password, utilisateur.password)
        if (!passwordValide) {
          return null
        }

        return {
          id: utilisateur.id,
          matricule: utilisateur.matricule,
          email: utilisateur.email ?? '',
          nom: utilisateur.nom,
          prenom: utilisateur.prenom,
          role: utilisateur.role,
          paroisseId: utilisateur.paroisseId,
        }
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id
        token.matricule = user.matricule
        token.email = user.email
        token.nom = user.nom
        token.prenom = user.prenom
        token.role = user.role
        token.paroisseId = user.paroisseId
      }
      return token
    },
    async session({ session, token }) {
      session.user.id = token.id
      session.user.matricule = token.matricule
      session.user.email = token.email as string
      session.user.nom = token.nom
      session.user.prenom = token.prenom
      session.user.role = token.role
      session.user.paroisseId = token.paroisseId
      return session
    },
  },
  pages: {
    signIn: '/login',
  },
}
