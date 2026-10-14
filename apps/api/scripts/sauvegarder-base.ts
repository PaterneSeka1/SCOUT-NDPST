// Sauvegarde de la base PostgreSQL vers Cloudflare R2, chiffrée sur le VPS
// avant l'envoi. Aucune copie n'est conservée sur le VPS.
//
// - Lancée chaque jour par cron (voir docs/deploiement-ovh.md) et par
//   deploy-ovh.sh avant chaque migration (--motif avant-migration).
// - Le vidage est fait dans le conteneur PostgreSQL (pg_dump, format
//   personnalisé compressé) : aucun client PostgreSQL n'est requis sur l'hôte.
// - La durée de conservation se règle par une règle de cycle de vie sur le
//   bucket R2 : ce script n'efface jamais rien.
//
// Usage, depuis apps/api avec son .env chargé :
//   npm run sauvegarder [-- --motif avant-migration]
// Code de sortie non nul en cas d'échec (cron et deploy-ovh.sh s'y fient).

import 'dotenv/config'
import { spawn } from 'child_process'
import { createHash } from 'crypto'
import { HeadObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3'
import { chiffrerSauvegarde } from '../src/common/lib/chiffrement-sauvegarde'
import { echapperHtml, envoyerEmailBrut } from '../src/common/lib/email'
import { configSauvegarde, PREFIXE_SAUVEGARDES } from './sauvegarde-config'

const CONTENEUR = process.env.SAUVEGARDE_CONTENEUR?.trim() || 'scout_db'

function argument(nom: string): string | undefined {
  const index = process.argv.indexOf(nom)
  return index >= 0 ? process.argv[index + 1] : undefined
}

function vider(): Promise<Buffer> {
  return new Promise((resoudre, rejeter) => {
    const pgDump = spawn('docker', ['exec', CONTENEUR, 'pg_dump', '-U', 'scout', '-Fc', 'scout_db'])
    const morceaux: Buffer[] = []
    let erreurs = ''
    pgDump.stdout.on('data', (morceau: Buffer) => morceaux.push(morceau))
    pgDump.stderr.on('data', (morceau: Buffer) => (erreurs += morceau.toString()))
    pgDump.on('error', rejeter)
    pgDump.on('close', (code) => {
      const vidage = Buffer.concat(morceaux)
      // Un vidage au format personnalisé commence toujours par « PGDMP ».
      if (code !== 0 || !vidage.subarray(0, 5).equals(Buffer.from('PGDMP'))) {
        rejeter(new Error(`pg_dump a échoué (code ${code}) : ${erreurs.trim() || 'sortie invalide'}`))
      } else {
        resoudre(vidage)
      }
    })
  })
}

async function main() {
  const { client, bucket, phrase } = configSauvegarde()
  const motif = argument('--motif')
    ?.replace(/[^a-z0-9-]/gi, '')
    .slice(0, 40)

  const debut = Date.now()
  const vidage = await vider()
  const empreinte = createHash('sha256').update(vidage).digest('hex')
  const chiffre = await chiffrerSauvegarde(vidage, phrase)

  const horodatage = new Date().toISOString().replace(/[-:]/g, '').replace(/\..*/, '').replace('T', '-')
  const cle = `${PREFIXE_SAUVEGARDES}${horodatage.slice(0, 4)}/${horodatage.slice(4, 6)}/scout-${horodatage}${motif ? `-${motif}` : ''}.dump.chiffre`

  await client.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: cle,
      Body: chiffre,
      ContentType: 'application/octet-stream',
      // Empreinte du vidage EN CLAIR : vérifiée à la restauration.
      Metadata: { sha256: empreinte },
    }),
  )

  // Contrôle : l'objet est bien arrivé, entier.
  const tete = await client.send(new HeadObjectCommand({ Bucket: bucket, Key: cle }))
  if (tete.ContentLength !== chiffre.length) {
    throw new Error(`Sauvegarde incomplète dans R2 (${tete.ContentLength} octets sur ${chiffre.length}).`)
  }

  console.log(
    JSON.stringify({
      horodatage: new Date().toISOString(),
      evenement: 'sauvegarde.terminee',
      cle,
      octets: chiffre.length,
      dureeMs: Date.now() - debut,
    }),
  )
}

// Une sauvegarde qui échoue sans que personne ne le sache n'est découverte
// qu'au moment d'en avoir besoin : alerte par e-mail si SAUVEGARDE_ALERTE_EMAIL
// est renseigné (SMTP de l'API). L'alerte ne contient que la cause technique.
async function alerter(message: string) {
  const destinataire = process.env.SAUVEGARDE_ALERTE_EMAIL?.trim()
  if (!destinataire) return
  const installation = process.env.INSTALLATION_ID?.trim() || 'installation inconnue'
  await envoyerEmailBrut(
    destinataire,
    `[SCOUT ASCCI] Échec de la sauvegarde (${installation})`,
    `<p>La sauvegarde de la base de l'installation <strong>${echapperHtml(installation)}</strong> a échoué le ${new Date().toISOString()}.</p>` +
      `<p>Cause : <code>${echapperHtml(message)}</code></p>` +
      `<p>Vérifier sur le serveur : <code>tail ~/sauvegarde-*.log</code>, puis relancer <code>npm run sauvegarder</code> dans apps/api.</p>`,
  )
}

main().catch(async (erreur) => {
  const message = erreur instanceof Error ? erreur.message : String(erreur)
  console.error(JSON.stringify({ horodatage: new Date().toISOString(), evenement: 'sauvegarde.echec', message }))
  await alerter(message).catch(() => undefined)
  process.exit(1)
})
