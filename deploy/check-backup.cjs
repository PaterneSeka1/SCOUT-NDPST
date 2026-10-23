// Exécuter depuis apps/api; aucun secret ou nom d'objet n'est journalisé.
require('dotenv/config')
require('ts-node/register/transpile-only')
const { ListObjectsV2Command } = require('@aws-sdk/client-s3')
const { configSauvegarde, PREFIXE_SAUVEGARDES } = require('../apps/api/scripts/sauvegarde-config.ts')

async function main() {
  const maxHours = Number(process.env.SCOUT_BACKUP_MAX_HOURS || 26)
  if (!Number.isFinite(maxHours) || maxHours <= 0) throw new Error('Délai de fraîcheur invalide')
  const { client, bucket } = configSauvegarde()
  let continuation
  let latest = 0
  do {
    const page = await client.send(new ListObjectsV2Command({
      Bucket: bucket, Prefix: PREFIXE_SAUVEGARDES, ContinuationToken: continuation,
    }))
    for (const object of page.Contents || []) {
      if (object.Key?.endsWith('.dump.chiffre') && object.Size > 0) {
        latest = Math.max(latest, object.LastModified?.getTime() || 0)
      }
    }
    continuation = page.IsTruncated ? page.NextContinuationToken : undefined
    if (page.IsTruncated && !continuation) throw new Error('Pagination incomplète')
  } while (continuation)
  const ageHours = (Date.now() - latest) / 3600000
  if (!latest || ageHours > maxHours || ageHours < -0.1) throw new Error('Sauvegarde absente ou périmée')
  console.log(JSON.stringify({ horodatage: new Date().toISOString(), evenement: 'sauvegarde.fraiche', ageHeures: Math.round(ageHours * 100) / 100 }))
}
main().catch(() => {
  console.error(JSON.stringify({ horodatage: new Date().toISOString(), evenement: 'sauvegarde.controle_echec' }))
  process.exitCode = 1
})
