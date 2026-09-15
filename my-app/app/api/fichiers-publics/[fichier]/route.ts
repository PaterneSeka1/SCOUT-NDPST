import { NextRequest, NextResponse } from 'next/server'
import path from 'path'
import { lireFichierPublicLocal, TYPES_MIME_FICHIERS } from '@/lib/storage'

type RouteParams = { params: Promise<{ fichier: string }> }

// Sert les fichiers publics (logo, image d'accueil…) téléversés via /api/upload
// en mode disque local. Contrairement à /api/fichiers, aucune session n'est
// exigée : ces images sont affichées sans authentification (ex : page de
// connexion). Ne sert que ce que /api/upload y a écrit (voir
// sauvegarderFichierPublic dans lib/storage.ts) — jamais utilisé quand un
// stockage S3 est configuré, auquel cas l'URL renvoyée pointe directement
// vers le bucket/CDN.
export async function GET(_req: NextRequest, { params }: RouteParams) {
  const { fichier } = await params

  // Empêche toute tentative de path traversal (ex : "..%2F..%2F.env")
  const nomFichier = path.basename(fichier)
  if (nomFichier !== fichier) {
    return NextResponse.json({ erreur: 'Fichier invalide' }, { status: 400 })
  }

  try {
    const buffer = await lireFichierPublicLocal(nomFichier)
    const ext = path.extname(nomFichier).toLowerCase()
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        'Content-Type': TYPES_MIME_FICHIERS[ext] ?? 'application/octet-stream',
        // Immuable : le nom de fichier inclut un horodatage + suffixe aléatoire
        // (voir app/api/upload/route.ts), jamais réutilisé pour un contenu différent.
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
    })
  } catch {
    return NextResponse.json({ erreur: 'Fichier introuvable' }, { status: 404 })
  }
}
