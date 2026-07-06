import { NextAuthOptions } from 'next-auth'
import CredentialsProvider from 'next-auth/providers/credentials'
import { compare } from 'bcryptjs'
import { prisma } from './prisma'
import { limiterTaux } from './rateLimit'

const MAX_TENTATIVES_CONNEXION = 5
const FENETRE_CONNEXION_MS = 15 * 60 * 1000 // 15 minutes

export const authOptions: NextAuthOptions = {
  session: {
    strategy: 'jwt',
    // Par défaut NextAuth garde une session valide 30 jours : trop long pour des
    // comptes qui peuvent gérer des données de mineurs. 12h de validité totale,
    // prolongée automatiquement par tranches d'1h tant que la session est active.
    maxAge: 12 * 60 * 60,
    updateAge: 60 * 60,
  },
  providers: [
    CredentialsProvider({
      name: 'Credentials',
      credentials: {
        identifiant: { label: 'Matricule ou téléphone', type: 'text' },
        password: { label: 'Mot de passe', type: 'password' },
      },
      async authorize(credentials, req) {
        if (!credentials?.identifiant || !credentials?.password) {
          return null
        }

        const forwardedFor = req?.headers?.['x-forwarded-for']
        const ip = (Array.isArray(forwardedFor) ? forwardedFor[0] : forwardedFor)?.split(',')[0]?.trim() ?? 'ip-inconnue'

        // Limite par identifiant ET par IP : empêche aussi bien le brute-force d'un
        // compte précis que le credential stuffing depuis une seule source.
        const parIdentifiant = limiterTaux(`login:id:${credentials.identifiant}`, MAX_TENTATIVES_CONNEXION, FENETRE_CONNEXION_MS)
        const parIp = limiterTaux(`login:ip:${ip}`, MAX_TENTATIVES_CONNEXION * 4, FENETRE_CONNEXION_MS)
        if (!parIdentifiant.autorise || !parIp.autorise) {
          throw new Error('Trop de tentatives. Réessayez dans quelques minutes.')
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
