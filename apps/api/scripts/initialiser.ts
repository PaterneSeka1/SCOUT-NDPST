// Initialisation de l'installation (identité de LA paroisse et premiers comptes).
//
//   npm run initialiser               # base NEUVE : identité, administrateur et Chef de Groupe
//   npm run initialiser -- --admin    # base EXISTANTE sans administrateur actif (par
//                                     # exemple après la migration mono-paroissiale) :
//                                     # crée seulement un compte administrateur
//
// Interactif (à lancer dans un terminal SSH) : les mots de passe sont saisis
// sans écho, jamais passés en argument ni en variable d'environnement (ils
// finiraient dans l'historique du shell ou la liste des processus).
// L'identité de la paroisse est une configuration unique : ce script la
// complète, il n'en crée jamais une seconde.

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

interface Compte {
  nom: string
  prenom: string
  matricule: string
  telephone: string
  email: string
}

async function compte(intitule: string): Promise<Compte> {
  console.log(`\n— ${intitule}`)
  return {
    nom: await question('Nom'),
    prenom: await question('Prénom'),
    matricule: await question('Matricule (identifiant de connexion)'),
    telephone: await question('Téléphone', { optionnel: true }),
    email: await question('E-mail', { optionnel: true }),
  }
}

async function main() {
  const url = process.env.DATABASE_URL?.trim()
  if (!url) throw new Error('DATABASE_URL est manquant (apps/api/.env).')
  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) })
  const adminSeul = process.argv.includes('--admin')

  try {
    if (adminSeul) {
      if ((await prisma.utilisateur.count({ where: { role: 'ADMINISTRATEUR', actif: true } })) > 0) {
        throw new Error('Un administrateur actif existe déjà : créez les autres comptes depuis l’application.')
      }
      console.log('\n=== Création d’un compte administrateur ===')
      const admin = await compte('Administrateur (gestion technique de la plateforme)')
      const motDePasseAdmin = await motDePasse('l’administrateur')
      const cree = await prisma.utilisateur.create({
        data: {
          nom: admin.nom,
          prenom: admin.prenom,
          matricule: admin.matricule,
          telephone: admin.telephone || null,
          email: admin.email || null,
          password: await hash(motDePasseAdmin, 12),
          role: 'ADMINISTRATEUR',
        },
      })
      await prisma.journalAudit.create({
        data: { action: 'UTILISATEUR_CREE', entite: 'Utilisateur', entiteId: cree.id, details: { role: 'ADMINISTRATEUR', origine: 'initialiser --admin' } },
      })
      console.log(`\nAdministrateur créé : connexion avec le matricule ${admin.matricule}.`)
      return
    }

    if ((await prisma.utilisateur.count()) > 0) {
      throw new Error(
        'La base contient déjà des comptes : initialisation refusée (installation neuve uniquement, voir --admin).',
      )
    }

    console.log('\n=== Initialisation de SCOUT-NDPST ===')
    console.log('\n— Identité de la paroisse (modifiable ensuite dans Administration > Identité et configuration)')
    const identite = {
      nomParoisse: await question('Nom officiel de la paroisse'),
      nomGroupe: await question('Nom du groupe scout', { optionnel: true }),
      ville: await question('Ville', { optionnel: true }),
      diocese: await question('Diocèse', { optionnel: true }),
    }

    const admin = await compte('Administrateur (gestion technique : comptes, configuration, contenus)')
    const motDePasseAdmin = await motDePasse('l’administrateur')
    const chef = await compte('Chef de Groupe (direction scoute du groupe)')
    if (chef.matricule === admin.matricule) throw new Error('Les deux comptes doivent avoir des matricules différents.')
    const motDePasseChef = await motDePasse('le Chef de Groupe')

    const [hashAdmin, hashChef] = await Promise.all([hash(motDePasseAdmin, 12), hash(motDePasseChef, 12)])

    await prisma.$transaction(async (tx) => {
      await tx.configurationInstallation.upsert({
        where: { id: 'installation' },
        create: {
          id: 'installation',
          nomParoisse: identite.nomParoisse,
          nomGroupe: identite.nomGroupe,
          ville: identite.ville || null,
          diocese: identite.diocese || null,
        },
        update: {
          nomParoisse: identite.nomParoisse,
          nomGroupe: identite.nomGroupe,
          ville: identite.ville || null,
          diocese: identite.diocese || null,
        },
      })
      await tx.utilisateur.create({
        data: {
          nom: admin.nom,
          prenom: admin.prenom,
          matricule: admin.matricule,
          telephone: admin.telephone || null,
          email: admin.email || null,
          password: hashAdmin,
          role: 'ADMINISTRATEUR',
        },
      })
      const chefCree = await tx.utilisateur.create({
        data: {
          nom: chef.nom,
          prenom: chef.prenom,
          matricule: chef.matricule,
          telephone: chef.telephone || null,
          email: chef.email || null,
          password: hashChef,
          doitChangerMotDePasse: true,
          role: 'CHEF_GROUPE',
        },
      })
      await tx.mandat.create({
        data: { utilisateurId: chefCree.id, role: 'CHEF_GROUPE', motif: 'Initialisation de l’installation' },
      })
      await tx.journalAudit.create({
        data: {
          action: 'PLATEFORME_INITIALISEE',
          entite: 'ConfigurationInstallation',
          entiteId: 'installation',
          details: { nomParoisse: identite.nomParoisse },
        },
      })
    })

    console.log(`\nInitialisation terminée pour « ${identite.nomParoisse} ».`)
    console.log(`Administrateur : matricule ${admin.matricule}. Chef de Groupe : matricule ${chef.matricule}.`)
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
