import type { MetadataRoute } from 'next'

// Convention de fichier Next.js : servi sur /robots.txt. Seules les pages
// publiques sont indexables ; l'espace connecté, l'API et les pages
// d'authentification restent hors des moteurs de recherche.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/dashboard', '/admin', '/api', '/connexion', '/mot-de-passe-oublie', '/reinitialiser-motdepasse', '/changer-mot-de-passe'],
    },
  }
}
