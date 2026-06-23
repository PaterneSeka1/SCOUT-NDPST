import { Client } from 'pg'
import { hash } from 'bcryptjs'

const client = new Client({ connectionString: process.env.DATABASE_URL })

async function upsertUtilisateur(input: {
  id: string
  nom: string
  prenom: string
  matricule?: string
  telephone?: string
  email?: string
  password: string
  role: string
  paroisseId: string
  conflictColumn: 'matricule' | 'telephone'
}) {
  const result = await client.query(
    `
      INSERT INTO "Utilisateur" (
        "id", "nom", "prenom", "matricule", "telephone", "email",
        "password", "role", "paroisseId", "createdAt", "updatedAt"
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8::"RoleUtilisateur", $9, NOW(), NOW())
      ON CONFLICT (${input.conflictColumn})
      DO UPDATE SET
        "nom" = EXCLUDED."nom",
        "prenom" = EXCLUDED."prenom",
        "email" = EXCLUDED."email",
        "password" = EXCLUDED."password",
        "role" = EXCLUDED."role",
        "paroisseId" = EXCLUDED."paroisseId",
        "updatedAt" = NOW()
      RETURNING "matricule", "telephone"
    `,
    [
      input.id,
      input.nom,
      input.prenom,
      input.matricule ?? null,
      input.telephone ?? null,
      input.email ?? null,
      input.password,
      input.role,
      input.paroisseId,
    ],
  )

  return result.rows[0]
}

async function main() {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL est manquant.')
  }

  await client.connect()

  const paroisseResult = await client.query(
    `
      INSERT INTO "Paroisse" (
        "id", "nom", "ville", "diocese", "adresse", "email", "createdAt", "updatedAt"
      )
      VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())
      ON CONFLICT (email)
      DO UPDATE SET
        "nom" = EXCLUDED."nom",
        "ville" = EXCLUDED."ville",
        "diocese" = EXCLUDED."diocese",
        "adresse" = EXCLUDED."adresse",
        "updatedAt" = NOW()
      RETURNING "id", "nom"
    `,
    [
      'paroisse-saint-paul-cocody',
      'Paroisse Saint-Paul de Cocody',
      'Abidjan',
      "Diocèse d'Abidjan",
      'Cocody, Abidjan',
      'saint-paul-cocody@ascci.ci',
    ],
  )

  const paroisse = paroisseResult.rows[0]
  console.log(`Paroisse créée : ${paroisse.nom} (${paroisse.id})`)

  const passwordAdmin = await hash('Admin1234!', 12)
  const admin = await upsertUtilisateur({
    id: 'utilisateur-admin',
    nom: 'Administrateur',
    prenom: 'Super',
    matricule: 'ADMIN001A',
    email: 'admin@scout-test.ci',
    password: passwordAdmin,
    role: 'ADMIN_PAROISSE',
    paroisseId: paroisse.id,
    conflictColumn: 'matricule',
  })
  console.log(`Admin créé : matricule=${admin.matricule}`)

  const passwordChef = await hash('Chef1234!', 12)
  const chef = await upsertUtilisateur({
    id: 'utilisateur-chef-groupe',
    nom: 'Kouassi',
    prenom: 'Jean-Baptiste',
    matricule: '0545247O',
    email: 'chef@scout-test.ci',
    password: passwordChef,
    role: 'CHEF_GROUPE',
    paroisseId: paroisse.id,
    conflictColumn: 'matricule',
  })
  console.log(`Chef créé : matricule=${chef.matricule}`)

  const passwordParent = await hash('Parent1234!', 12)
  const parent = await upsertUtilisateur({
    id: 'utilisateur-parent',
    nom: 'Koné',
    prenom: 'Marie',
    telephone: '0712345678',
    password: passwordParent,
    role: 'PARENT',
    paroisseId: paroisse.id,
    conflictColumn: 'telephone',
  })
  console.log(`Parent créé : téléphone=${parent.telephone}`)
  console.log('\nSeed terminé avec succès.')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await client.end()
  })
