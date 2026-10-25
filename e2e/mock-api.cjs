/* Serveur déterministe E2E exclusivement en mémoire, aligné sur les contrats
   actuels de l'API (application web unique, plateforme mono-paroissiale).
   Ne vérifie ni la sécurité de l'API NestJS ni la persistance Prisma. */
const http = require('node:http')

const identite = {
  nomParoisse: 'Paroisse de test',
  nomGroupe: 'Groupe scout E2E au nom volontairement long',
  ville: 'Ville de test',
  diocese: null,
  presentation: 'Présentation fictive du groupe.',
  messageBienvenue: null,
  anneeHistorique: 1956,
  rangHistorique: null,
  sourceHistorique: null,
  adresse: null,
  telephone: null,
  email: null,
  horaires: null,
  logoUrl: null,
  theme: { couleurPrimaire: '#2f5d3a', couleurAccent: '#b5653f', couleurFond: '#1f3a28', couleurHover: '#c27a52' },
  accueil: { titre: null, sousTitre: null, imageUrl: null, imageAlt: null },
  reseauxSociaux: {},
  inscriptionsOuvertes: true,
}

const membre = {
  id: 'membre-test', nom: 'Exemple', prenom: 'Awa', email: 'awa@example.invalid', matricule: 'TEST001', telephone: null,
  role: 'CHEF_GROUPE', fonction: null, brancheType: null, actif: true, editeurContenu: true, profilPublic: false,
  doitChangerMotDePasse: false, createdAt: '2026-01-01T00:00:00.000Z',
}
const responsable = { ...membre, id: 'resp-test', prenom: 'Yao', nom: 'Kouassi', matricule: 'TEST002', role: 'RESPONSABLE_BRANCHE', brancheType: 'LOUVETEAUX' }

const branches = ['OISILLONS', 'LOUVETEAUX', 'ECLAIREURS', 'CHEMINOTS', 'COMPAGNONS', 'RESSOURCES_ADULTES'].map((type, i) => ({
  type, slug: type.toLowerCase(), nom: type === 'COMPAGNONS' ? 'Routiers' : type.charAt(0) + type.slice(1).toLowerCase(), trancheAge: `${6 + i * 3}-${8 + i * 3} ans`,
  presentation: null, imageUrl: null, imageAlt: null,
}))

const pagination = (total = 0) => ({ page: 1, limite: 12, total, totalPages: Math.max(1, total) })

// Tableau de bord du profil DIRECTION (GET /api/tableau-de-bord).
const tableauDeBord = {
  profil: 'DIRECTION',
  indicateurs: [{ cle: 'effectif', libelle: 'Scouts actifs', valeur: 3 }],
  alertes: [{ niveau: 'critique', message: '1 scout(s) sans contact d’urgence.', lien: '/dashboard/scouts' }],
  actions: [{ libelle: 'Inscrire un scout', lien: '/dashboard/scouts/nouveau' }],
  activitesAVenir: [],
  repartitionBranches: branches.map((b) => ({ brancheType: b.type, effectif: b.type === 'LOUVETEAUX' ? 3 : 0 })),
}

const cookies = (valeur) => [`scout_acces=${valeur}; Path=/; HttpOnly; SameSite=Lax`, `scout_session=${valeur}; Path=/; HttpOnly; SameSite=Lax`]

const serveur = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://127.0.0.1')
  const chemin = url.pathname
  const cle = /scout_acces=([^;]+)/.exec(req.headers.cookie || '')?.[1] || ''
  const role = cle.includes('admin') ? 'ADMINISTRATEUR' : 'CHEF_GROUPE'
  const utilisateur = { ...membre, role, doitChangerMotDePasse: cle.includes('temp') }
  const repondre = (donnees, status = 200, entetes = {}) => {
    res.writeHead(status, { 'content-type': 'application/json', ...entetes })
    res.end(JSON.stringify(donnees))
  }
  let corps = ''
  for await (const fragment of req) corps += fragment
  const data = corps ? JSON.parse(corps) : {}

  if (chemin === '/health') return repondre({ ok: true })

  // --- Site public ---
  if (chemin === '/api/public/identite' || chemin === '/api/configuration') return repondre(identite)
  if (chemin === '/api/public/accueil') return repondre({ branches, actualites: [], activites: [], photos: [], equipe: [], histoire: [] })
  if (chemin === '/api/public/branches') return repondre(branches)
  const fiche = /^\/api\/public\/branches\/([a-z_]+)$/.exec(chemin)
  if (fiche) {
    const b = branches.find((x) => x.slug === fiche[1])
    return b ? repondre({ ...b, identite: null, objectifs: null, pedagogie: null, activitesTypes: null, responsables: [], activites: [] }) : repondre({ erreur: 'Branche introuvable' }, 404)
  }
  if (chemin === '/api/public/galerie') return repondre({ albums: [], pagination: pagination(0) })
  if (chemin === '/api/public/activites') return repondre({ activites: [], pagination: pagination(0) })
  if (chemin === '/api/public/publications') return repondre({ publications: [], pagination: pagination(0) })
  if (chemin === '/api/public/categories') return repondre([])
  if (chemin === '/api/public/histoire') return repondre([])
  if (chemin === '/api/public/equipe') {
    return repondre([
      { id: membre.id, prenom: 'Awa', nom: 'Exemple', fonction: 'Cheffe de groupe', branche: null, brancheType: null, photo: null, biographie: null },
      { id: responsable.id, prenom: 'Yao', nom: 'Kouassi', fonction: 'Chef Louveteaux', branche: 'Louveteaux', brancheType: 'LOUVETEAUX', photo: null, biographie: null },
    ])
  }
  if (chemin === '/api/public/demandes' && req.method === 'POST') return repondre({ message: 'Demande reçue' }, 201)

  // --- Authentification ---
  if (chemin === '/api/auth/connexion') {
    if (data.password === 'incorrect') return repondre({ erreur: 'Identifiant ou mot de passe incorrect.' }, 401)
    const session = `${String(data.identifiant).includes('ADMIN') ? 'admin' : 'groupe'}${String(data.identifiant).includes('TEMP') ? '-temp' : ''}`
    // Contrat réel : aucun champ paroisseId (plateforme mono-paroissiale).
    return repondre(
      { utilisateur: { id: membre.id, matricule: data.identifiant, email: '', nom: membre.nom, prenom: membre.prenom, role: session.includes('admin') ? 'ADMINISTRATEUR' : 'CHEF_GROUPE', editeurContenu: true, doitChangerMotDePasse: session.includes('temp') } },
      200,
      { 'set-cookie': cookies(session) },
    )
  }
  if (chemin === '/api/auth/deconnexion' || chemin === '/api/auth/changer-mot-de-passe') {
    return repondre({ message: 'Session fermée' }, 200, { 'set-cookie': cookies('').map((c) => `${c}; Max-Age=0`) })
  }
  if (chemin === '/api/auth/session') return cle ? repondre({ utilisateur }) : repondre({ erreur: 'Non authentifié' }, 401)
  if (chemin === '/api/auth/rafraichir') return repondre({ erreur: 'Session expirée' }, 401)

  if (!cle) return repondre({ erreur: 'Non authentifié' }, 401)

  // --- Espace privé ---
  if (chemin === '/api/tableau-de-bord') return repondre(tableauDeBord)
  if (chemin === '/api/me/branche') return repondre({ brancheType: null, role })
  if (chemin === '/api/utilisateurs/maitrise') {
    return repondre({
      direction: [{ ...membre, fonction: null }],
      branches: branches.map((b) => ({ brancheType: b.type, libelle: b.nom, membres: b.type === 'LOUVETEAUX' ? [responsable] : [] })),
    })
  }
  if (chemin === `/api/utilisateurs/${responsable.id}`) return repondre({ ...responsable, fonctionPublique: null, photoPublique: null, biographie: null, ordrePublic: 0 })
  if (chemin === `/api/utilisateurs/${responsable.id}/profil-public`) return repondre({ ...responsable, ...data })
  if (chemin === '/api/admin/utilisateurs') {
    if (req.method === 'POST') return repondre({ ...membre, ...data, id: 'nouveau-test', motDePasseTemporaire: 'Secret-Test-Unique!42' }, 201)
    return repondre({ utilisateurs: [utilisateur, responsable], total: 2, page: 1, totalPages: 1 })
  }
  return repondre({ erreur: 'Route absente du scénario E2E' }, 404)
})
serveur.listen(4199, '127.0.0.1')
