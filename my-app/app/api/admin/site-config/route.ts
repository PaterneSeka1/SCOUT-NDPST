import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { ROLES_PLATEFORME } from '@/lib/roles'
import { estUrlFichierValide } from '@/lib/validation'
import { estCouleurHexValide } from '@/lib/theme'
import { urlPubliqueBase } from '@/lib/storage'

// Identité visuelle commune à toutes les paroisses (page d'accueil, page de
// connexion — avant qu'on sache à quelle paroisse un visiteur appartient).
// Stockée en base (ConfigurationPlateforme, ligne unique id="platform") plutôt
// que dans un fichier : gérée exclusivement par ADMIN_PLATEFORME.

type SiteConfigJSON = {
  logoSite: string
  nomSite: string
  sousTitreSite: string
  theme: { couleurPrimaire: string; couleurAccent: string; couleurFond: string; couleurHover: string }
  hero: { imageUrl: string; imageAlt: string; badge: string; titre: string; sousTitre: string }
  stats: { value: string; label: string }[]
}

async function chargerConfig() {
  return prisma.configurationPlateforme.upsert({
    where: { id: 'platform' },
    create: { id: 'platform' },
    update: {},
  })
}

function versJSON(cfg: Awaited<ReturnType<typeof chargerConfig>>): SiteConfigJSON {
  return {
    logoSite: cfg.logoUrl ?? '',
    nomSite: cfg.nomSite,
    sousTitreSite: cfg.sousTitreSite,
    theme: {
      couleurPrimaire: cfg.couleurPrimaire,
      couleurAccent: cfg.couleurAccent,
      couleurFond: cfg.couleurFond,
      couleurHover: cfg.couleurHover,
    },
    hero: {
      imageUrl: cfg.heroImageUrl ?? '',
      imageAlt: cfg.heroImageAlt ?? '',
      badge: cfg.heroBadge ?? '',
      titre: cfg.heroTitre ?? '',
      sousTitre: cfg.heroSousTitre ?? '',
    },
    stats: (cfg.stats as SiteConfigJSON['stats'] | null) ?? [],
  }
}

export async function GET() {
  const cfg = await chargerConfig()
  return NextResponse.json(versJSON(cfg))
}

export async function PUT(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session || !ROLES_PLATEFORME.includes(session.user.role)) {
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

  const data = body as Partial<SiteConfigJSON>
  const origineStockage = urlPubliqueBase()

  if (data.logoSite && !estUrlFichierValide(data.logoSite, origineStockage)) {
    return NextResponse.json({ erreur: 'logoSite doit être un chemin local (ex : /uploads/…) ou une URL de stockage autorisée' }, { status: 400 })
  }

  if (data.hero?.imageUrl && !estUrlFichierValide(data.hero.imageUrl, origineStockage)) {
    return NextResponse.json({ erreur: 'hero.imageUrl doit être un chemin local (ex : /uploads/…) ou une URL de stockage autorisée' }, { status: 400 })
  }

  if (data.theme) {
    for (const [champ, valeur] of Object.entries(data.theme)) {
      if (!estCouleurHexValide(valeur)) {
        return NextResponse.json({ erreur: `${champ} doit être une couleur hexadécimale valide (ex : #1a4731)` }, { status: 400 })
      }
    }
  }

  const champs = {
    ...(data.nomSite !== undefined ? { nomSite: data.nomSite } : {}),
    ...(data.sousTitreSite !== undefined ? { sousTitreSite: data.sousTitreSite } : {}),
    ...(data.logoSite !== undefined ? { logoUrl: data.logoSite || null } : {}),
    ...(data.theme?.couleurPrimaire !== undefined ? { couleurPrimaire: data.theme.couleurPrimaire } : {}),
    ...(data.theme?.couleurAccent !== undefined ? { couleurAccent: data.theme.couleurAccent } : {}),
    ...(data.theme?.couleurFond !== undefined ? { couleurFond: data.theme.couleurFond } : {}),
    ...(data.theme?.couleurHover !== undefined ? { couleurHover: data.theme.couleurHover } : {}),
    ...(data.hero?.badge !== undefined ? { heroBadge: data.hero.badge || null } : {}),
    ...(data.hero?.titre !== undefined ? { heroTitre: data.hero.titre || null } : {}),
    ...(data.hero?.sousTitre !== undefined ? { heroSousTitre: data.hero.sousTitre || null } : {}),
    ...(data.hero?.imageUrl !== undefined ? { heroImageUrl: data.hero.imageUrl || null } : {}),
    ...(data.hero?.imageAlt !== undefined ? { heroImageAlt: data.hero.imageAlt || null } : {}),
    ...(data.stats !== undefined ? { stats: data.stats } : {}),
  }

  const updated = await prisma.configurationPlateforme.upsert({
    where: { id: 'platform' },
    create: { id: 'platform', ...champs },
    update: champs,
  })

  return NextResponse.json(versJSON(updated))
}
