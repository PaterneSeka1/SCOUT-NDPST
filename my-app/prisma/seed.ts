import { PrismaClient } from '../app/generated/prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { hash } from 'bcryptjs'

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! })
const prisma = new PrismaClient({ adapter })

async function main() {
  const paroisse = await prisma.paroisse.upsert({
    where: { email: 'saint-paul-cocody@ascci.ci' },
    update: {},
    create: {
      nom: 'Paroisse Saint-Paul de Cocody',
      ville: 'Abidjan',
      diocese: "Diocèse d'Abidjan",
      adresse: 'Cocody, Abidjan',
      email: 'saint-paul-cocody@ascci.ci',
    },
  })

  console.log(`Paroisse créée : ${paroisse.nom} (${paroisse.id})`)

  const passwordAdmin = await hash('Admin1234!', 12)
  const admin = await prisma.utilisateur.upsert({
    where: { matricule: 'ADMIN001A' },
    update: {},
    create: {
      nom: 'Administrateur',
      prenom: 'Super',
      matricule: 'ADMIN001A',
      email: 'admin@scout-test.ci',
      password: passwordAdmin,
      role: 'ADMIN_PAROISSE',
      paroisseId: paroisse.id,
    },
  })

  console.log(`Utilisateur admin créé : ${admin.matricule}`)

  const passwordChef = await hash('Chef1234!', 12)
  const chef = await prisma.utilisateur.upsert({
    where: { matricule: '0545247O' },
    update: {},
    create: {
      nom: 'Kouassi',
      prenom: 'Jean-Baptiste',
      matricule: '0545247O',
      email: 'chef@scout-test.ci',
      password: passwordChef,
      role: 'CHEF_GROUPE',
      paroisseId: paroisse.id,
    },
  })

  console.log(`Utilisateur chef créé : ${chef.matricule}`)
  console.log('\nSeed terminé avec succès.')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
