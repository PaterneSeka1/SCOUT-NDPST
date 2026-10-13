// Configuration commune aux scripts de sauvegarde et de restauration de la base.
import { S3Client } from '@aws-sdk/client-s3'

export const PREFIXE_SAUVEGARDES = 'base/'

function lire(cle: string): string | undefined {
  return process.env[cle]?.trim() || undefined
}

export function requis(cle: string): string {
  const valeur = lire(cle)
  if (!valeur) throw new Error(`${cle} est requis (voir apps/api/.env.example).`)
  return valeur
}

// Bucket dédié aux sauvegardes, jamais public. Les identifiants R2 du stockage
// des fichiers sont réutilisés, sauf si des identifiants propres aux
// sauvegardes sont fournis (jeton limité à ce seul bucket, recommandé).
export function configSauvegarde() {
  const client = new S3Client({
    region: lire('STORAGE_S3_REGION') ?? 'auto',
    endpoint: lire('SAUVEGARDE_S3_ENDPOINT') ?? lire('STORAGE_S3_ENDPOINT'),
    forcePathStyle: (lire('SAUVEGARDE_S3_FORCE_PATH_STYLE') ?? lire('STORAGE_S3_FORCE_PATH_STYLE')) === 'true',
    requestChecksumCalculation: 'WHEN_REQUIRED',
    responseChecksumValidation: 'WHEN_REQUIRED',
    credentials: {
      accessKeyId: lire('SAUVEGARDE_S3_ACCESS_KEY_ID') ?? requis('STORAGE_S3_ACCESS_KEY_ID'),
      secretAccessKey: lire('SAUVEGARDE_S3_SECRET_ACCESS_KEY') ?? requis('STORAGE_S3_SECRET_ACCESS_KEY'),
    },
  })
  const bucket = requis('SAUVEGARDE_S3_BUCKET')
  if (bucket === lire('STORAGE_S3_BUCKET_PUBLIC')) {
    throw new Error('SAUVEGARDE_S3_BUCKET ne doit jamais être le bucket public des fichiers.')
  }
  return { client, bucket, phrase: requis('SAUVEGARDE_PHRASE') }
}
