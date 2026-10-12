import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { ROLES_GROUPE, ROLES_PLATEFORME } from '@/lib/roles'
import { sauvegarderFichierPublic, sauvegarderFichierPrive } from '@/lib/storage'
import { detecterTypeFichier } from '@/lib/fileSignature'
import { logger } from '@/lib/logger'

const TAILLE_MAX = 5 * 1024 * 1024 // 5 Mo

// Fichiers publics (branding) : logo de paroisse (Chef de Groupe) ou logo et
// image d'accueil de la plateforme (administrateur plateforme).
const ROLES_PUBLICATION: string[] = [...ROLES_GROUPE, ...ROLES_PLATEFORME]

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return NextResponse.json({ erreur: 'Non autorisé' }, { status: 401 })

    let formData: FormData
    try {
      formData = await req.formData()
    } catch {
      return NextResponse.json({ erreur: 'Formulaire invalide' }, { status: 400 })
    }
    const fichier = formData.get('fichier')
    const visibilite = formData.get('visibilite') === 'publique' ? 'publique' : 'privee'

    if (!(fichier instanceof File)) return NextResponse.json({ erreur: 'Aucun fichier reçu' }, { status: 400 })

    if (fichier.size > TAILLE_MAX)
      return NextResponse.json({ erreur: 'Fichier trop volumineux (max 5 Mo)' }, { status: 400 })

    if (visibilite === 'publique' && !ROLES_PUBLICATION.includes(session.user.role)) {
      return NextResponse.json({ erreur: 'Accès refusé' }, { status: 403 })
    }

    // Un fichier privé est cloisonné par paroisse : un compte sans paroisse
    // (administrateur plateforme) ne peut pas en déposer.
    const paroisseId = session.user.paroisseId
    if (visibilite === 'privee' && !paroisseId) {
      return NextResponse.json({ erreur: 'Accès refusé' }, { status: 403 })
    }

    const buffer = Buffer.from(await fichier.arrayBuffer())

    // Le Content-Type déclaré par le client (fichier.type) est falsifiable dans
    // une requête multipart forgée : on détecte le type réel à partir des octets,
    // et on en dérive l'extension de stockage — jamais du nom de fichier fourni
    // par l'utilisateur. Empêche l'upload d'un SVG/HTML malveillant déguisé en
    // image, qui serait ensuite servi tel quel et interprété par le navigateur.
    const detecte = detecterTypeFichier(buffer)
    if (!detecte)
      return NextResponse.json({ erreur: 'Type de fichier non autorisé (JPEG, PNG, WebP, GIF, PDF)' }, { status: 400 })

    if (visibilite === 'publique' && !detecte.mime.startsWith('image/')) {
      return NextResponse.json(
        { erreur: 'Les fichiers publics doivent être des images (JPEG, PNG, WebP ou GIF)' },
        { status: 400 },
      )
    }

    const nomFichier = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${detecte.ext}`

    if (visibilite === 'publique') {
      // Fichiers de branding (logo, image d'accueil) : visibles sans authentification,
      // affichés notamment sur la page de connexion.
      const url = await sauvegarderFichierPublic(nomFichier, buffer, detecte.mime)
      return NextResponse.json({ url })
    }

    // Fichier privé (photo de scout, document, autorisation de camp…) : jamais
    // servi directement, cloisonné par paroisse, accessible uniquement via
    // /api/fichiers, qui vérifie la session. paroisseId est non nul ici
    // (vérifié plus haut pour les fichiers privés).
    const url = await sauvegarderFichierPrive(paroisseId as string,nomFichier, buffer, detecte.mime)
    return NextResponse.json({ url })
  } catch (error) {
    logger.error('POST /api/upload', error)
    return NextResponse.json({ erreur: 'Erreur serveur' }, { status: 500 })
  }
}
