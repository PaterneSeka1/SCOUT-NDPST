import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { readFile } from 'fs/promises'
import path from 'path'

// Route publique — aucune authentification requise
export async function GET() {
  // Logo paroisse depuis la BDD (priorité maximale)
  let logoParoisse: string | null = null
  try {
    // NB : sur un déploiement hébergeant plusieurs paroisses, un visiteur non
    // authentifié n'a aucun moyen d'indiquer la sienne (pas de sous-domaine ni
    // de sélecteur) — cette route ne peut donc pas savoir quel logo afficher
    // et retombe sur la première paroisse créée, par ordre déterministe.
    const paroisse = await prisma.paroisse.findFirst({ select: { logo: true }, orderBy: { createdAt: 'asc' } })
    logoParoisse = paroisse?.logo ?? null
  } catch {
    // DB indisponible
  }

  // Infos texte + logoSite depuis le fichier de config
  let nomSite = 'SCOUT ASCCI'
  let sousTitreSite = "Côte d'Ivoire"
  let logoSite: string | null = null
  try {
    const raw = await readFile(path.join(process.cwd(), 'config', 'site.json'), 'utf-8')
    const config = JSON.parse(raw)
    nomSite = config.nomSite ?? nomSite
    sousTitreSite = config.sousTitreSite ?? sousTitreSite
    logoSite = config.logoSite || null
  } catch {
    // Fichier absent
  }

  // Logo effectif : logo paroisse (BDD) en priorité, sinon logoSite (config)
  const logoUrl = logoParoisse ?? logoSite

  return NextResponse.json({ logoUrl, nomSite, sousTitreSite })
}
