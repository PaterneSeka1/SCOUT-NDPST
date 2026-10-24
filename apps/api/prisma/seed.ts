// Seed — SCOUT-NDPST (développement local uniquement)
// Crée le compte administrateur puis, sauf SEED_DEMO=false, un jeu de
// démonstration FICTIF couvrant chaque rôle de l'application : un compte par
// rôle de la maîtrise, un parent, un scout, un compte désactivé (refus de
// connexion attendu), des scouts de chaque branche, contacts d'urgence,
// activités (dont une publique), réunion, cotisations, un article et un
// événement historique de démonstration.
//
// L'identité de la paroisse n'est complétée que si elle est vide : un seed
// relancé n'écrase jamais une configuration réelle.
//
// Idempotent : peut être relancé sans dupliquer les données (upsert sur des
// "id" fixes préfixés « seed- »). Relancer remet les comptes de démonstration
// dans leur état initial (mot de passe, rôle).
// Personnalisable via variables d'environnement (voir .env.example).
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

// Colonnes d'horodatage absentes de certaines tables (LienParentScout et
// CategoriePublication n'ont que createdAt) : précisées par l'appelant.
async function upsert(
  table: string,
  columns: ColumnValue[],
  horodatage: string[] = ['createdAt', 'updatedAt'],
): Promise<Record<string, any>> {
  const colNames = columns.map((c) => c.name)
  const placeholders = columns.map((c, i) => `$${i + 1}${c.cast ? `::${c.cast}` : ''}`)

  const colsSql = [...colNames, ...horodatage].map((n) => `"${n}"`).join(', ')
  const valsSql = [...placeholders, ...horodatage.map(() => 'NOW()')].join(', ')

  const updateColumns = colNames.filter((n) => n !== 'id')
  const setSql = updateColumns.map((c) => `"${c}" = EXCLUDED."${c}"`)
  if (horodatage.includes('updatedAt')) setSql.push(`"updatedAt" = NOW()`)

  const sql = `
    INSERT INTO "${table}" (${colsSql})
    VALUES (${valsSql})
    ON CONFLICT (id) DO ${setSql.length ? `UPDATE SET ${setSql.join(', ')}` : 'NOTHING'}
    RETURNING *
  `
  const values = columns.map((c) => c.value)
  const { rows } = await client.query(sql, values)
  return rows[0]
}

// ---------------------------------------------------------------------------
// Jeu de démonstration (données fictives)
// ---------------------------------------------------------------------------

type CompteDemo = {
  id: string
  prenom: string
  role: string
  matricule?: string
  telephone?: string
  brancheType?: string
  actif?: boolean
  editeurContenu?: boolean
  fonctionPublique?: string
}

const COMPTES: CompteDemo[] = [
  {
    id: 'seed-u-chef',
    prenom: 'Chef de Groupe',
    role: 'CHEF_GROUPE',
    matricule: 'DEMOCG',
    editeurContenu: true,
    fonctionPublique: 'Chef de Groupe',
  },
  { id: 'seed-u-adjg', prenom: 'Adjoint de Groupe', role: 'ADJOINT_GROUPE', matricule: 'DEMOAG' },
  { id: 'seed-u-assg', prenom: 'Assistant de Groupe', role: 'ASSISTANT_GROUPE', matricule: 'DEMOSG' },
  {
    id: 'seed-u-resb',
    prenom: 'Responsable Louveteaux',
    role: 'RESPONSABLE_BRANCHE',
    matricule: 'DEMORB',
    brancheType: 'LOUVETEAUX',
  },
  { id: 'seed-u-adjb', prenom: 'Adjoint Louveteaux', role: 'ADJOINT_BRANCHE', matricule: 'DEMOAB', brancheType: 'LOUVETEAUX' },
  { id: 'seed-u-assb', prenom: 'Assistant Éclaireurs', role: 'ASSISTANT_BRANCHE', matricule: 'DEMOSB', brancheType: 'ECLAIREURS' },
  { id: 'seed-u-parent', prenom: 'Parent', role: 'PARENT', telephone: '0000000101' },
  { id: 'seed-u-scout', prenom: 'Scout', role: 'SCOUT', matricule: 'DEMOSC' },
  {
    id: 'seed-u-inactif',
    prenom: 'Compte désactivé',
    role: 'ASSISTANT_BRANCHE',
    matricule: 'DEMOIN',
    brancheType: 'OISILLONS',
    actif: false,
  },
]

const ROLES_MAITRISE = ['CHEF_GROUPE', 'ADJOINT_GROUPE', 'ASSISTANT_GROUPE', 'RESPONSABLE_BRANCHE', 'ADJOINT_BRANCHE', 'ASSISTANT_BRANCHE']

// Âge type par branche, pour des dates de naissance cohérentes.
const AGES_BRANCHE: Record<string, number> = {
  OISILLONS: 7,
  LOUVETEAUX: 9,
  ECLAIREURS: 13,
  CHEMINOTS: 16,
  COMPAGNONS: 19,
  RESSOURCES_ADULTES: 23,
}

const NOMS_BRANCHE: Record<string, string> = {
  OISILLONS: 'Oisillons',
  LOUVETEAUX: 'Louveteaux',
  ECLAIREURS: 'Éclaireurs',
  CHEMINOTS: 'Cheminots',
  COMPAGNONS: 'Compagnons',
  RESSOURCES_ADULTES: 'Ressources adultes',
}

type ScoutDemo = {
  id: string
  prenom: string
  brancheType: string
  sexe: string
  utilisateurId?: string
}

const SCOUTS: ScoutDemo[] = [
  ...Object.keys(AGES_BRANCHE).map((branche, i) => ({
    id: `seed-s-${branche.toLowerCase()}`,
    prenom: `Scout ${NOMS_BRANCHE[branche]}`,
    brancheType: branche,
    sexe: i % 2 ? 'FEMININ' : 'MASCULIN',
    // Le compte SCOUT de démonstration est rattaché à la fiche Compagnons.
    utilisateurId: branche === 'COMPAGNONS' ? 'seed-u-scout' : undefined,
  })),
  { id: 'seed-s-louveteaux-2', prenom: 'Scout Louveteaux bis', brancheType: 'LOUVETEAUX', sexe: 'FEMININ' },
  { id: 'seed-s-eclaireurs-2', prenom: 'Scout Éclaireurs bis', brancheType: 'ECLAIREURS', sexe: 'MASCULIN' },
]

// Le parent de démonstration suit deux enfants.
const ENFANTS_PARENT = ['seed-s-louveteaux', 'seed-s-eclaireurs']

function dansJours(jours: number, heure = 9): Date {
  const date = new Date()
  date.setDate(date.getDate() + jours)
  date.setHours(heure, 0, 0, 0)
  return date
}

// Année scolaire courante, de septembre à août (ex. « 2026-2027 »).
function anneeScolaire(): string {
  const maintenant = new Date()
  const debut = maintenant.getMonth() >= 8 ? maintenant.getFullYear() : maintenant.getFullYear() - 1
  return `${debut}-${debut + 1}`
}

async function seedDemo(motDePasseHache: string) {
  // Identité : complétée seulement si elle est encore vide.
  await client.query(
    `INSERT INTO "ConfigurationInstallation" (id, "nomParoisse", "nomGroupe", ville, "anneeHistorique", "updatedAt")
     VALUES ('installation', 'Paroisse de démonstration', 'Groupe scout de démonstration', 'Abidjan', 1956, NOW())
     ON CONFLICT (id) DO UPDATE SET
       "nomParoisse" = CASE WHEN "ConfigurationInstallation"."nomParoisse" = '' THEN EXCLUDED."nomParoisse" ELSE "ConfigurationInstallation"."nomParoisse" END,
       "nomGroupe" = CASE WHEN "ConfigurationInstallation"."nomGroupe" = '' THEN EXCLUDED."nomGroupe" ELSE "ConfigurationInstallation"."nomGroupe" END`,
  )

  for (const c of COMPTES) {
    await upsert('Utilisateur', [
      { name: 'id', value: c.id },
      { name: 'nom', value: 'Démo' },
      { name: 'prenom', value: c.prenom },
      { name: 'matricule', value: c.matricule ?? null },
      { name: 'telephone', value: c.telephone ?? null },
      { name: 'password', value: motDePasseHache },
      { name: 'doitChangerMotDePasse', value: false },
      { name: 'role', value: c.role, cast: '"RoleUtilisateur"' },
      { name: 'brancheType', value: c.brancheType ?? null, cast: '"BrancheType"' },
      { name: 'actif', value: c.actif ?? true },
      { name: 'editeurContenu', value: c.editeurContenu ?? false },
      { name: 'profilPublic', value: !!c.fonctionPublique },
      { name: 'fonctionPublique', value: c.fonctionPublique ?? null },
    ])
    if ((c.actif ?? true) && ROLES_MAITRISE.includes(c.role)) {
      await client.query(
        `INSERT INTO "Mandat" (id, role, "brancheType", "utilisateurId", motif)
         SELECT $1, $2::"RoleUtilisateur", $3::"BrancheType", $4, 'Compte de démonstration (seed)'
         WHERE NOT EXISTS (SELECT 1 FROM "Mandat" WHERE "utilisateurId" = $4 AND "finLe" IS NULL)`,
        [`seed-mandat-${c.id}`, c.role, c.brancheType ?? null, c.id],
      )
    }
  }

  const anneeCourante = new Date().getFullYear()
  for (const [i, s] of SCOUTS.entries()) {
    await upsert('Scout', [
      { name: 'id', value: s.id },
      { name: 'nom', value: 'Démo' },
      { name: 'prenom', value: s.prenom },
      { name: 'dateNaissance', value: new Date(Date.UTC(anneeCourante - AGES_BRANCHE[s.brancheType], i % 12, 10)) },
      { name: 'sexe', value: s.sexe, cast: '"Sexe"' },
      { name: 'brancheType', value: s.brancheType, cast: '"BrancheType"' },
      { name: 'matricule', value: `DEMOS${String(i + 1).padStart(3, '0')}` },
      { name: 'actif', value: true },
      { name: 'utilisateurId', value: s.utilisateurId ?? null },
    ])

    await upsert('ContactUrgence', [
      { name: 'id', value: `seed-cu-${s.id}` },
      { name: 'nom', value: 'Démo' },
      { name: 'prenom', value: `Contact de ${s.prenom}` },
      { name: 'telephone', value: `0000000${String(200 + i).padStart(3, '0')}` },
      { name: 'relation', value: 'Tuteur' },
      { name: 'principal', value: true },
      { name: 'scoutId', value: s.id },
      { name: 'utilisateurId', value: ENFANTS_PARENT.includes(s.id) ? 'seed-u-parent' : null },
    ])

    // Cotisations : alternance payée / en attente pour tester les deux statuts.
    const payee = i % 2 === 0
    await upsert('Cotisation', [
      { name: 'id', value: `seed-cot-${s.id}` },
      { name: 'type', value: 'ADHESION_ANNUELLE', cast: '"TypeCotisation"' },
      { name: 'montant', value: 5000 },
      { name: 'montantPaye', value: payee ? 5000 : 0 },
      { name: 'anneeScolaire', value: anneeScolaire() },
      { name: 'statut', value: payee ? 'PAYEE' : 'EN_ATTENTE', cast: '"StatutCotisation"' },
      { name: 'datePaiement', value: payee ? dansJours(-10) : null },
      { name: 'modePaiement', value: payee ? 'Espèces' : null },
      { name: 'scoutId', value: s.id },
      { name: 'enregistreParId', value: payee ? 'seed-u-chef' : null },
    ])
  }

  for (const scoutId of ENFANTS_PARENT) {
    await upsert(
      'LienParentScout',
      [
        { name: 'id', value: `seed-lien-${scoutId}` },
        { name: 'parentId', value: 'seed-u-parent' },
        { name: 'scoutId', value: scoutId },
      ],
      ['createdAt'],
    )
  }

  // Activités : une interne et une publique (texte public distinct), une réunion.
  await upsert('Activite', [
    { name: 'id', value: 'seed-act-sortie' },
    { name: 'titre', value: 'Sortie de démonstration' },
    { name: 'description', value: 'Activité interne créée par le seed de développement.' },
    { name: 'dateDebut', value: dansJours(7) },
    { name: 'dateFin', value: dansJours(7, 17) },
    { name: 'lieu', value: 'Lieu de démonstration' },
    { name: 'type', value: 'SORTIE', cast: '"TypeActivite"' },
    { name: 'brancheType', value: 'LOUVETEAUX', cast: '"BrancheType"' },
    { name: 'creePar', value: 'seed-u-chef' },
    { name: 'responsableId', value: 'seed-u-resb' },
  ])
  await upsert('Activite', [
    { name: 'id', value: 'seed-act-publique' },
    { name: 'titre', value: 'Journée portes ouvertes (démonstration)' },
    { name: 'description', value: 'Organisation interne : accueil des familles.' },
    { name: 'descriptionPublique', value: 'Venez découvrir le scoutisme et rencontrer la maîtrise (contenu de démonstration).' },
    { name: 'dateDebut', value: dansJours(14, 9) },
    { name: 'dateFin', value: dansJours(14, 13) },
    { name: 'lieu', value: 'Cour de la paroisse' },
    { name: 'type', value: 'CELEBRATION', cast: '"TypeActivite"' },
    { name: 'brancheType', value: null, cast: '"BrancheType"' },
    { name: 'publique', value: true },
    { name: 'creePar', value: 'seed-u-chef' },
  ])
  await upsert('JourReunion', [
    { name: 'id', value: 'seed-reu-hebdo' },
    { name: 'brancheType', value: null, cast: '"BrancheType"' },
    { name: 'titre', value: 'Réunion hebdomadaire' },
    { name: 'dateHeure', value: dansJours(3, 15) },
    { name: 'dureeMinutes', value: 120 },
    { name: 'lieu', value: 'Paroisse' },
    { name: 'statut', value: 'PLANIFIEE', cast: '"StatutReunion"' },
    { name: 'creePar', value: 'seed-u-chef' },
  ])

  // Contenus publics de démonstration, explicitement signalés comme tels.
  await upsert(
    'CategoriePublication',
    [
      { name: 'id', value: 'seed-cat-vie' },
      { name: 'nom', value: 'Vie du groupe' },
      { name: 'slug', value: 'vie-du-groupe' },
    ],
    ['createdAt'],
  )
  await upsert('Publication', [
    { name: 'id', value: 'seed-pub-bienvenue' },
    { name: 'titre', value: 'Article de démonstration' },
    { name: 'slug', value: 'article-de-demonstration' },
    { name: 'resume', value: 'Contenu fictif créé par le seed de développement.' },
    {
      name: 'contenu',
      value: "## Un article d'exemple\nCe texte sert uniquement à tester le site en développement.\n\n- Il est publié\n- Il appartient à une catégorie",
    },
    { name: 'statut', value: 'PUBLIEE', cast: '"StatutPublication"' },
    { name: 'datePublication', value: dansJours(-2) },
    { name: 'categorieId', value: 'seed-cat-vie' },
    { name: 'auteurId', value: 'seed-u-chef' },
  ])
  await upsert('EvenementHistorique', [
    { name: 'id', value: 'seed-hist-1956' },
    { name: 'annee', value: 1956 },
    { name: 'titre', value: 'Accueil du scoutisme dans la paroisse' },
    { name: 'description', value: 'Événement de démonstration : à compléter et sourcer avec les archives du groupe.' },
    { name: 'type', value: 'FONDATION', cast: '"TypeEvenementHistorique"' },
    { name: 'statutValidation', value: 'A_VERIFIER', cast: '"StatutValidationHistorique"' },
    { name: 'publie', value: true },
  ])
}

async function main() {
  // Développement uniquement : mots de passe par défaut affichés en clair. En
  // production, l'installation se fait avec `npm run initialiser`
  // (scripts/initialiser.ts), qui exige des mots de passe saisis à la main.
  if (process.env.NODE_ENV === 'production') {
    throw new Error('Seed interdit en production : utiliser `npm run initialiser` (apps/api).')
  }

  await client.connect()
  await client.query('BEGIN')

  const motDePasse = process.env.ADMIN_PASSWORD ?? 'Admin1234!'
  const admin = await upsert('Utilisateur', [
    { name: 'id', value: 'utilisateur-admin' },
    { name: 'nom', value: process.env.ADMIN_NOM ?? 'Administrateur' },
    { name: 'prenom', value: process.env.ADMIN_PRENOM ?? 'Technique' },
    { name: 'matricule', value: process.env.ADMIN_MATRICULE ?? 'ADMIN001A' },
    { name: 'email', value: process.env.ADMIN_EMAIL ?? null },
    { name: 'password', value: await hash(motDePasse, 12) },
    { name: 'role', value: 'ADMINISTRATEUR', cast: '"RoleUtilisateur"' },
  ])

  const demo = process.env.SEED_DEMO !== 'false'
  const motDePasseDemo = process.env.SEED_MOT_DE_PASSE ?? 'Scout1234!'
  if (demo) await seedDemo(await hash(motDePasseDemo, 12))

  await client.query('COMMIT')

  console.log('\nSeed terminé avec succès.')
  console.log(`  Administrateur → matricule: ${admin.matricule}  /  mot de passe: ${motDePasse}`)
  if (!demo) return
  console.log(`\n  Comptes de démonstration (mot de passe commun : ${motDePasseDemo})`)
  console.table(
    COMPTES.map((c) => ({
      identifiant: c.matricule ?? c.telephone,
      role: c.role + (c.brancheType ? ` (${c.brancheType})` : ''),
      actif: c.actif ?? true,
    })),
  )
  console.log('  Site public et espace de gestion : http://localhost:3000')
}

main()
  .catch(async (e) => {
    await client.query('ROLLBACK').catch(() => undefined)
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await client.end()
  })
