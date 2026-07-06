import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { readFile } from 'fs/promises'
import path from 'path'

const TYPES_MIME: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.pdf': 'application/pdf',
}

type RouteParams = { params: Promise<{ paroisseId: string; fichier: string }> }

// Sert les fichiers privés (photos de scouts, documents, autorisations de camp…)
// téléversés via /api/upload. Contrairement à /public/uploads, ce dossier n'est
// jamais exposé directement : chaque requête exige une session valide et vérifie
// que l'utilisateur appartient à la paroisse propriétaire du fichier.
export async function GET(_req: NextRequest, { params }: RouteParams) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ erreur: 'Non authentifié' }, { status: 401 })

  const { paroisseId, fichier } = await params

  if (session.user.paroisseId !== paroisseId) {
    return NextResponse.json({ erreur: 'Accès refusé' }, { status: 403 })
  }

  // Empêche toute tentative de path traversal (ex : "..%2F..%2F.env")
  const nomFichier = path.basename(fichier)
  if (nomFichier !== fichier) {
    return NextResponse.json({ erreur: 'Fichier invalide' }, { status: 400 })
  }

  const cheminFichier = path.join(process.cwd(), 'uploads-prives', paroisseId, nomFichier)

  try {
    const buffer = await readFile(cheminFichier)
    const ext = path.extname(nomFichier).toLowerCase()
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        'Content-Type': TYPES_MIME[ext] ?? 'application/octet-stream',
        'Cache-Control': 'private, max-age=3600',
      },
    })
  } catch {
    return NextResponse.json({ erreur: 'Fichier introuvable' }, { status: 404 })
  }
}
