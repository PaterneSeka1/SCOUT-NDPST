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

async function main() {
  // Développement uniquement : mot de passe par défaut affiché en clair. En
  // production, l'installation se fait avec `npm run initialiser`
  // (scripts/initialiser.ts), qui exige des mots de passe saisis à la main.
  if (process.env.NODE_ENV === 'production') {
    throw new Error('Seed interdit en production : utiliser `npm run initialiser` (apps/api).')
  }

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

  console.log('\nSeed terminé avec succès.')
  console.log(`  Admin plateforme → matricule: ${admin.matricule}  /  mot de passe: ${motDePasse}`)
  console.log('  Créez ensuite les paroisses via l’API (/api/admin/paroisses).')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await client.end()
  })
