// Seed — Application SCOUT ASCCI (développement local uniquement)
// Crée le compte administrateur plateforme (rôle global, ADMIN_PLATEFORME, non
// rattaché à une paroisse — paroisseId reste NULL) puis, sauf SEED_DEMO=false,
// un jeu de démonstration FICTIF couvrant chaque rôle de l'application :
//   - District Démo Nord : paroisses A et B (périmètre district multi-paroisses) ;
//   - District Démo Sud : paroisse C (contrôle d'isolement entre districts) ;
//   - un compte par rôle paroissial, les trois rôles district (additifs à un
//     rôle paroissial, avec leur AffectationDistrict active), un parent, un
//     scout et un compte désactivé (refus de connexion attendu) ;
//   - scouts de chaque branche, contacts d'urgence, activité, réunion, cotisations.
//
// Idempotent : peut être relancé sans dupliquer les données (upsert sur des
// "id" fixes préfixés « seed- »). Relancer remet les comptes de démonstration
// dans leur état initial (mot de passe, rôle, affectation district).
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

// Colonnes d'horodatage absentes de certaines tables (AffectationDistrict n'en
// a aucune, LienParentScout seulement createdAt) : précisées par l'appelant.
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

const DISTRICTS = [
  { id: 'seed-district-nord', nom: 'District Démo Nord' },
  { id: 'seed-district-sud', nom: 'District Démo Sud' },
]

const PAROISSES = [
  { id: 'seed-paroisse-a', nom: 'Paroisse Démo A', ville: 'Ville Démo A', districtId: 'seed-district-nord' },
  { id: 'seed-paroisse-b', nom: 'Paroisse Démo B', ville: 'Ville Démo B', districtId: 'seed-district-nord' },
  { id: 'seed-paroisse-c', nom: 'Paroisse Démo C', ville: 'Ville Démo C', districtId: 'seed-district-sud' },
]

type CompteDemo = {
  id: string
  prenom: string
  role: string
  paroisseId: string
  matricule?: string
  telephone?: string
  brancheType?: string
  actif?: boolean
  district?: { role: string; brancheType?: string; fonction?: string }
}

const COMPTES: CompteDemo[] = [
  // Paroisse A : tous les rôles paroissiaux, parent, scout et compte désactivé.
  {
    id: 'seed-u-a-chef',
    prenom: 'Chef Groupe A',
    role: 'CHEF_GROUPE',
    paroisseId: 'seed-paroisse-a',
    matricule: 'DEMOCGA',
  },
  {
    id: 'seed-u-a-adjg',
    prenom: 'Adjoint Groupe A',
    role: 'ADJOINT_GROUPE',
    paroisseId: 'seed-paroisse-a',
    matricule: 'DEMOAGA',
  },
  {
    id: 'seed-u-a-assg',
    prenom: 'Assistant Groupe A',
    role: 'ASSISTANT_GROUPE',
    paroisseId: 'seed-paroisse-a',
    matricule: 'DEMOSGA',
  },
  {
    id: 'seed-u-a-resb',
    prenom: 'Responsable Louveteaux A',
    role: 'RESPONSABLE_BRANCHE',
    paroisseId: 'seed-paroisse-a',
    matricule: 'DEMORBA',
    brancheType: 'LOUVETEAUX',
  },
  {
    id: 'seed-u-a-adjb',
    prenom: 'Adjoint Louveteaux A',
    role: 'ADJOINT_BRANCHE',
    paroisseId: 'seed-paroisse-a',
    matricule: 'DEMOABA',
    brancheType: 'LOUVETEAUX',
  },
  {
    id: 'seed-u-a-assb',
    prenom: 'Assistant Éclaireurs A',
    role: 'ASSISTANT_BRANCHE',
    paroisseId: 'seed-paroisse-a',
    matricule: 'DEMOSBA',
    brancheType: 'ECLAIREURS',
  },
  { id: 'seed-u-a-parent', prenom: 'Parent A', role: 'PARENT', paroisseId: 'seed-paroisse-a', telephone: '0000000101' },
  { id: 'seed-u-a-scout', prenom: 'Scout A', role: 'SCOUT', paroisseId: 'seed-paroisse-a', matricule: 'DEMOSCA' },
  {
    id: 'seed-u-a-inactif',
    prenom: 'Compte désactivé A',
    role: 'ASSISTANT_BRANCHE',
    paroisseId: 'seed-paroisse-a',
    matricule: 'DEMOINA',
    brancheType: 'OISILLONS',
    actif: false,
  },
  // Paroisse B : la direction du district, cumulée avec un rôle paroissial.
  {
    id: 'seed-u-b-chef',
    prenom: 'Commissaire District',
    role: 'CHEF_GROUPE',
    paroisseId: 'seed-paroisse-b',
    matricule: 'DEMOCDN',
    district: { role: 'COMMISSAIRE_DISTRICT' },
  },
  {
    id: 'seed-u-b-adjg',
    prenom: 'Adjoint District',
    role: 'ADJOINT_GROUPE',
    paroisseId: 'seed-paroisse-b',
    matricule: 'DEMOADN',
    district: { role: 'ADJOINT_DISTRICT' },
  },
  {
    id: 'seed-u-b-resb',
    prenom: 'Assistant District Éclaireurs',
    role: 'RESPONSABLE_BRANCHE',
    paroisseId: 'seed-paroisse-b',
    matricule: 'DEMOSDN',
    brancheType: 'ECLAIREURS',
    district: { role: 'ASSISTANT_DISTRICT', brancheType: 'ECLAIREURS' },
  },
  // Paroisse C (autre district) : aucune donnée ne doit être visible depuis A ou B.
  {
    id: 'seed-u-c-chef',
    prenom: 'Chef Groupe C',
    role: 'CHEF_GROUPE',
    paroisseId: 'seed-paroisse-c',
    matricule: 'DEMOCGC',
  },
]

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
  paroisseId: string
  utilisateurId?: string
}

const SCOUTS: ScoutDemo[] = [
  ...Object.keys(AGES_BRANCHE).map((branche, i) => ({
    id: `seed-s-a-${branche.toLowerCase()}`,
    prenom: `Scout ${NOMS_BRANCHE[branche]} A`,
    brancheType: branche,
    sexe: i % 2 ? 'FEMININ' : 'MASCULIN',
    paroisseId: 'seed-paroisse-a',
    // Le compte SCOUT de démonstration est rattaché à la fiche Compagnons.
    utilisateurId: branche === 'COMPAGNONS' ? 'seed-u-a-scout' : undefined,
  })),
  {
    id: 'seed-s-a-louveteaux-2',
    prenom: 'Scout Louveteaux bis A',
    brancheType: 'LOUVETEAUX',
    sexe: 'FEMININ',
    paroisseId: 'seed-paroisse-a',
  },
  {
    id: 'seed-s-b-eclaireurs',
    prenom: 'Scout Éclaireurs B',
    brancheType: 'ECLAIREURS',
    sexe: 'MASCULIN',
    paroisseId: 'seed-paroisse-b',
  },
  {
    id: 'seed-s-b-louveteaux',
    prenom: 'Scout Louveteaux B',
    brancheType: 'LOUVETEAUX',
    sexe: 'FEMININ',
    paroisseId: 'seed-paroisse-b',
  },
  {
    id: 'seed-s-c-eclaireurs',
    prenom: 'Scout Éclaireurs C',
    brancheType: 'ECLAIREURS',
    sexe: 'MASCULIN',
    paroisseId: 'seed-paroisse-c',
  },
]

// Le parent de démonstration suit deux enfants de la paroisse A.
const ENFANTS_PARENT = ['seed-s-a-louveteaux', 'seed-s-a-eclaireurs']

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
  for (const d of DISTRICTS) {
    await upsert('District', [
      { name: 'id', value: d.id },
      { name: 'nom', value: d.nom },
    ])
  }

  for (const p of PAROISSES) {
    await upsert('Paroisse', [
      { name: 'id', value: p.id },
      { name: 'nom', value: p.nom },
      { name: 'ville', value: p.ville },
      { name: 'diocese', value: 'Diocèse Démo' },
      { name: 'actif', value: true },
      { name: 'districtId', value: p.districtId },
    ])
  }

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
      { name: 'roleDistrict', value: c.district?.role ?? null, cast: '"RoleUtilisateur"' },
      { name: 'fonctionDistrict', value: c.district?.fonction ?? null },
      { name: 'brancheTypeDistrict', value: c.district?.brancheType ?? null, cast: '"BrancheType"' },
      { name: 'paroisseId', value: c.paroisseId },
    ])

    if (!c.district) continue
    // Historique district : une seule affectation active par utilisateur
    // (index partiel). Une affectation ouverte depuis l'interface est close
    // avant de rouvrir celle du seed, cohérente avec la projection ci-dessus.
    const idAffectation = `seed-aff-${c.id}`
    await client.query(
      `UPDATE "AffectationDistrict" SET "finLe" = NOW(), "motifRevocation" = 'Réinitialisation du seed'
       WHERE "utilisateurId" = $1 AND "finLe" IS NULL AND id <> $2`,
      [c.id, idAffectation],
    )
    const districtId = PAROISSES.find((p) => p.id === c.paroisseId)!.districtId
    await upsert(
      'AffectationDistrict',
      [
        { name: 'id', value: idAffectation },
        { name: 'utilisateurId', value: c.id },
        { name: 'districtId', value: districtId },
        { name: 'role', value: c.district.role, cast: '"RoleUtilisateur"' },
        { name: 'fonction', value: c.district.fonction ?? null },
        { name: 'brancheType', value: c.district.brancheType ?? null, cast: '"BrancheType"' },
        { name: 'debutLe', value: new Date() },
        { name: 'finLe', value: null },
        { name: 'motif', value: 'Compte de démonstration (seed)' },
      ],
      [],
    )
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
      { name: 'paroisseId', value: s.paroisseId },
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
      { name: 'utilisateurId', value: ENFANTS_PARENT.includes(s.id) ? 'seed-u-a-parent' : null },
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
      { name: 'paroisseId', value: s.paroisseId },
      { name: 'enregistreParId', value: payee ? 'seed-u-a-chef' : null },
    ])
  }

  for (const scoutId of ENFANTS_PARENT) {
    await upsert(
      'LienParentScout',
      [
        { name: 'id', value: `seed-lien-${scoutId}` },
        { name: 'parentId', value: 'seed-u-a-parent' },
        { name: 'scoutId', value: scoutId },
      ],
      ['createdAt'],
    )
  }

  // Une activité et une réunion à venir par paroisse, créées par son chef.
  const chefs: Record<string, string> = {
    'seed-paroisse-a': 'seed-u-a-chef',
    'seed-paroisse-b': 'seed-u-b-chef',
    'seed-paroisse-c': 'seed-u-c-chef',
  }
  for (const p of PAROISSES) {
    const suffixe = p.id.replace('seed-paroisse-', '')
    await upsert('Activite', [
      { name: 'id', value: `seed-act-${suffixe}` },
      { name: 'titre', value: `Sortie de démonstration ${suffixe.toUpperCase()}` },
      { name: 'description', value: 'Activité créée par le seed de développement.' },
      { name: 'dateDebut', value: dansJours(7) },
      { name: 'dateFin', value: dansJours(7, 17) },
      { name: 'lieu', value: p.ville },
      { name: 'type', value: 'SORTIE', cast: '"TypeActivite"' },
      { name: 'brancheType', value: null, cast: '"BrancheType"' },
      { name: 'paroisseId', value: p.id },
      { name: 'creePar', value: chefs[p.id] },
    ])
    await upsert('JourReunion', [
      { name: 'id', value: `seed-reu-${suffixe}` },
      { name: 'brancheType', value: null, cast: '"BrancheType"' },
      { name: 'titre', value: 'Réunion hebdomadaire' },
      { name: 'dateHeure', value: dansJours(3, 15) },
      { name: 'dureeMinutes', value: 120 },
      { name: 'lieu', value: p.ville },
      { name: 'statut', value: 'PLANIFIEE', cast: '"StatutReunion"' },
      { name: 'paroisseId', value: p.id },
      { name: 'creePar', value: chefs[p.id] },
    ])
  }
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
    { name: 'prenom', value: process.env.ADMIN_PRENOM ?? 'Plateforme' },
    { name: 'matricule', value: process.env.ADMIN_MATRICULE ?? 'ADMIN001A' },
    { name: 'email', value: process.env.ADMIN_EMAIL ?? null },
    { name: 'password', value: await hash(motDePasse, 12) },
    { name: 'role', value: 'ADMIN_PLATEFORME', cast: '"RoleUtilisateur"' },
    { name: 'paroisseId', value: null },
  ])

  const demo = process.env.SEED_DEMO !== 'false'
  const motDePasseDemo = process.env.SEED_MOT_DE_PASSE ?? 'Scout1234!'
  if (demo) await seedDemo(await hash(motDePasseDemo, 12))

  await client.query('COMMIT')

  console.log('\nSeed terminé avec succès.')
  console.log(`  Admin plateforme → matricule: ${admin.matricule}  /  mot de passe: ${motDePasse}`)
  if (!demo) {
    console.log('  Créez ensuite les paroisses via l’API (/api/admin/paroisses).')
    return
  }
  console.log(`\n  Comptes de démonstration (mot de passe commun : ${motDePasseDemo})`)
  console.table(
    COMPTES.map((c) => ({
      identifiant: c.matricule ?? c.telephone,
      role: c.role + (c.brancheType ? ` (${c.brancheType})` : ''),
      district: c.district ? c.district.role + (c.district.brancheType ? ` (${c.district.brancheType})` : '') : '',
      paroisse: PAROISSES.find((p) => p.id === c.paroisseId)!.nom,
      actif: c.actif ?? true,
    })),
  )
  console.log('  Paroisse : http://localhost:3000  —  District et admin : http://localhost:3001')
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
