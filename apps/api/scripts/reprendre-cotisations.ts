// Aucune configuration .env chargée. La première recette est volontairement
// limitée à une base jetable nommée explicitement, jamais la production.
import { chargerEnv } from '../src/config/env'
import { PrismaService } from '../src/prisma/prisma.service'
import { appliquerReprise, planifierReprise } from '../src/modules/adhesions-nationales/reprise-cotisations'
async function main() {
  const raw = process.env.SCOUT_REPRISE_DATABASE_URL
  if (!raw) throw new Error('SCOUT_REPRISE_DATABASE_URL explicite requis')
  const url = new URL(raw)
  if (
    !['postgres:', 'postgresql:'].includes(url.protocol) ||
    !['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname) ||
    !/^scout_test_integration_adhesions[a-z0-9_]*$/.test(url.pathname.slice(1)) ||
    url.search ||
    url.hash ||
    !url.username
  )
    throw new Error('Base de recette des adhésions sur loopback requise')
  for (const cle of ['PGHOSTADDR', 'PGSERVICE', 'PGSERVICEFILE', 'PGOPTIONS']) delete process.env[cle]
  chargerEnv({
    NODE_ENV: 'test',
    DATABASE_URL: raw,
    JWT_ACCESS_SECRET: 'reprise-synthetique-'.repeat(4),
    INSTALLATION_ID: 'recette-reprise',
  })
  const prisma = new PrismaService()
  try {
    const plan = await planifierReprise(prisma)
    if (!process.argv.includes('--appliquer')) {
      console.log(JSON.stringify({ mode: 'simulation', ...plan.rapport }))
      return
    }
    const argument = (nom: string) => {
      const i = process.argv.indexOf(nom)
      return i < 0 ? undefined : process.argv[i + 1]
    }
    const acteur = argument('--acteur'),
      empreinte = argument('--empreinte'),
      sauvegarde = argument('--sauvegarde-verifiee')
    if (!acteur || !empreinte || !sauvegarde)
      throw new Error('--acteur, --empreinte et --sauvegarde-verifiee requis après restauration vérifiée')
    console.log(JSON.stringify(await appliquerReprise(prisma, acteur, empreinte)))
  } finally {
    await prisma.$disconnect()
  }
}
main().catch(() => {
  console.error('Reprise non aboutie : vérifier la cible, le plan, les habilitations et les journaux.')
  process.exitCode = 1
})
