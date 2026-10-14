// Reprise PONCTUELLE des fichiers téléversés sur le disque du VPS vers le
// stockage externe (Cloudflare R2), avant la mise en service de l'API séparée.
//
// - Fichiers privés : <source>/uploads-prives/<paroisseId>/<nom> → clé
//   prive/<paroisseId>/<nom> du bucket privé. Leur URL en base
//   (/api/fichiers/<paroisseId>/<nom>) ne change pas : l'API les relit dans R2.
// - Fichiers publics : <source>/uploads-publiques/<nom> (et, avec
//   --public-ancien, les anciennes images de public/uploads/) → clé
//   public/<nom> du bucket public. Leurs URL en base (/api/fichiers-publics/<nom>,
//   /uploads/<nom>) sont réécrites vers STORAGE_PUBLIC_URL_BASE/public/<nom>.
//
// Sûr à relancer : un objet déjà présent dans R2 n'est pas renvoyé, une URL
// déjà réécrite n'est plus modifiée. Simulation par défaut : rien n'est écrit
// sans --appliquer. Aucun fichier local n'est supprimé : à faire à la main,
// après vérification.
//
// Usage (depuis apps/api, avec le .env de production chargé) :
//   npm run fichiers:migrer-r2 -- --source ../../my-app [--public-ancien ../../my-app/public/uploads] [--appliquer]

import 'dotenv/config'
import { readdir, readFile } from 'fs/promises'
import path from 'path'
import { HeadObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3'
import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '../src/generated/prisma/client'
import { TYPES_MIME_FICHIERS, cleFichierPrive, cleFichierPublic } from '../src/common/lib/storage'

function argument(nom: string): string | undefined {
  const index = process.argv.indexOf(nom)
  return index >= 0 ? process.argv[index + 1] : undefined
}

function requis(cle: string): string {
  const valeur = process.env[cle]?.trim()
  if (!valeur) throw new Error(`${cle} est requis (voir apps/api/.env.example)`)
  return valeur
}

const APPLIQUER = process.argv.includes('--appliquer')
const SOURCE = argument('--source')
const PUBLIC_ANCIEN = argument('--public-ancien')

async function lister(dossier: string): Promise<string[]> {
  try {
    const entrees = await readdir(dossier, { withFileTypes: true })
    return entrees.filter((e) => e.isFile()).map((e) => e.name)
  } catch {
    return []
  }
}

async function existeDansR2(client: S3Client, bucket: string, cle: string): Promise<boolean> {
  try {
    await client.send(new HeadObjectCommand({ Bucket: bucket, Key: cle }))
    return true
  } catch (erreur) {
    const statut = (erreur as { $metadata?: { httpStatusCode?: number } }).$metadata?.httpStatusCode
    if (statut === 404) return false
    throw erreur
  }
}

async function main() {
  if (!SOURCE) throw new Error('--source <dossier contenant uploads-prives et uploads-publiques> est requis')

  const bucketPrive = requis('STORAGE_S3_BUCKET')
  const bucketPublic = process.env.STORAGE_S3_BUCKET_PUBLIC?.trim() || bucketPrive
  const basePublique = requis('STORAGE_PUBLIC_URL_BASE').replace(/\/$/, '')
  const client = new S3Client({
    region: process.env.STORAGE_S3_REGION || 'auto',
    endpoint: process.env.STORAGE_S3_ENDPOINT || undefined,
    forcePathStyle: process.env.STORAGE_S3_FORCE_PATH_STYLE === 'true',
    requestChecksumCalculation: 'WHEN_REQUIRED',
    responseChecksumValidation: 'WHEN_REQUIRED',
    credentials: {
      accessKeyId: requis('STORAGE_S3_ACCESS_KEY_ID'),
      secretAccessKey: requis('STORAGE_S3_SECRET_ACCESS_KEY'),
    },
  })

  console.log(APPLIQUER ? '=== MODE APPLICATION ===' : '=== SIMULATION (ajouter --appliquer pour écrire) ===')

  // 1. Inventaire des fichiers locaux.
  const aEnvoyer: { local: string; bucket: string; cle: string }[] = []
  const dossierPrive = path.join(SOURCE, 'uploads-prives')
  const paroisses = await readdir(dossierPrive, { withFileTypes: true }).catch(() => [])
  for (const paroisse of paroisses.filter((e) => e.isDirectory())) {
    const paroisseId = paroisse.name
    const dossierParoisse = path.join(dossierPrive, paroisseId)
    for (const nom of await lister(dossierParoisse)) {
      aEnvoyer.push({
        local: path.join(dossierParoisse, nom),
        bucket: bucketPrive,
        cle: cleFichierPrive(paroisseId, nom),
      })
    }
  }
  const nomsPublics = new Set<string>()
  for (const dossier of [path.join(SOURCE, 'uploads-publiques'), PUBLIC_ANCIEN].filter(Boolean) as string[]) {
    for (const nom of await lister(dossier)) {
      nomsPublics.add(nom)
      aEnvoyer.push({ local: path.join(dossier, nom), bucket: bucketPublic, cle: cleFichierPublic(nom) })
    }
  }

  // 2. Envoi vers R2 (objets absents uniquement).
  let envoyes = 0
  let dejaPresents = 0
  for (const fichier of aEnvoyer) {
    if (await existeDansR2(client, fichier.bucket, fichier.cle)) {
      dejaPresents++
      continue
    }
    const type = TYPES_MIME_FICHIERS[path.extname(fichier.local).toLowerCase()] ?? 'application/octet-stream'
    if (APPLIQUER) {
      await client.send(
        new PutObjectCommand({
          Bucket: fichier.bucket,
          Key: fichier.cle,
          Body: await readFile(fichier.local),
          ContentType: type,
        }),
      )
    }
    envoyes++
  }
  console.log(
    `Fichiers : ${aEnvoyer.length} trouvés, ${dejaPresents} déjà dans R2, ${envoyes} ${APPLIQUER ? 'envoyés' : 'à envoyer'}`,
  )

  // 3. Réécriture des URL publiques en base (seulement pour les fichiers
  // effectivement repris, jamais sur la base d'un simple préfixe).
  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: requis('DATABASE_URL') }) })
  try {
    const nouvelleUrl = (ancienne: string | null): string | null => {
      if (!ancienne) return null
      const correspondance = /^\/(?:api\/fichiers-publics|uploads)\/([^/?#]+)$/.exec(ancienne)
      if (!correspondance || !nomsPublics.has(correspondance[1])) return null
      return `${basePublique}/${cleFichierPublic(correspondance[1])}`
    }

    let reecritures = 0
    for (const paroisse of await prisma.paroisse.findMany({ select: { id: true, logo: true } })) {
      const url = nouvelleUrl(paroisse.logo)
      if (!url) continue
      console.log(`  Paroisse ${paroisse.id} : logo → ${url}`)
      if (APPLIQUER) await prisma.paroisse.update({ where: { id: paroisse.id }, data: { logo: url } })
      reecritures++
    }
    const config = await prisma.configurationPlateforme.findUnique({ where: { id: 'platform' } })
    if (config) {
      const logoUrl = nouvelleUrl(config.logoUrl)
      const heroImageUrl = nouvelleUrl(config.heroImageUrl)
      if (logoUrl || heroImageUrl) {
        console.log(
          `  Plateforme : ${[logoUrl && 'logo', heroImageUrl && 'image d’accueil'].filter(Boolean).join(', ')}`,
        )
        if (APPLIQUER) {
          await prisma.configurationPlateforme.update({
            where: { id: 'platform' },
            data: { ...(logoUrl ? { logoUrl } : {}), ...(heroImageUrl ? { heroImageUrl } : {}) },
          })
        }
        reecritures += (logoUrl ? 1 : 0) + (heroImageUrl ? 1 : 0)
      }
    }
    for (const scout of await prisma.scout.findMany({
      where: { photo: { not: null } },
      select: { id: true, photo: true },
    })) {
      const url = nouvelleUrl(scout.photo)
      if (!url) continue
      if (APPLIQUER) await prisma.scout.update({ where: { id: scout.id }, data: { photo: url } })
      reecritures++
    }
    console.log(`URL publiques en base : ${reecritures} ${APPLIQUER ? 'réécrites' : 'à réécrire'}`)
  } finally {
    await prisma.$disconnect()
  }

  if (!APPLIQUER) console.log('Simulation terminée : relancer avec --appliquer.')
  else console.log('Terminé. Vérifier l’affichage des logos et documents avant de supprimer les fichiers locaux.')
}

main().catch((erreur) => {
  console.error(erreur instanceof Error ? erreur.message : erreur)
  process.exit(1)
})
