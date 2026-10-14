import type { MetadataRoute } from 'next'

// Convention de fichier Next.js : servi sur /robots.txt. Console
// d'administration : rien n'est indexable (voir aussi `robots` dans app/layout.tsx).
export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: '*', disallow: '/' },
  }
}
