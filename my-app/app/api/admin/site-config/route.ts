import { NextRequest, NextResponse } from 'next/server'
import { readFile, writeFile } from 'fs/promises'
import path from 'path'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { ROLES_GROUPE as ROLES_AUTORISES } from '@/lib/roles'
import { estCheminLocalValide } from '@/lib/validation'

const CONFIG_PATH = path.join(process.cwd(), 'config', 'site.json')

// Les couleurs du thème sont injectées telles quelles dans une balise <style>
// côté layout (dangerouslySetInnerHTML) : sans ce contrôle strict, une valeur
// comme "#fff} </style><script>…</script>" permettrait une injection HTML/JS
// stockée, visible par tous les visiteurs du site.
const COULEUR_HEX_REGEX = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/
function estCouleurHexValide(valeur: unknown): valeur is string {
  return typeof valeur === 'string' && COULEUR_HEX_REGEX.test(valeur)
}

export async function GET() {
  try {
    const raw = await readFile(CONFIG_PATH, 'utf-8')
    return NextResponse.json(JSON.parse(raw))
  } catch {
    return NextResponse.json({ erreur: 'Configuration introuvable' }, { status: 404 })
  }
}

export async function PUT(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session || !ROLES_AUTORISES.includes(session.user.role)) {
    return NextResponse.json({ erreur: 'Accès refusé' }, { status: 403 })
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ erreur: 'Corps JSON invalide' }, { status: 400 })
  }

  if (typeof body !== 'object' || body === null) {
    return NextResponse.json({ erreur: 'Données invalides' }, { status: 400 })
  }

  const data = body as Record<string, unknown>

  if ('logoSite' in data && data.logoSite && !estCheminLocalValide(data.logoSite)) {
    return NextResponse.json({ erreur: 'logoSite doit être un chemin local (ex : /uploads/…)' }, { status: 400 })
  }

  if ('hero' in data && typeof data.hero === 'object' && data.hero !== null) {
    const hero = data.hero as Record<string, unknown>
    if ('imageUrl' in hero && hero.imageUrl && !estCheminLocalValide(hero.imageUrl)) {
      return NextResponse.json({ erreur: 'hero.imageUrl doit être un chemin local (ex : /uploads/…)' }, { status: 400 })
    }
  }

  if ('theme' in data && typeof data.theme === 'object' && data.theme !== null) {
    const theme = data.theme as Record<string, unknown>
    const CHAMPS_COULEUR = ['couleurPrimaire', 'couleurAccent', 'couleurFond', 'couleurHover']
    for (const champ of CHAMPS_COULEUR) {
      if (champ in theme && !estCouleurHexValide(theme[champ])) {
        return NextResponse.json({ erreur: `${champ} doit être une couleur hexadécimale valide (ex : #1a4731)` }, { status: 400 })
      }
    }
  }

  // Lecture config existante pour ne modifier que ce qui est transmis
  let existing: Record<string, unknown> = {}
  try {
    const raw = await readFile(CONFIG_PATH, 'utf-8')
    existing = JSON.parse(raw)
  } catch {
    // Si absent, on repart de zéro
  }

  const updated = { ...existing, ...data }

  await writeFile(CONFIG_PATH, JSON.stringify(updated, null, 2), 'utf-8')
  return NextResponse.json(updated)
}
