import { readFile, writeFile, mkdir } from 'fs/promises'
import path from 'path'
import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3'

// Couche d'abstraction du stockage de fichiers. Par défaut (aucune variable
// STORAGE_S3_* définie), les fichiers vont sur le disque local — adapté à un
// hébergement avec disque persistant (VPS/Docker). Dès que STORAGE_S3_BUCKET
// est défini, tout bascule automatiquement vers un stockage compatible S3
// (AWS S3, mais aussi MinIO, DigitalOcean Spaces, Backblaze B2, Scaleway…,
// qui exposent tous la même API) — sans changement ailleurs dans le code :
// les routes appelantes n'ont pas besoin de savoir lequel est actif.
//
// Les fichiers privés gardent la même URL (/api/fichiers/<paroisseId>/<nom>)
// quel que soit le pilote : ils ne sont jamais exposés publiquement même sur
// S3, toujours servis via la route authentifiée qui vérifie la session.

// Lu à chaque appel (pas mis en cache dans une constante de module) : permet
// de rester correct si la configuration change entre deux requêtes (tests,
// rechargement à chaud en dev) plutôt que de figer la valeur au premier import.
function bucketS3(): string | undefined {
  return process.env.STORAGE_S3_BUCKET || undefined
}

// Bucket dédié aux fichiers publics (logo, image héro...), distinct du bucket
// privé. Nécessaire pour les fournisseurs qui ne gèrent la visibilité qu'au
// niveau du bucket entier (Supabase Storage, Cloudflare R2 — pas d'ACL par
// objet) : un seul bucket "public" exposerait aussi les documents privés
// (certificats médicaux, autorisations parentales) à quiconque devine leur
// clé. Par défaut (non défini), retombe sur le bucket privé — comportement
// historique, valide pour un vrai AWS S3 où l'ACL par objet fonctionne.
function bucketS3Public(): string | undefined {
  return process.env.STORAGE_S3_BUCKET_PUBLIC || bucketS3()
}

function utiliseS3(): boolean {
  return !!bucketS3()
}

// Un seul client par process (pas par appel), mais reconstruit si le bucket
// configuré change — ne se produit qu'en test, jamais en production où la
// configuration est figée pour la durée du process.
let clientS3: S3Client | null = null
let clientS3Bucket: string | undefined
function getClientS3(): S3Client {
  const bucket = bucketS3()
  if (!clientS3 || clientS3Bucket !== bucket) {
    clientS3 = new S3Client({
      region: process.env.STORAGE_S3_REGION || 'auto',
      endpoint: process.env.STORAGE_S3_ENDPOINT || undefined,
      forcePathStyle: process.env.STORAGE_S3_FORCE_PATH_STYLE === 'true',
      credentials: {
        accessKeyId: process.env.STORAGE_S3_ACCESS_KEY_ID ?? '',
        secretAccessKey: process.env.STORAGE_S3_SECRET_ACCESS_KEY ?? '',
      },
    })
    clientS3Bucket = bucket
  }
  return clientS3
}

export function cleFichierPublic(nomFichier: string): string {
  return `public/${nomFichier}`
}

export function cleFichierPrive(paroisseId: string, nomFichier: string): string {
  return `prive/${paroisseId}/${nomFichier}`
}

// Origine à autoriser dans estUrlFichierValide() (lib/validation.ts) pour les
// fichiers publics — uniquement pertinent quand le pilote S3 est actif, sinon
// les fichiers publics restent des chemins locaux ("/uploads/…").
export function urlPubliqueBase(): string | null {
  if (!utiliseS3()) return null
  return process.env.STORAGE_PUBLIC_URL_BASE?.replace(/\/$/, '') ?? null
}

export async function sauvegarderFichierPublic(
  nomFichier: string,
  buffer: Buffer,
  contentType: string,
): Promise<string> {
  const cle = cleFichierPublic(nomFichier)

  if (utiliseS3()) {
    const bucket = bucketS3Public()
    await getClientS3().send(
      new PutObjectCommand({ Bucket: bucket, Key: cle, Body: buffer, ContentType: contentType, ACL: 'public-read' }),
    )
    const base = urlPubliqueBase()
    if (base) return `${base}/${cle}`
    const endpoint = (process.env.STORAGE_S3_ENDPOINT ?? '').replace(/\/$/, '')
    return `${endpoint}/${bucket}/${cle}`
  }

  const dossier = path.join(process.cwd(), 'public', 'uploads')
  await mkdir(dossier, { recursive: true })
  await writeFile(path.join(dossier, nomFichier), buffer)
  return `/uploads/${nomFichier}`
}

export async function sauvegarderFichierPrive(
  paroisseId: string,
  nomFichier: string,
  buffer: Buffer,
  contentType: string,
): Promise<string> {
  if (utiliseS3()) {
    await getClientS3().send(
      new PutObjectCommand({ Bucket: bucketS3(), Key: cleFichierPrive(paroisseId, nomFichier), Body: buffer, ContentType: contentType }),
    )
  } else {
    const dossier = path.join(process.cwd(), 'uploads-prives', paroisseId)
    await mkdir(dossier, { recursive: true })
    await writeFile(path.join(dossier, nomFichier), buffer)
  }

  return `/api/fichiers/${paroisseId}/${nomFichier}`
}

export async function lireFichierPrive(paroisseId: string, nomFichier: string): Promise<Buffer> {
  if (utiliseS3()) {
    const resultat = await getClientS3().send(
      new GetObjectCommand({ Bucket: bucketS3(), Key: cleFichierPrive(paroisseId, nomFichier) }),
    )
    const bytes = await resultat.Body!.transformToByteArray()
    return Buffer.from(bytes)
  }

  const chemin = path.join(process.cwd(), 'uploads-prives', paroisseId, nomFichier)
  return readFile(chemin)
}
