// Seed — Application SCOUT ASCCI
// Crée uniquement le compte administrateur plateforme (rôle global,
// ADMIN_PLATEFORME, non rattaché à une paroisse — paroisseId reste NULL) afin
// de pouvoir se connecter une première fois et créer les paroisses (avec leur
// Chef de Groupe) depuis la zone /admin de l'application elle-même.
//
// Idempotent : peut être relancé sans dupliquer les données (upsert sur "id").
// Personnalisable via variables d'environnement (voir .env.example) — sinon
// des valeurs par défaut sont utilisées.
//
// Utilise `pg` directement (et non le client Prisma généré) car le client Prisma 7
// généré ici est un module ESM (`import.meta.url`) incompatible avec l'exécution
// CommonJS de `ts-node` utilisée par `prisma db seed`.

import { Client } from 'pg'
import { hash } from 'bcryptjs'

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL est manquant.')
}

const client = new Client({ connectionString: process.env.DATABASE_URL })

type Val = string | number | boolean | Date | null
type ColumnValue = { name: string; value: Val; cast?: string }

async function upsert(table: string, columns: ColumnValue[]): Promise<Record<string, any>> {
  const colNames = columns.map((c) => c.name)
  const placeholders = columns.map((c, i) => `$${i + 1}${c.cast ? `::${c.cast}` : ''}`)

  const colsSql = [...colNames.map((n) => `"${n}"`), '"createdAt"', '"updatedAt"'].join(', ')
  const valsSql = [...placeholders, 'NOW()', 'NOW()'].join(', ')

  const updateColumns = colNames.filter((n) => n !== 'id')
  const setSql = [...updateColumns.map((c) => `"${c}" = EXCLUDED."${c}"`), `"updatedAt" = NOW()`]

  const sql = `
    INSERT INTO "${table}" (${colsSql})
    VALUES (${valsSql})
    ON CONFLICT (id) DO UPDATE SET ${setSql.join(', ')}
    RETURNING *
  `
  const values = columns.map((c) => c.value)
  const { rows } = await client.query(sql, values)
  return rows[0]
}

// Référentiel officiel du parcours de progression individuelle des Compagnons
// (voir PROMPT_INTEGRATION_PROGRESSION_ROUTIER.md). Durées en mois calendaires,
// variables selon la tranche d'âge d'entrée (18/19/20 ans). Id dérivé du code
// (stable) plutôt que généré aléatoirement : le seed doit rester idempotent
// sans dépendre du client Prisma (voir commentaire en tête de fichier).
const REFERENTIEL_PARCOURS_COMPAGNON: Array<{
  code: string
  nom: string
  etape: string
  ordre: number
  type: 'DUREE' | 'EVENEMENT'
  dureeDixHuitAns: number
  dureeDixNeufAns: number
  dureeVingtAns: number
  nomAttribut: string
}> = [
  { code: 'ROUTE_ACCUEIL', nom: 'Accueil', etape: 'NOVICIAT', ordre: 1, type: 'EVENEMENT', dureeDixHuitAns: 0, dureeDixNeufAns: 0, dureeVingtAns: 0, nomAttribut: 'Foulard' },
  { code: 'ROUTE_ASPIRANT', nom: 'Aspirant routier', etape: 'NOVICIAT', ordre: 2, type: 'DUREE', dureeDixHuitAns: 1, dureeDixNeufAns: 1, dureeVingtAns: 1, nomAttribut: 'Flots gris' },
  { code: 'ROUTE_ENGAGEMENT', nom: 'Engagement', etape: 'APPRENTISSAGE', ordre: 3, type: 'DUREE', dureeDixHuitAns: 3, dureeDixNeufAns: 3, dureeVingtAns: 1, nomAttribut: 'Insigne routier' },
  { code: 'ROUTE_MINI_CAMP', nom: 'Mini-camp', etape: 'APPRENTISSAGE', ordre: 4, type: 'DUREE', dureeDixHuitAns: 3, dureeDixNeufAns: 3, dureeVingtAns: 1, nomAttribut: 'Étoile marron' },
  { code: 'ROUTE_CEREMONIE_APPRENTISSAGE', nom: "Cérémonie de fin d'étape", etape: 'APPRENTISSAGE', ordre: 5, type: 'EVENEMENT', dureeDixHuitAns: 0, dureeDixNeufAns: 0, dureeVingtAns: 0, nomAttribut: 'Flots marrons' },
  { code: 'ROUTE_RAID', nom: 'Raid', etape: 'COMPAGNONNAGE', ordre: 6, type: 'DUREE', dureeDixHuitAns: 2, dureeDixNeufAns: 2, dureeVingtAns: 1, nomAttribut: 'Étoile blanche' },
  { code: 'ROUTE_ENTREPRISE', nom: 'Entreprise', etape: 'COMPAGNONNAGE', ordre: 7, type: 'DUREE', dureeDixHuitAns: 8, dureeDixNeufAns: 5, dureeVingtAns: 3, nomAttribut: "Label de domaine d'action" },
  { code: 'ROUTE_CEREMONIE_COMPAGNONNAGE', nom: "Cérémonie de fin d'étape", etape: 'COMPAGNONNAGE', ordre: 8, type: 'EVENEMENT', dureeDixHuitAns: 0, dureeDixNeufAns: 0, dureeVingtAns: 0, nomAttribut: 'Flots routiers' },
  { code: 'ROUTE_SERVICE', nom: 'Service', etape: 'DEPART_ROUTIER', ordre: 9, type: 'DUREE', dureeDixHuitAns: 6, dureeDixNeufAns: 3, dureeVingtAns: 1, nomAttribut: 'Étoile or' },
  { code: 'ROUTE_ENVOI', nom: 'Envoi', etape: 'DEPART_ROUTIER', ordre: 10, type: 'DUREE', dureeDixHuitAns: 3, dureeDixNeufAns: 1, dureeVingtAns: 1, nomAttribut: 'Bible' },
]

async function seedReferentielParcoursCompagnon() {
  for (const activite of REFERENTIEL_PARCOURS_COMPAGNON) {
    await upsert('EtapeParcoursCompagnon', [
      { name: 'id', value: `etape-${activite.code.toLowerCase().replaceAll('_', '-')}` },
      { name: 'code', value: activite.code },
      { name: 'nom', value: activite.nom },
      { name: 'etape', value: activite.etape, cast: '"EtapeCompagnon"' },
      { name: 'ordre', value: activite.ordre },
      { name: 'type', value: activite.type, cast: '"TypeActiviteParcours"' },
      { name: 'dureeDixHuitAns', value: activite.dureeDixHuitAns },
      { name: 'dureeDixNeufAns', value: activite.dureeDixNeufAns },
      { name: 'dureeVingtAns', value: activite.dureeVingtAns },
      { name: 'nomAttribut', value: activite.nomAttribut },
    ])
  }
}

async function main() {
  await client.connect()

  const motDePasse = process.env.ADMIN_PASSWORD ?? 'Admin1234!'
  const admin = await upsert('Utilisateur', [
    { name: 'id', value: 'utilisateur-admin' },
    { name: 'nom', value: process.env.ADMIN_NOM ?? 'Administrateur' },
    { name: 'prenom', value: process.env.ADMIN_PRENOM ?? 'Plateforme' },
    { name: 'matricule', value: process.env.ADMIN_MATRICULE ?? 'ADMIN001A' },
    { name: 'email', value: process.env.ADMIN_EMAIL ?? null },
    { name: 'password', value: await hash(motDePasse, 12) },
    { name: 'role', value: 'ADMIN_PLATEFORME', cast: '"RoleUtilisateur"' },
    { name: 'paroisseId', value: null },
  ])

  await seedReferentielParcoursCompagnon()

  console.log('\nSeed terminé avec succès.')
  console.log(`  Admin plateforme → matricule: ${admin.matricule}  /  mot de passe: ${motDePasse}`)
  console.log('  Connectez-vous puis créez vos paroisses depuis /admin/paroisses.')
  console.log(`  Référentiel parcours Compagnons : ${REFERENTIEL_PARCOURS_COMPAGNON.length} activités seedées.`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await client.end()
  })
