// Script de bascule PONCTUEL — à exécuter UNE SEULE FOIS sur l'environnement
// de production existant, après que la migration Prisma
// "multi_paroisse_fondations" a été appliquée et validée.
//
// Convertit le compte ADMIN_PAROISSE désigné en ADMIN_PLATEFORME (rôle
// global, non rattaché à une paroisse — paroisseId devient NULL), et importe
// l'ancien config/site.json (s'il existe encore sur le disque) dans la
// nouvelle table ConfigurationPlateforme.
//
// Le matricule du compte à basculer doit être fourni explicitement (pas de
// sélection automatique "le seul compte ADMIN_PAROISSE trouvé") : cette
// opération touche un compte réel en production, elle ne doit jamais reposer
// sur une heuristique.
//
// Usage :
//   MATRICULE_ADMIN=<matricule> npx ts-node --compiler-options '{"module":"CommonJS"}' prisma/migrate-admin-plateforme.ts
//
// Étape suivante, volontairement NON automatisée ici (décision humaine) :
// désigner le Chef de Groupe de la paroisse depuis /admin/paroisses une fois
// connecté avec ce compte.

import 'dotenv/config'
import { Client } from 'pg'
import { readFile } from 'fs/promises'
import path from 'path'

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL est manquant.')
}

const matricule = process.env.MATRICULE_ADMIN
if (!matricule) {
  console.error('Usage : MATRICULE_ADMIN=<matricule du compte à promouvoir> npx ts-node --compiler-options \'{"module":"CommonJS"}\' prisma/migrate-admin-plateforme.ts')
  process.exit(1)
}

const client = new Client({ connectionString: process.env.DATABASE_URL })

async function importerConfigurationPlateforme() {
  let cfg: Record<string, any>
  try {
    const raw = await readFile(path.join(process.cwd(), 'config', 'site.json'), 'utf-8')
    cfg = JSON.parse(raw)
  } catch {
    console.log('→ config/site.json introuvable ou illisible : ConfigurationPlateforme non pré-rempli (valeurs par défaut utilisées).')
    return
  }

  await client.query(
    `INSERT INTO "ConfigurationPlateforme"
       (id, "nomSite", "sousTitreSite", "logoUrl", "couleurPrimaire", "couleurAccent", "couleurFond", "couleurHover",
        "heroBadge", "heroTitre", "heroSousTitre", "heroImageUrl", "heroImageAlt", "stats", "updatedAt")
     VALUES ('platform', $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, NOW())
     ON CONFLICT (id) DO UPDATE SET
       "nomSite" = EXCLUDED."nomSite", "sousTitreSite" = EXCLUDED."sousTitreSite", "logoUrl" = EXCLUDED."logoUrl",
       "couleurPrimaire" = EXCLUDED."couleurPrimaire", "couleurAccent" = EXCLUDED."couleurAccent",
       "couleurFond" = EXCLUDED."couleurFond", "couleurHover" = EXCLUDED."couleurHover",
       "heroBadge" = EXCLUDED."heroBadge", "heroTitre" = EXCLUDED."heroTitre", "heroSousTitre" = EXCLUDED."heroSousTitre",
       "heroImageUrl" = EXCLUDED."heroImageUrl", "heroImageAlt" = EXCLUDED."heroImageAlt", "stats" = EXCLUDED."stats",
       "updatedAt" = NOW()`,
    [
      cfg.nomSite ?? 'SCOUT ASCCI',
      cfg.sousTitreSite ?? "Côte d'Ivoire",
      cfg.logoSite || null,
      cfg.theme?.couleurPrimaire ?? '#1a4731',
      cfg.theme?.couleurAccent ?? '#27ae60',
      cfg.theme?.couleurFond ?? '#0f2418',
      cfg.theme?.couleurHover ?? '#27ae60',
      cfg.hero?.badge ?? null,
      cfg.hero?.titre ?? null,
      cfg.hero?.sousTitre ?? null,
      cfg.hero?.imageUrl ?? null,
      cfg.hero?.imageAlt ?? null,
      JSON.stringify(cfg.stats ?? null),
    ],
  )
  console.log('→ config/site.json importé dans ConfigurationPlateforme.')
}

async function main() {
  await client.connect()

  const { rows } = await client.query(
    `SELECT id, matricule, nom, prenom, role, "paroisseId" FROM "Utilisateur" WHERE matricule = $1`,
    [matricule],
  )
  const compte = rows[0]

  if (!compte) {
    console.error(`Aucun compte avec le matricule "${matricule}".`)
    process.exit(1)
  }
  if (compte.role !== 'ADMIN_PAROISSE') {
    console.error(`Le compte "${matricule}" a le rôle "${compte.role}", pas "ADMIN_PAROISSE" — bascule annulée par sécurité.`)
    process.exit(1)
  }

  console.log(`Compte trouvé : ${compte.prenom} ${compte.nom} (${compte.matricule}), actuellement rattaché à la paroisse ${compte.paroisseId}.`)

  await client.query(
    `UPDATE "Utilisateur" SET role = 'ADMIN_PLATEFORME', "paroisseId" = NULL, "updatedAt" = NOW() WHERE id = $1`,
    [compte.id],
  )
  console.log('→ Compte basculé en ADMIN_PLATEFORME (paroisseId = NULL).')

  await importerConfigurationPlateforme()

  console.log('\nBascule terminée avec succès.')
  console.log('Étape suivante (manuelle) : connectez-vous avec ce compte et désignez un Chef de Groupe pour la paroisse depuis /admin/paroisses.')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await client.end()
  })
