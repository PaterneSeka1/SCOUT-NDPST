import { NextAuthOptions } from 'next-auth'
import CredentialsProvider from 'next-auth/providers/credentials'
import { compare } from 'bcryptjs'
import { prisma } from './prisma'
import { limiterTaux } from './rateLimit'
import { logger } from './logger'

const MAX_TENTATIVES_CONNEXION = 5
const FENETRE_CONNEXION_MS = 15 * 60 * 1000 // 15 minutes

// Le rôle/statut actif d'un compte sont figés dans le JWT jusqu'à la
// prochaine revalidation (voir callback jwt() ci-dessous) plutôt que jusqu'à
// la fin de la session (12h) : désactiver un compte ou changer son rôle doit
// prendre effet rapidement, pas seulement à la prochaine reconnexion.
const DELAI_REVALIDATION_MS = 5 * 60 * 1000 // 5 minutes

// Rôle "sentinelle" affecté à un compte dont la revalidation a échoué (compte
// désactivé, supprimé, ou paroisse désactivée entre-temps) : ne correspond à
// aucune constante ROLES_XXX de lib/roles.ts, donc tout contrôle d'accès
// (`ROLES_XXX.includes(session.user.role)`) échoue — sans avoir besoin
// d'invalider explicitement le cookie de session.
const ROLE_COMPTE_INVALIDE = '__COMPTE_INVALIDE__'

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
          // On n'inclut pas l'identifiant (matricule/téléphone = PII) dans le log,
          // seule l'IP et le type de limite atteinte sont utiles pour la détection.
          logger.warn('auth.rate_limit', { ip, parIdentifiant: !parIdentifiant.autorise, parIp: !parIp.autorise })
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
            roleDistrict: true,
            paroisseId: true,
            password: true,
            actif: true,
            paroisse: { select: { actif: true } },
          },
        })

        if (!utilisateur || !utilisateur.actif) {
          return null
        }

        // Une paroisse désactivée bloque la connexion de tout son personnel
        // (sans affecter ADMIN_PLATEFORME, qui n'a pas de paroisse).
        if (utilisateur.paroisse && !utilisateur.paroisse.actif) {
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
          roleDistrict: utilisateur.roleDistrict,
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
        token.roleDistrict = user.roleDistrict
        token.paroisseId = user.paroisseId
        token.revalideLe = Date.now()
        return token
      }

      // Revalidation périodique (debounce via revalideLe, jamais à chaque
      // requête) : relit role/roleDistrict/actif/paroisseId en base pour
      // détecter une désactivation ou un changement de rôle décidé depuis la
      // connexion.
      if (token.id && Date.now() - (token.revalideLe ?? 0) >= DELAI_REVALIDATION_MS) {
        const utilisateur = await prisma.utilisateur.findUnique({
          where: { id: token.id },
          select: { role: true, roleDistrict: true, actif: true, paroisseId: true, paroisse: { select: { actif: true } } },
        })

        if (!utilisateur || !utilisateur.actif || (utilisateur.paroisse && !utilisateur.paroisse.actif)) {
          token.role = ROLE_COMPTE_INVALIDE
          token.roleDistrict = null
          token.paroisseId = null
        } else {
          token.role = utilisateur.role
          token.roleDistrict = utilisateur.roleDistrict
          token.paroisseId = utilisateur.paroisseId
        }
        token.revalideLe = Date.now()
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
      session.user.roleDistrict = token.roleDistrict
      session.user.paroisseId = token.paroisseId
      return session
    },
  },
  pages: {
    signIn: '/login',
  },
}
