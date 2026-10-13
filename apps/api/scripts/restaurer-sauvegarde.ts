// Récupère et déchiffre une sauvegarde de la base stockée dans R2. Produit un
// fichier .dump (format pg_restore) : la restauration dans une base reste une
// décision humaine, jamais automatique (voir docs/deploiement-ovh.md).
//
// Usage, depuis apps/api avec son .env chargé :
//   corepack pnpm restaurer-sauvegarde --lister
//   corepack pnpm restaurer-sauvegarde --derniere --sortie /chemin/base.dump
//   corepack pnpm restaurer-sauvegarde --cle base/2026/10/scout-....dump.chiffre --sortie /chemin/base.dump

import 'dotenv/config'
import { createHash } from 'crypto'
import { writeFile } from 'fs/promises'
import { GetObjectCommand, ListObjectsV2Command, type _Object } from '@aws-sdk/client-s3'
import { dechiffrerSauvegarde } from '../src/common/lib/chiffrement-sauvegarde'
import { configSauvegarde, PREFIXE_SAUVEGARDES } from './sauvegarde-config'

function argument(nom: string): string | undefined {
  const index = process.argv.indexOf(nom)
  return index >= 0 ? process.argv[index + 1] : undefined
}

async function main() {
  const { client, bucket, phrase } = configSauvegarde()

  const objets: _Object[] = []
  let suite: string | undefined
  do {
    const page = await client.send(
      new ListObjectsV2Command({ Bucket: bucket, Prefix: PREFIXE_SAUVEGARDES, ContinuationToken: suite }),
    )
    objets.push(...(page.Contents ?? []))
    suite = page.IsTruncated ? page.NextContinuationToken : undefined
  } while (suite)
  objets.sort((a, b) => (a.Key ?? '').localeCompare(b.Key ?? ''))

  if (process.argv.includes('--lister')) {
    for (const o of objets) console.log(`${o.Key}  ${Math.round((o.Size ?? 0) / 1024)} Ko`)
    console.log(`${objets.length} sauvegarde(s).`)
    return
  }

  const cle = process.argv.includes('--derniere') ? objets.at(-1)?.Key : argument('--cle')
  const sortie = argument('--sortie')
  if (!cle) throw new Error('Préciser --derniere ou --cle <clé> (voir --lister).')
  if (!sortie) throw new Error('Préciser --sortie <fichier.dump>.')

  const reponse = await client.send(new GetObjectCommand({ Bucket: bucket, Key: cle }))
  const contenu = Buffer.from(await reponse.Body!.transformToByteArray())
  const vidage = await dechiffrerSauvegarde(contenu, phrase)

  const attendue = reponse.Metadata?.sha256
  const obtenue = createHash('sha256').update(vidage).digest('hex')
  if (attendue && attendue !== obtenue) throw new Error('Empreinte différente de celle enregistrée : sauvegarde corrompue.')

  // Données personnelles : fichier lisible par le seul propriétaire.
  await writeFile(sortie, vidage, { mode: 0o600 })
  console.log(`Sauvegarde ${cle} déchiffrée dans ${sortie} (${Math.round(vidage.length / 1024)} Ko, empreinte vérifiée).`)
  console.log('Restauration (décision humaine, base cible à choisir avec soin) :')
  console.log(`  docker exec -i scout_db pg_restore -U scout -d <base_cible> --clean --if-exists < ${sortie}`)
}

main().catch((erreur) => {
  console.error(`Échec : ${erreur instanceof Error ? erreur.message : String(erreur)}`)
  process.exit(1)
})
