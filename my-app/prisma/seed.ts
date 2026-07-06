// Seed de données de test — Application SCOUT ASCCI
// Génère ~100 utilisateurs couvrant TOUS les rôles applicatifs, avec des données
// liées complètes (activités, réunions, badges, documents, autorisations de camp,
// programmes) pour permettre de tester chaque fonctionnalité et chaque rôle.
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

// ---------------------------------------------------------------------------
// Aide générique d'upsert (conflit toujours sur "id", que l'on génère nous-même
// de façon déterministe, ce qui rend le script idempotent : on peut le relancer
// sans dupliquer les données).
// ---------------------------------------------------------------------------

type Val = string | number | boolean | Date | null
type ColumnValue = { name: string; value: Val; cast?: string }
type TimestampMode = 'both' | 'createdOnly' | 'none'

async function upsert(
  table: string,
  columns: ColumnValue[],
  timestampMode: TimestampMode = 'both',
): Promise<Record<string, any>> {
  const colNames = columns.map((c) => c.name)
  const placeholders = columns.map((c, i) => `$${i + 1}${c.cast ? `::${c.cast}` : ''}`)

  let colsSql = colNames.map((n) => `"${n}"`).join(', ')
  let valsSql = placeholders.join(', ')
  if (timestampMode !== 'none') {
    colsSql += `, "createdAt"`
    valsSql += `, NOW()`
  }
  if (timestampMode === 'both') {
    colsSql += `, "updatedAt"`
    valsSql += `, NOW()`
  }

  const updateColumns = colNames.filter((n) => n !== 'id')
  const setSql = updateColumns.map((c) => `"${c}" = EXCLUDED."${c}"`)
  if (timestampMode === 'both') setSql.push(`"updatedAt" = NOW()`)
  const doSql = setSql.length > 0 ? `UPDATE SET ${setSql.join(', ')}` : 'NOTHING'

  const sql = `
    INSERT INTO "${table}" (${colsSql})
    VALUES (${valsSql})
    ON CONFLICT (id) DO ${doSql}
    RETURNING *
  `
  const values = columns.map((c) => c.value)
  const { rows } = await client.query(sql, values)
  return rows[0]
}

// ---------------------------------------------------------------------------
// Données de référence (jeux de noms ivoiriens, purement fictifs, pour les tests)
// ---------------------------------------------------------------------------

const PRENOMS_M = [
  'Jean-Baptiste', 'Kouadio', 'Yao', 'Adama', 'Ibrahim', 'Serge', 'Franck',
  'Aristide', 'Désiré', 'Guy', 'Hervé', 'Landry', 'Marc', 'Norbert', 'Olivier',
  'Patrick', 'Roger', 'Simon', 'Thierry', 'Vincent', 'William', 'Yves',
  'Bertin', 'Cyrille', 'Daniel', 'Emmanuel', 'Fabrice', 'Gervais', 'Honoré',
]

const PRENOMS_F = [
  'Marie', 'Aya', 'Akissi', 'Adjoua', 'Affoué', 'Béatrice', 'Chantal',
  'Delphine', 'Estelle', 'Félicité', 'Georgette', 'Henriette', 'Irène',
  'Josiane', 'Karidja', 'Laurentine', 'Micheline', 'Nadège', 'Odile',
  'Pascaline', 'Reine', 'Sylvie', 'Thérèse', 'Ursule', 'Véronique', 'Yolande',
  'Ange', 'Colette',
]

const NOMS = [
  'Kouassi', 'Koné', 'Yao', "N'Guessan", 'Ouattara', 'Kouamé', 'Bamba',
  'Traoré', 'Diabaté', 'Aka', 'Kouakou', 'Kra', 'Assi', 'Brou', 'Diomandé',
  'Coulibaly', 'Tanoh', 'Adjé', 'Gnamien', 'Zadi', 'Kadio', 'Amoin',
  'Angoran', 'Sanogo', 'Konan', 'Digbeu', 'Yapi', 'Loba', 'Ehouman', 'Silué',
]

function nomComplet(index: number): { nom: string; prenom: string } {
  const nom = NOMS[index % NOMS.length]
  const prenom =
    index % 2 === 0
      ? PRENOMS_M[Math.floor(index / 2) % PRENOMS_M.length]
      : PRENOMS_F[Math.floor(index / 2) % PRENOMS_F.length]
  return { nom, prenom }
}

type BrancheType = 'OISILLONS' | 'LOUVETEAUX' | 'ECLAIREURS' | 'CHEMINOTS' | 'COMPAGNONS'

const BRANCHES: { type: BrancheType; code: string; ageMin: number; ageMax: number }[] = [
  { type: 'OISILLONS', code: 'OIS', ageMin: 6, ageMax: 7 },
  { type: 'LOUVETEAUX', code: 'LOU', ageMin: 8, ageMax: 10 },
  { type: 'ECLAIREURS', code: 'ECL', ageMin: 11, ageMax: 13 },
  { type: 'CHEMINOTS', code: 'CHE', ageMin: 14, ageMax: 16 },
  { type: 'COMPAGNONS', code: 'COM', ageMin: 17, ageMax: 20 },
]

const BADGES_PAR_BRANCHE: Record<BrancheType, string[]> = {
  OISILLONS: ['Éveil à la prière', 'Découverte de la nature', 'Vie en équipe', 'Premiers pas scouts'],
  LOUVETEAUX: ['Sizaine étoile', 'Piste et Rocher niveau 1', 'Piste et Rocher niveau 2', 'Badge du service'],
  ECLAIREURS: ['Badge de fourrier', 'Badge de secouriste', 'Badge du camping', "Badge d'orientation"],
  CHEMINOTS: ['Badge de responsabilité', 'Badge de projet communautaire', 'Badge de leadership'],
  COMPAGNONS: ["Badge d'engagement", 'Badge de service diocésain', 'Badge de formation de cadre'],
}

function dateNaissance(ageAnnees: number): Date {
  const auj = new Date()
  return new Date(auj.getFullYear() - ageAnnees, auj.getMonth(), 15)
}

function joursDepuis(jours: number): Date {
  const d = new Date()
  d.setDate(d.getDate() - jours)
  return d
}

function joursDans(jours: number): Date {
  const d = new Date()
  d.setDate(d.getDate() + jours)
  return d
}

// Cache des mots de passe hachés (un seul hash par rôle, réutilisé pour tous les
// comptes de test de ce rôle — permet de tester chaque rôle avec un mot de passe
// mémorisable sans recalculer 100 hash bcrypt).
const passwordCache = new Map<string, string>()
async function passwordPour(motDePasse: string): Promise<string> {
  const existant = passwordCache.get(motDePasse)
  if (existant) return existant
  const h = await hash(motDePasse, 10)
  passwordCache.set(motDePasse, h)
  return h
}

let compteurTelephone = 701000001
function prochainTelephone(): string {
  compteurTelephone += 1
  // Format ivoirien à 10 chiffres, ex : 0701000001
  return `07${String(compteurTelephone - 1).slice(-8)}`
}

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
}) {
  return upsert('Utilisateur', [
    { name: 'id', value: input.id },
    { name: 'nom', value: input.nom },
    { name: 'prenom', value: input.prenom },
    { name: 'matricule', value: input.matricule ?? null },
    { name: 'telephone', value: input.telephone ?? null },
    { name: 'email', value: input.email ?? null },
    { name: 'password', value: input.password },
    { name: 'role', value: input.role, cast: '"RoleUtilisateur"' },
    { name: 'paroisseId', value: input.paroisseId },
  ])
}

async function upsertParoisse(input: {
  id: string
  nom: string
  ville: string
  diocese: string
  adresse: string
  email: string
}) {
  return upsert('Paroisse', [
    { name: 'id', value: input.id },
    { name: 'nom', value: input.nom },
    { name: 'ville', value: input.ville },
    { name: 'diocese', value: input.diocese },
    { name: 'adresse', value: input.adresse },
    { name: 'email', value: input.email },
  ])
}

// ---------------------------------------------------------------------------
// Construction d'une paroisse complète (staff, scouts, parents, activités...)
// ---------------------------------------------------------------------------

async function construireParoisse(config: {
  paroisseId: string
  paroisseNom: string
  ville: string
  diocese: string
  email: string
  prefixe: string // préfixe unique pour matricules/ids afin d'éviter les collisions inter-paroisses
  avecAdjointsEtEvenementsAnnexes: boolean // paroisse principale = jeu complet, secondaire = jeu réduit (isolation)
  nbAssistantsGroupe: number
  nbAssistantsBranchePar: number
  nbScoutsParBranche: number
  nbComptesScoutParBranche: Record<BrancheType, number>
  nbParents: number
  indexDepart: number
}) {
  const {
    paroisseId,
    paroisseNom,
    ville,
    diocese,
    email,
    prefixe,
    avecAdjointsEtEvenementsAnnexes,
    nbAssistantsGroupe,
    nbAssistantsBranchePar,
    nbScoutsParBranche,
    nbComptesScoutParBranche,
    nbParents,
  } = config

  let idxNom = config.indexDepart
  const suivant = () => nomComplet(idxNom++)

  const paroisse = await upsertParoisse({
    id: paroisseId,
    nom: paroisseNom,
    ville,
    diocese,
    adresse: `${ville}, Côte d'Ivoire`,
    email,
  })
  console.log(`\n=== Paroisse : ${paroisse.nom} (${paroisse.id}) ===`)

  const comptesCrees: { role: string; identifiant: string; motDePasse: string; nom: string }[] = []

  // --- Équipe de groupe ---------------------------------------------------

  const pwdAdmin = await passwordPour('Admin1234!')
  const { nom: nomAdmin, prenom: prenomAdmin } = suivant()
  const admin = await upsertUtilisateur({
    id: `${prefixe}-admin`,
    nom: nomAdmin,
    prenom: prenomAdmin,
    matricule: `${prefixe}-ADMIN001A`,
    email: `admin.${prefixe}@scout-test.ci`,
    password: pwdAdmin,
    role: 'ADMIN_PAROISSE',
    paroisseId: paroisse.id,
  })
  comptesCrees.push({ role: 'ADMIN_PAROISSE', identifiant: admin.matricule, motDePasse: 'Admin1234!', nom: `${prenomAdmin} ${nomAdmin}` })

  const pwdChef = await passwordPour('Chef1234!')
  const { nom: nomChef, prenom: prenomChef } = suivant()
  const chef = await upsertUtilisateur({
    id: `${prefixe}-chef-groupe`,
    nom: nomChef,
    prenom: prenomChef,
    matricule: `${prefixe}-CHEF0001A`,
    email: `chef.${prefixe}@scout-test.ci`,
    password: pwdChef,
    role: 'CHEF_GROUPE',
    paroisseId: paroisse.id,
  })
  await upsert('PosteGroupe', [
    { name: 'id', value: `${prefixe}-poste-chef-groupe` },
    { name: 'role', value: 'CHEF_GROUPE', cast: '"RolePosteGroupe"' },
    { name: 'fonction', value: null },
    { name: 'utilisateurId', value: chef.id },
    { name: 'paroisseId', value: paroisse.id },
  ])
  comptesCrees.push({ role: 'CHEF_GROUPE', identifiant: chef.matricule, motDePasse: 'Chef1234!', nom: `${prenomChef} ${nomChef}` })

  if (avecAdjointsEtEvenementsAnnexes) {
    const pwdAdjointGroupe = await passwordPour('AdjointGroupe1234!')
    const { nom: n, prenom: p } = suivant()
    const adjointGroupe = await upsertUtilisateur({
      id: `${prefixe}-adjoint-groupe`,
      nom: n,
      prenom: p,
      matricule: `${prefixe}-ADJG0001A`,
      email: `adjoint.groupe.${prefixe}@scout-test.ci`,
      password: pwdAdjointGroupe,
      role: 'ADJOINT_GROUPE',
      paroisseId: paroisse.id,
    })
    await upsert('PosteGroupe', [
      { name: 'id', value: `${prefixe}-poste-adjoint-groupe` },
      { name: 'role', value: 'ADJOINT_GROUPE', cast: '"RolePosteGroupe"' },
      { name: 'fonction', value: null },
      { name: 'utilisateurId', value: adjointGroupe.id },
      { name: 'paroisseId', value: paroisse.id },
    ])
    comptesCrees.push({ role: 'ADJOINT_GROUPE', identifiant: adjointGroupe.matricule, motDePasse: 'AdjointGroupe1234!', nom: `${p} ${n}` })
  }

  const fonctionsAssistantGroupe = ['Logistique', 'Secrétariat', 'Communication', 'Trésorerie']
  for (let i = 0; i < nbAssistantsGroupe; i++) {
    const pwd = await passwordPour('AssistantGroupe1234!')
    const { nom: n, prenom: p } = suivant()
    const u = await upsertUtilisateur({
      id: `${prefixe}-assistant-groupe-${i + 1}`,
      nom: n,
      prenom: p,
      matricule: `${prefixe}-ASSG${String(i + 1).padStart(4, '0')}A`,
      email: `assistant.groupe${i + 1}.${prefixe}@scout-test.ci`,
      password: pwd,
      role: 'ASSISTANT_GROUPE',
      paroisseId: paroisse.id,
    })
    await upsert('PosteGroupe', [
      { name: 'id', value: `${prefixe}-poste-assistant-groupe-${i + 1}` },
      { name: 'role', value: 'ASSISTANT_GROUPE', cast: '"RolePosteGroupe"' },
      { name: 'fonction', value: fonctionsAssistantGroupe[i % fonctionsAssistantGroupe.length] },
      { name: 'utilisateurId', value: u.id },
      { name: 'paroisseId', value: paroisse.id },
    ])
    comptesCrees.push({ role: 'ASSISTANT_GROUPE', identifiant: u.matricule, motDePasse: 'AssistantGroupe1234!', nom: `${p} ${n}` })
  }

  // --- Équipes de branche ---------------------------------------------------

  type BrancheStaff = {
    branche: BrancheType
    code: string
    responsable: Record<string, any>
    adjoint: Record<string, any> | null
  }
  const brancheStaff: BrancheStaff[] = []

  for (const { type: branche, code } of BRANCHES) {
    const pwdResp = await passwordPour('Responsable1234!')
    const { nom: nR, prenom: pR } = suivant()
    const responsable = await upsertUtilisateur({
      id: `${prefixe}-responsable-${code.toLowerCase()}`,
      nom: nR,
      prenom: pR,
      matricule: `${prefixe}-RESP-${code}-01`,
      email: `responsable.${code.toLowerCase()}.${prefixe}@scout-test.ci`,
      password: pwdResp,
      role: 'RESPONSABLE_BRANCHE',
      paroisseId: paroisse.id,
    })
    await upsert('PosteBranche', [
      { name: 'id', value: `${prefixe}-poste-resp-${code.toLowerCase()}` },
      { name: 'brancheType', value: branche, cast: '"BrancheType"' },
      { name: 'role', value: 'RESPONSABLE', cast: '"RolePosteBranche"' },
      { name: 'fonction', value: null },
      { name: 'utilisateurId', value: responsable.id },
      { name: 'paroisseId', value: paroisse.id },
    ])
    comptesCrees.push({ role: `RESPONSABLE_BRANCHE (${branche})`, identifiant: responsable.matricule, motDePasse: 'Responsable1234!', nom: `${pR} ${nR}` })

    let adjoint: Record<string, any> | null = null
    if (avecAdjointsEtEvenementsAnnexes) {
      const pwdAdj = await passwordPour('AdjointBranche1234!')
      const { nom: nA, prenom: pA } = suivant()
      adjoint = await upsertUtilisateur({
        id: `${prefixe}-adjoint-${code.toLowerCase()}`,
        nom: nA,
        prenom: pA,
        matricule: `${prefixe}-ADJB-${code}-01`,
        email: `adjoint.${code.toLowerCase()}.${prefixe}@scout-test.ci`,
        password: pwdAdj,
        role: 'ADJOINT_BRANCHE',
        paroisseId: paroisse.id,
      })
      await upsert('PosteBranche', [
        { name: 'id', value: `${prefixe}-poste-adj-${code.toLowerCase()}` },
        { name: 'brancheType', value: branche, cast: '"BrancheType"' },
        { name: 'role', value: 'ADJOINT', cast: '"RolePosteBranche"' },
        { name: 'fonction', value: null },
        { name: 'utilisateurId', value: adjoint.id },
        { name: 'paroisseId', value: paroisse.id },
      ])
      comptesCrees.push({ role: `ADJOINT_BRANCHE (${branche})`, identifiant: adjoint.matricule, motDePasse: 'AdjointBranche1234!', nom: `${pA} ${nA}` })
    }

    for (let i = 0; i < nbAssistantsBranchePar; i++) {
      const pwdAss = await passwordPour('AssistantBranche1234!')
      const { nom: nAs, prenom: pAs } = suivant()
      const assistant = await upsertUtilisateur({
        id: `${prefixe}-assistant-${code.toLowerCase()}-${i + 1}`,
        nom: nAs,
        prenom: pAs,
        matricule: `${prefixe}-ASSB-${code}-${String(i + 1).padStart(2, '0')}`,
        email: `assistant.${code.toLowerCase()}${i + 1}.${prefixe}@scout-test.ci`,
        password: pwdAss,
        role: 'ASSISTANT_BRANCHE',
        paroisseId: paroisse.id,
      })
      await upsert('PosteBranche', [
        { name: 'id', value: `${prefixe}-poste-ass-${code.toLowerCase()}-${i + 1}` },
        { name: 'brancheType', value: branche, cast: '"BrancheType"' },
        { name: 'role', value: 'ASSISTANT', cast: '"RolePosteBranche"' },
        { name: 'fonction', value: null },
        { name: 'utilisateurId', value: assistant.id },
        { name: 'paroisseId', value: paroisse.id },
      ])
      comptesCrees.push({ role: `ASSISTANT_BRANCHE (${branche})`, identifiant: assistant.matricule, motDePasse: 'AssistantBranche1234!', nom: `${pAs} ${nAs}` })
    }

    // Configuration du jour de réunion hebdomadaire de la branche
    await upsert('ConfigReunionBranche', [
      { name: 'id', value: `${prefixe}-config-reunion-${code.toLowerCase()}` },
      { name: 'brancheType', value: branche, cast: '"BrancheType"' },
      { name: 'jourSemaine', value: BRANCHES.findIndex((b) => b.type === branche) + 1 },
      { name: 'heureDebut', value: '15:00' },
      { name: 'dureeMinutes', value: 120 },
      { name: 'lieu', value: `Salle ${branche.toLowerCase()} — ${paroisse.nom}` },
      { name: 'paroisseId', value: paroisse.id },
    ])

    brancheStaff.push({ branche, code, responsable, adjoint })
  }

  // --- Badges (référentiel pédagogique) --------------------------------

  const badgesParBranche: Record<string, Record<string, any>[]> = {}
  for (const { type: branche } of BRANCHES) {
    badgesParBranche[branche] = []
    for (const [ordre, nomBadge] of BADGES_PAR_BRANCHE[branche].entries()) {
      const idBadge = `badge-${branche.toLowerCase()}-${ordre + 1}`
      const badge = await upsert('Badge', [
        { name: 'id', value: idBadge },
        { name: 'nom', value: nomBadge },
        { name: 'description', value: `Badge « ${nomBadge} » — branche ${branche.toLowerCase()}` },
        { name: 'brancheType', value: branche, cast: '"BrancheType"' },
        { name: 'ordre', value: ordre },
      ])
      badgesParBranche[branche].push(badge)
    }
  }

  // --- Parents ------------------------------------------------------------

  const parents: Record<string, any>[] = []
  for (let i = 0; i < nbParents; i++) {
    const pwdParent = await passwordPour('Parent1234!')
    const { nom: n, prenom: p } = suivant()
    const parent = await upsertUtilisateur({
      id: `${prefixe}-parent-${i + 1}`,
      nom: n,
      prenom: p,
      telephone: prochainTelephone(),
      password: pwdParent,
      role: 'PARENT',
      paroisseId: paroisse.id,
    })
    parents.push(parent)
    comptesCrees.push({ role: 'PARENT', identifiant: parent.telephone, motDePasse: 'Parent1234!', nom: `${p} ${n}` })
  }

  // --- Scouts (fiches + comptes personnels + contacts + documents) --------

  type ScoutCree = { id: string; branche: BrancheType; compteId: string | null }
  const scoutsCrees: ScoutCree[] = []
  let compteurParent = 0

  for (const { type: branche, code, ageMin, ageMax } of BRANCHES) {
    const nbComptes = nbComptesScoutParBranche[branche] ?? 0

    for (let i = 0; i < nbScoutsParBranche; i++) {
      const { nom: n, prenom: p } = suivant()
      const sexe = i % 2 === 0 ? 'MASCULIN' : 'FEMININ'
      const age = ageMin + (i % (ageMax - ageMin + 1))
      const scoutId = `${prefixe}-scout-${code.toLowerCase()}-${String(i + 1).padStart(3, '0')}`

      let compteId: string | null = null
      if (i < nbComptes) {
        const pwdScout = await passwordPour('Scout1234!')
        const compte = await upsertUtilisateur({
          id: `${scoutId}-compte`,
          nom: n,
          prenom: p,
          matricule: `${prefixe}-SCT-${code}-${String(i + 1).padStart(4, '0')}`,
          password: pwdScout,
          role: 'SCOUT',
          paroisseId: paroisse.id,
        })
        compteId = compte.id
        comptesCrees.push({ role: `SCOUT (${branche})`, identifiant: compte.matricule, motDePasse: 'Scout1234!', nom: `${p} ${n}` })
      }

      const scout = await upsert('Scout', [
        { name: 'id', value: scoutId },
        { name: 'nom', value: n },
        { name: 'prenom', value: p },
        { name: 'dateNaissance', value: dateNaissance(age) },
        { name: 'sexe', value: sexe, cast: '"Sexe"' },
        { name: 'brancheType', value: branche, cast: '"BrancheType"' },
        { name: 'matricule', value: `${prefixe}-MAT-${code}-${String(i + 1).padStart(4, '0')}` },
        { name: 'paroisseId', value: paroisse.id },
        { name: 'utilisateurId', value: compteId },
      ])
      scoutsCrees.push({ id: scout.id, branche, compteId })

      // Contact d'urgence principal
      await upsert('ContactUrgence', [
        { name: 'id', value: `${scoutId}-contact-1` },
        { name: 'nom', value: n },
        { name: 'prenom', value: `Parent de ${p}` },
        { name: 'telephone', value: prochainTelephone() },
        { name: 'relation', value: sexe === 'MASCULIN' ? 'Père' : 'Mère' },
        { name: 'principal', value: true },
        { name: 'scoutId', value: scout.id },
        { name: 'utilisateurId', value: null },
      ])

      // Lien avec un parent (sauf ~15% des scouts, notamment les Compagnons autonomes)
      const sansParent = branche === 'COMPAGNONS' ? i % 3 === 0 : i % 7 === 0
      if (!sansParent && parents.length > 0) {
        const parent = parents[compteurParent % parents.length]
        compteurParent++
        await upsert(
          'LienParentScout',
          [
            { name: 'id', value: `${prefixe}-lien-${scoutId}-${parent.id.slice(-6)}` },
            { name: 'parentId', value: parent.id },
            { name: 'scoutId', value: scout.id },
          ],
          'createdOnly',
        )
      }

      // Documents (mix de types et de statuts de validation)
      const typesDocuments = ['PHOTO_IDENTITE', 'CERTIFICAT_MEDICAL', 'AUTORISATION_PARENTALE']
      for (const [j, typeDoc] of typesDocuments.entries()) {
        if ((i + j) % 3 === 2) continue // certains scouts n'ont pas encore fourni tous les documents
        await upsert('Document', [
          { name: 'id', value: `${scoutId}-doc-${typeDoc.toLowerCase()}` },
          { name: 'type', value: typeDoc, cast: '"TypeDocument"' },
          { name: 'nomFichier', value: `${typeDoc.toLowerCase()}-${scout.matricule}.pdf` },
          { name: 'url', value: `/uploads/test/${scoutId}-${typeDoc.toLowerCase()}.pdf` },
          { name: 'valide', value: (i + j) % 2 === 0 },
          { name: 'scoutId', value: scout.id },
        ])
      }

      // Progression (badges validés) pour environ 6 scouts sur 10
      if (i % 10 < 6) {
        const staff = brancheStaff.find((b) => b.branche === branche)!
        const badgesBranche = badgesParBranche[branche]
        const nbBadgesValides = 1 + (i % badgesBranche.length)
        for (let b = 0; b < nbBadgesValides; b++) {
          await upsert(
            'ProgressionScout',
            [
              { name: 'id', value: `${scoutId}-progression-${b}` },
              { name: 'dateValidation', value: joursDepuis(30 * (b + 1)) },
              { name: 'commentaire', value: null },
              { name: 'scoutId', value: scout.id },
              { name: 'badgeId', value: badgesBranche[b].id },
              { name: 'valideParId', value: staff.responsable.id },
            ],
            'createdOnly',
          )
        }
      }
    }
  }

  // --- Activités + présences ----------------------------------------------

  const typesActivite = ['SORTIE', 'SERVICE', 'CELEBRATION', 'FORMATION', 'AUTRE']
  let campActiviteId: string | null = null

  for (const staff of brancheStaff) {
    const { branche } = staff
    // Deux activités passées, une future, par branche
    for (const [offset, jours] of [
      ['passee-1', 21],
      ['passee-2', 7],
    ] as const) {
      const activiteId = `${prefixe}-activite-${branche.toLowerCase()}-${offset}`
      const type = typesActivite[Math.abs(jours) % typesActivite.length]
      const libelle =
        type === 'SORTIE' ? 'Sortie' :
        type === 'SERVICE' ? 'Journée de service' :
        type === 'CELEBRATION' ? 'Célébration' :
        type === 'FORMATION' ? 'Formation' : 'Activité'
      const activite = await upsert('Activite', [
        { name: 'id', value: activiteId },
        { name: 'titre', value: `${libelle} ${branche.toLowerCase()}` },
        { name: 'description', value: `Activité de test pour la branche ${branche.toLowerCase()}.` },
        { name: 'dateDebut', value: joursDepuis(jours) },
        { name: 'dateFin', value: null },
        { name: 'lieu', value: `Paroisse ${paroisse.nom}` },
        { name: 'type', value: type, cast: '"TypeActivite"' },
        { name: 'brancheType', value: branche, cast: '"BrancheType"' },
        { name: 'paroisseId', value: paroisse.id },
        { name: 'creePar', value: staff.responsable.id },
      ])

      const scoutsBranche = scoutsCrees.filter((s) => s.branche === branche)
      for (const [i, s] of scoutsBranche.entries()) {
        await upsert('Presence', [
          { name: 'id', value: `${activite.id}-presence-${s.id.slice(-6)}` },
          { name: 'present', value: i % 5 !== 0 },
          { name: 'commentaire', value: null },
          { name: 'scoutId', value: s.id },
          { name: 'activiteId', value: activite.id },
        ])
      }
    }

    if (avecAdjointsEtEvenementsAnnexes) {
      const activiteFutureId = `${prefixe}-activite-${branche.toLowerCase()}-future`
      await upsert('Activite', [
        { name: 'id', value: activiteFutureId },
        { name: 'titre', value: `Prochaine sortie ${branche.toLowerCase()}` },
        { name: 'description', value: `Activité à venir pour la branche ${branche.toLowerCase()}.` },
        { name: 'dateDebut', value: joursDans(14) },
        { name: 'dateFin', value: null },
        { name: 'lieu', value: `Paroisse ${paroisse.nom}` },
        { name: 'type', value: 'SORTIE', cast: '"TypeActivite"' },
        { name: 'brancheType', value: branche, cast: '"BrancheType"' },
        { name: 'paroisseId', value: paroisse.id },
        { name: 'creePar', value: staff.responsable.id },
      ])
    }
  }

  // Activité inter-branches : réunion générale du groupe
  await upsert('Activite', [
    { name: 'id', value: `${prefixe}-activite-groupe-reunion` },
    { name: 'titre', value: 'Réunion générale du groupe' },
    { name: 'description', value: 'Rassemblement de toutes les branches.' },
    { name: 'dateDebut', value: joursDepuis(10) },
    { name: 'dateFin', value: null },
    { name: 'lieu', value: `Paroisse ${paroisse.nom}` },
    { name: 'type', value: 'REUNION', cast: '"TypeActivite"' },
    { name: 'brancheType', value: null },
    { name: 'paroisseId', value: paroisse.id },
    { name: 'creePar', value: chef.id },
  ])

  // Camp de groupe (à venir) pour tester les autorisations de camp
  if (avecAdjointsEtEvenementsAnnexes) {
    campActiviteId = `${prefixe}-activite-camp-groupe`
    const campActivite = await upsert('Activite', [
      { name: 'id', value: campActiviteId },
      { name: 'titre', value: "Camp d'été du groupe" },
      { name: 'description', value: 'Camp annuel réunissant les branches Éclaireurs, Cheminots et Compagnons.' },
      { name: 'dateDebut', value: joursDans(45) },
      { name: 'dateFin', value: joursDans(50) },
      { name: 'lieu', value: 'Centre scout de Grand-Bassam' },
      { name: 'type', value: 'CAMP', cast: '"TypeActivite"' },
      { name: 'brancheType', value: null },
      { name: 'paroisseId', value: paroisse.id },
      { name: 'creePar', value: chef.id },
    ])

    const scoutsCamp = scoutsCrees.filter((s) => ['ECLAIREURS', 'CHEMINOTS', 'COMPAGNONS'].includes(s.branche))
    const typesAutorisation = ['FICHE_MEDICALE', 'AUTORISATION_PARENTALE']
    for (const [i, s] of scoutsCamp.entries()) {
      const { rows: liensParent } = await client.query(
        `SELECT "parentId" FROM "LienParentScout" WHERE "scoutId" = $1 LIMIT 1`,
        [s.id],
      )
      const parentId: string | null = liensParent[0]?.parentId ?? null
      for (const typeAuto of typesAutorisation) {
        const confirme = i % 3 !== 0
        await upsert('AutorisationCamp', [
          { name: 'id', value: `${campActiviteId}-autorisation-${s.id.slice(-6)}-${typeAuto.toLowerCase()}` },
          { name: 'type', value: typeAuto, cast: '"TypeAutorisationCamp"' },
          { name: 'documentNomFichier', value: confirme ? `${typeAuto.toLowerCase()}-${s.id}.pdf` : null },
          { name: 'documentUrl', value: confirme ? `/uploads/test/${s.id}-${typeAuto.toLowerCase()}.pdf` : null },
          { name: 'confirmeLe', value: confirme ? joursDepuis(2) : null },
          { name: 'activiteId', value: campActivite.id },
          { name: 'scoutId', value: s.id },
          { name: 'confirmeParId', value: confirme ? (parentId ?? s.compteId) : null },
        ])
      }
    }
  }

  // --- Jours de réunion + présences ----------------------------------------

  for (const staff of brancheStaff) {
    const { branche } = staff
    const scoutsBranche = scoutsCrees.filter((s) => s.branche === branche)

    const reunionsPassees = [21, 14, 7]
    for (const jours of reunionsPassees) {
      const jrId = `${prefixe}-reunion-${branche.toLowerCase()}-j${jours}`
      const jr = await upsert('JourReunion', [
        { name: 'id', value: jrId },
        { name: 'brancheType', value: branche, cast: '"BrancheType"' },
        { name: 'titre', value: 'Réunion hebdomadaire' },
        { name: 'dateHeure', value: joursDepuis(jours) },
        { name: 'dureeMinutes', value: 120 },
        { name: 'lieu', value: `Salle ${branche.toLowerCase()}` },
        { name: 'statut', value: 'TERMINEE', cast: '"StatutReunion"' },
        { name: 'dateReportee', value: null },
        { name: 'notes', value: null },
        { name: 'paroisseId', value: paroisse.id },
        { name: 'creePar', value: staff.responsable.id },
      ])
      for (const [i, s] of scoutsBranche.entries()) {
        const statut = i % 6 === 0 ? 'ABSENT' : i % 5 === 0 ? 'EXCUSE' : 'PRESENT'
        await upsert('PresenceReunion', [
          { name: 'id', value: `${jr.id}-presence-${s.id.slice(-6)}` },
          { name: 'statut', value: statut, cast: '"StatutPresenceReunion"' },
          { name: 'note', value: null },
          { name: 'jourReunionId', value: jr.id },
          { name: 'scoutId', value: s.id },
          { name: 'marqueParId', value: staff.adjoint?.id ?? staff.responsable.id },
        ])
      }
    }

    // Réunion planifiée (à venir)
    await upsert('JourReunion', [
      { name: 'id', value: `${prefixe}-reunion-${branche.toLowerCase()}-planifiee` },
      { name: 'brancheType', value: branche, cast: '"BrancheType"' },
      { name: 'titre', value: 'Réunion hebdomadaire' },
      { name: 'dateHeure', value: joursDans(3) },
      { name: 'dureeMinutes', value: 120 },
      { name: 'lieu', value: `Salle ${branche.toLowerCase()}` },
      { name: 'statut', value: 'PLANIFIEE', cast: '"StatutReunion"' },
      { name: 'dateReportee', value: null },
      { name: 'notes', value: null },
      { name: 'paroisseId', value: paroisse.id },
      { name: 'creePar', value: staff.responsable.id },
    ])

    if (avecAdjointsEtEvenementsAnnexes) {
      // Réunion reportée
      await upsert('JourReunion', [
        { name: 'id', value: `${prefixe}-reunion-${branche.toLowerCase()}-reportee` },
        { name: 'brancheType', value: branche, cast: '"BrancheType"' },
        { name: 'titre', value: 'Réunion hebdomadaire' },
        { name: 'dateHeure', value: joursDepuis(2) },
        { name: 'dureeMinutes', value: 120 },
        { name: 'lieu', value: `Salle ${branche.toLowerCase()}` },
        { name: 'statut', value: 'REPORTEE', cast: '"StatutReunion"' },
        { name: 'dateReportee', value: joursDans(5) },
        { name: 'notes', value: 'Reportée pour cause de pluie.' },
        { name: 'paroisseId', value: paroisse.id },
        { name: 'creePar', value: staff.responsable.id },
      ])

      // Réunion annulée
      await upsert('JourReunion', [
        { name: 'id', value: `${prefixe}-reunion-${branche.toLowerCase()}-annulee` },
        { name: 'brancheType', value: branche, cast: '"BrancheType"' },
        { name: 'titre', value: 'Réunion hebdomadaire' },
        { name: 'dateHeure', value: joursDepuis(28) },
        { name: 'dureeMinutes', value: 120 },
        { name: 'lieu', value: `Salle ${branche.toLowerCase()}` },
        { name: 'statut', value: 'ANNULEE', cast: '"StatutReunion"' },
        { name: 'dateReportee', value: null },
        { name: 'notes', value: 'Annulée — indisponibilité du local.' },
        { name: 'paroisseId', value: paroisse.id },
        { name: 'creePar', value: staff.responsable.id },
      ])
    }
  }

  // --- Programmes (groupe + branches) --------------------------------------

  if (avecAdjointsEtEvenementsAnnexes) {
    const progGroupeId = `${prefixe}-programme-groupe`
    await upsert('Programme', [
      { name: 'id', value: progGroupeId },
      { name: 'titre', value: 'Programme annuel du groupe' },
      { name: 'description', value: "Grandes étapes de l'année scoute pour toutes les branches." },
      { name: 'periodeDebut', value: joursDepuis(60) },
      { name: 'periodeFin', value: joursDans(240) },
      { name: 'brancheType', value: null },
      { name: 'paroisseId', value: paroisse.id },
      { name: 'creePar', value: chef.id },
    ])
    const themesGroupe = ['Rentrée scoute', 'Retraite spirituelle', 'Journée diocésaine', "Camp d'été"]
    for (const [ordre, theme] of themesGroupe.entries()) {
      await upsert('LigneProgramme', [
        { name: 'id', value: `${prefixe}-ligne-groupe-${ordre}` },
        { name: 'theme', value: theme },
        { name: 'objectif', value: null },
        { name: 'datePrevue', value: joursDans(20 * (ordre + 1)) },
        { name: 'ordre', value: ordre },
        { name: 'programmeId', value: progGroupeId },
        { name: 'activiteId', value: theme === "Camp d'été" ? campActiviteId : null },
      ])
    }

    for (const staff of brancheStaff) {
      const { branche, code } = staff
      const progId = `${prefixe}-programme-${code.toLowerCase()}`
      await upsert('Programme', [
        { name: 'id', value: progId },
        { name: 'titre', value: `Programme trimestriel — ${branche.toLowerCase()}` },
        { name: 'description', value: `Thèmes pédagogiques de la branche ${branche.toLowerCase()}.` },
        { name: 'periodeDebut', value: joursDepuis(30) },
        { name: 'periodeFin', value: joursDans(90) },
        { name: 'brancheType', value: branche, cast: '"BrancheType"' },
        { name: 'paroisseId', value: paroisse.id },
        { name: 'creePar', value: staff.responsable.id },
      ])
      for (const [ordre, badge] of badgesParBranche[branche].slice(0, 3).entries()) {
        await upsert('LigneProgramme', [
          { name: 'id', value: `${prefixe}-ligne-${code.toLowerCase()}-${ordre}` },
          { name: 'theme', value: `Préparation : ${badge.nom}` },
          { name: 'objectif', value: `Travailler les prérequis du badge « ${badge.nom} ».` },
          { name: 'datePrevue', value: joursDans(15 * (ordre + 1)) },
          { name: 'ordre', value: ordre },
          { name: 'programmeId', value: progId },
          { name: 'activiteId', value: null },
        ])
      }
    }
  }

  return { comptesCrees, indexFinal: idxNom }
}

async function main() {
  await client.connect()

  const { comptesCrees: comptesPrincipaux, indexFinal } = await construireParoisse({
    paroisseId: 'paroisse-saint-paul-cocody',
    paroisseNom: 'Paroisse Saint-Paul de Cocody',
    ville: 'Abidjan',
    diocese: "Diocèse d'Abidjan",
    email: 'saint-paul-cocody@ascci.ci',
    prefixe: 'P1',
    avecAdjointsEtEvenementsAnnexes: true,
    nbAssistantsGroupe: 3,
    nbAssistantsBranchePar: 2,
    nbScoutsParBranche: 14,
    nbComptesScoutParBranche: { OISILLONS: 0, LOUVETEAUX: 4, ECLAIREURS: 10, CHEMINOTS: 13, COMPAGNONS: 13 },
    nbParents: 28,
    indexDepart: 0,
  })

  // Deuxième paroisse (jeu de données réduit) pour vérifier l'isolation
  // multi-paroisse : un ADMIN_PAROISSE ne doit voir/gérer que sa propre paroisse.
  const { comptesCrees: comptesSecondaires } = await construireParoisse({
    paroisseId: 'paroisse-ste-therese-yopougon',
    paroisseNom: 'Paroisse Sainte-Thérèse de Yopougon',
    ville: 'Abidjan',
    diocese: "Diocèse d'Abidjan",
    email: 'ste-therese-yopougon@ascci.ci',
    prefixe: 'P2',
    avecAdjointsEtEvenementsAnnexes: false,
    nbAssistantsGroupe: 0,
    nbAssistantsBranchePar: 0,
    nbScoutsParBranche: 1,
    nbComptesScoutParBranche: { OISILLONS: 0, LOUVETEAUX: 0, ECLAIREURS: 1, CHEMINOTS: 0, COMPAGNONS: 0 },
    nbParents: 1,
    indexDepart: indexFinal,
  })

  const tousLesComptes = [...comptesPrincipaux, ...comptesSecondaires]

  console.log(`\n\n=== Résumé : ${tousLesComptes.length} utilisateurs créés/à jour ===\n`)
  const parRole = new Map<string, typeof tousLesComptes>()
  for (const c of tousLesComptes) {
    const liste = parRole.get(c.role) ?? []
    liste.push(c)
    parRole.set(c.role, liste)
  }
  for (const [role, comptes] of parRole) {
    console.log(`\n-- ${role} (${comptes.length}) — mot de passe : ${comptes[0].motDePasse}`)
    for (const c of comptes.slice(0, 3)) {
      console.log(`   ${c.identifiant}  (${c.nom})`)
    }
    if (comptes.length > 3) console.log(`   ... et ${comptes.length - 3} autre(s)`)
  }

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
