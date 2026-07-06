import { NextRequest, NextResponse } from 'next/server'
import { writeFile, mkdir } from 'fs/promises'
import path from 'path'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { ROLES_GROUPE as ROLES_PUBLICATION } from '@/lib/roles'

const TAILLE_MAX = 5 * 1024 * 1024 // 5 Mo
const TYPES_AUTORISES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'application/pdf']

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ erreur: 'Non autorisé' }, { status: 401 })

  const formData = await req.formData()
  const fichier = formData.get('fichier') as File | null
  const visibilite = formData.get('visibilite') === 'publique' ? 'publique' : 'privee'

  if (!fichier) return NextResponse.json({ erreur: 'Aucun fichier reçu' }, { status: 400 })

  if (!TYPES_AUTORISES.includes(fichier.type))
    return NextResponse.json({ erreur: 'Type de fichier non autorisé (JPEG, PNG, WebP, GIF, PDF)' }, { status: 400 })

  if (fichier.size > TAILLE_MAX)
    return NextResponse.json({ erreur: 'Fichier trop volumineux (max 5 Mo)' }, { status: 400 })

  if (visibilite === 'publique' && !ROLES_PUBLICATION.includes(session.user.role)) {
    return NextResponse.json({ erreur: 'Accès refusé' }, { status: 403 })
  }

  const ext = fichier.name.split('.').pop()?.toLowerCase() ?? 'jpg'
  const nomFichier = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`
  const buffer = Buffer.from(await fichier.arrayBuffer())

  if (visibilite === 'publique') {
    // Fichiers de branding (logo, image d'accueil) : visibles sans authentification,
    // affichés notamment sur la page de connexion.
    const dossier = path.join(process.cwd(), 'public', 'uploads')
    await mkdir(dossier, { recursive: true })
    await writeFile(path.join(dossier, nomFichier), buffer)
    return NextResponse.json({ url: `/uploads/${nomFichier}` })
  }

  // Fichier privé (photo de scout, document, autorisation de camp…) : stocké hors du
  // dossier `public/` — jamais servi directement par Next.js — et cloisonné par
  // paroisse. Accessible uniquement via /api/fichiers, qui vérifie la session.
  const dossier = path.join(process.cwd(), 'uploads-prives', session.user.paroisseId)
  await mkdir(dossier, { recursive: true })
  await writeFile(path.join(dossier, nomFichier), buffer)
  return NextResponse.json({ url: `/api/fichiers/${session.user.paroisseId}/${nomFichier}` })
}
