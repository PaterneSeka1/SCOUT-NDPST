// Initialisation d'une installation NEUVE (base vide) : crée en une seule
// transaction le compte administrateur plateforme (sauf --sans-admin), le
// district, la paroisse et son Chef de Groupe. Le frontend paroissial n'a pas d'écrans
// d'administration : c'est le seul moyen prévu pour amorcer la plateforme.
//
// Interactif (à lancer dans un terminal SSH) : les mots de passe sont saisis
// sans écho, jamais passés en argument ni en variable d'environnement (ils
// finiraient dans l'historique du shell ou la liste des processus).
// Refuse de s'exécuter si la base contient déjà un compte.
//
// Usage, depuis apps/api avec son .env chargé :
//   corepack pnpm initialiser                # installation qui héberge l'administrateur (district)
//   corepack pnpm initialiser --sans-admin   # installation administrée à distance (paroisse)

import 'dotenv/config'
import { createInterface } from 'readline'
import { hash } from 'bcryptjs'
import { PrismaPg } from '@prisma/adapter-pg'
import { motDePasseValide, REGLE_MOT_DE_PASSE } from '@scout/shared'
import { PrismaClient } from '../src/generated/prisma/client'

const estTerminal = !!process.stdin.isTTY
const lecteur = createInterface({ input: process.stdin, output: process.stdout, terminal: estTerminal })

// Écho des caractères tapés coupé pendant la saisie d'un mot de passe.
let echoCoupe = false
const interne = lecteur as unknown as { _writeToOutput: (texte: string) => void }
const ecrireOriginal = interne._writeToOutput.bind(lecteur)
interne._writeToOutput = (texte: string) => {
  if (!echoCoupe) ecrireOriginal(texte)
}

// File des lignes reçues : aucune réponse n'est perdue, même quand plusieurs
// lignes arrivent d'un coup (saisie collée, entrée redirigée).
const tampon: string[] = []
const enAttente: ((ligne: string | null) => void)[] = []
let entreeFermee = false
lecteur.on('line', (ligne) => {
  const attente = enAttente.shift()
  if (attente) attente(ligne)
  else tampon.push(ligne)
})
lecteur.on('close', () => {
  entreeFermee = true
  for (const attente of enAttente.splice(0)) attente(null)
})

async function lireLigne(invite: string, masque = false): Promise<string> {
  process.stdout.write(invite)
  echoCoupe = masque && estTerminal
  const ligne =
    tampon.length > 0
      ? tampon.shift()!
      : entreeFermee
        ? null
        : await new Promise<string | null>((resoudre) => enAttente.push(resoudre))
  echoCoupe = false
  if (masque || !estTerminal) process.stdout.write('\n')
  if (ligne === null) throw new Error('Saisie interrompue.')
  return ligne
}

async function question(intitule: string, { optionnel = false } = {}): Promise<string> {
  for (;;) {
    const valeur = (await lireLigne(`${intitule}${optionnel ? ' (facultatif)' : ''} : `)).trim()
    if (valeur || optionnel) return valeur
    console.log('  Valeur obligatoire.')
  }
}

function saisieMasquee(intitule: string): Promise<string> {
  return lireLigne(`${intitule} : `, true)
}

async function motDePasse(pour: string): Promise<string> {
  for (;;) {
    const premier = await saisieMasquee(`Mot de passe de ${pour}`)
    if (!motDePasseValide(premier)) {
      console.log(`  ${REGLE_MOT_DE_PASSE}`)
      continue
    }
    const confirmation = await saisieMasquee('Confirmation')
    if (premier === confirmation) return premier
    console.log('  Les mots de passe ne correspondent pas.')
  }
}

async function main() {
  const url = process.env.DATABASE_URL?.trim()
  if (!url) throw new Error('DATABASE_URL est manquant (apps/api/.env).')
  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) })

  try {
    if ((await prisma.utilisateur.count()) > 0 || (await prisma.paroisse.count()) > 0) {
      throw new Error('La base contient déjà des comptes ou des paroisses : initialisation refusée (installation neuve uniquement).')
    }

    console.log('\n=== Initialisation de SCOUT ASCCI ===\n')
    // --sans-admin : installation administrée par l'administrateur plateforme
    // d'une autre installation (district), dont elle accepte les jetons.
    const avecAdmin = !process.argv.includes('--sans-admin')
    let admin: { nom: string; prenom: string; matricule: string; email: string; password: string } | null = null
    if (avecAdmin) {
      console.log('— Administrateur plateforme (se connecte à l’application district)')
      admin = {
        nom: await question('Nom'),
        prenom: await question('Prénom'),
        matricule: await question('Matricule (identifiant de connexion)'),
        email: await question('E-mail', { optionnel: true }),
        password: await motDePasse('l’administrateur'),
      }
    } else {
      console.log('— Sans compte administrateur local : administration depuis l’installation district')
    }

    console.log('\n— District et paroisse')
    const nomDistrict = await question('Nom du district')
    const paroisse = {
      nom: await question('Nom de la paroisse'),
      ville: await question('Ville'),
      diocese: await question('Diocèse'),
    }

    console.log('\n— Chef de Groupe (administrateur de la paroisse dans le frontend)')
    const chef = {
      nom: await question('Nom'),
      prenom: await question('Prénom'),
      matricule: await question('Matricule (identifiant de connexion)'),
      telephone: await question('Téléphone', { optionnel: true }),
      email: await question('E-mail', { optionnel: true }),
    }
    if (chef.matricule === admin?.matricule) throw new Error('Les deux comptes doivent avoir des matricules différents.')
    const passwordChef = await motDePasse('le Chef de Groupe')

    const [hashAdmin, hashChef] = await Promise.all([admin ? hash(admin.password, 12) : null, hash(passwordChef, 12)])

    const resultat = await prisma.$transaction(async (tx) => {
      if (admin && hashAdmin) {
        await tx.utilisateur.create({
          data: {
            nom: admin.nom,
            prenom: admin.prenom,
            matricule: admin.matricule,
            email: admin.email || null,
            password: hashAdmin,
            role: 'ADMIN_PLATEFORME',
          },
        })
      }
      const district = await tx.district.create({ data: { nom: nomDistrict } })
      const nouvelleParoisse = await tx.paroisse.create({ data: { ...paroisse, districtId: district.id } })
      await tx.utilisateur.create({
        data: {
          nom: chef.nom,
          prenom: chef.prenom,
          matricule: chef.matricule,
          telephone: chef.telephone || null,
          email: chef.email || null,
          password: hashChef,
          role: 'CHEF_GROUPE',
          paroisseId: nouvelleParoisse.id,
        },
      })
      await tx.journalAudit.create({
        data: {
          paroisseId: nouvelleParoisse.id,
          action: 'PLATEFORME_INITIALISEE',
          entite: 'Paroisse',
          entiteId: nouvelleParoisse.id,
          details: { district: nomDistrict },
        },
      })
      return nouvelleParoisse
    })

    console.log(`\nInitialisation terminée : paroisse « ${resultat.nom} » créée.`)
    console.log(`Le Chef de Groupe se connecte au frontend avec le matricule ${chef.matricule}.`)
  } finally {
    await prisma.$disconnect()
    lecteur.close()
  }
}

main().catch((erreur) => {
  console.error(`\nÉchec : ${erreur instanceof Error ? erreur.message : String(erreur)}`)
  lecteur.close()
  process.exit(1)
})
