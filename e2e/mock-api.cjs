/* Serveur déterministe E2E exclusivement en mémoire. Ne vérifie pas la sécurité de l'API NestJS. */
const http = require('node:http')
const membre = {
  id: 'membre-test', nom: 'Exemple', prenom: 'Awa', email: 'awa@example.invalid',
  matricule: 'TEST001', telephone: null, role: 'CHEF_GROUPE', roleDistrict: null,
  paroisseId: 'paroisse-test', brancheType: null, actif: true, enfants: [],
  paroisse: { id: 'paroisse-test', nom: 'Paroisse de test' }, createdAt: '2026-01-01T00:00:00.000Z',
}
const paroisse = { id: 'paroisse-test', nom: 'Paroisse de test', ville: 'Ville de test', diocese: 'Test', actif: true, logo: null }
const rapports = {
  totaux: { paroisses: 1, paroissesActives: 1, scouts: 3, utilisateurs: 1, activites: 2 },
  kpis: { activitesMois: 2, tauxPresence: 75, cotisationsPayees: 0, cotisationsEnAttente: 0, utilisateursParCategorie: { staff: 1, parents: 0, comptesScouts: 0 } },
  paroisses: [{ ...paroisse, scouts: 3, utilisateurs: 1, activites: 2, cotisations: 0 }],
}
const scout = {
  id: 'scout-test', nom: 'Synthétique', prenom: 'Koffi', dateNaissance: '2013-01-01T00:00:00.000Z',
  sexe: 'MASCULIN', brancheType: 'ECLAIREURS', matricule: 'SCOUT001', actif: true,
  photo: null, allergies: null, traitementsMedicaux: null, consentementImage: false, consentementImageDate: null,
  consentementSante: false, consentementSanteDate: null, paroisseId: 'paroisse-test', utilisateurId: null,
  contactsUrgence: [], liensParents: [], documents: [], cotisations: [], createdAt: '2026-01-01T00:00:00.000Z',
}
const activite = { id: 'activite-test', titre: 'Réunion de test', description: null, dateDebut: '2026-01-10T10:00:00.000Z', dateFin: null, lieu: 'Lieu fictif', type: 'REUNION', brancheType: null, paroisseId: 'paroisse-test', creePar: 'membre-test', _count: { presences: 1 }, createdAt: '2026-01-01T00:00:00.000Z' }
const cookies = (valeur) => [`scout_acces=${valeur}; Path=/; HttpOnly; SameSite=Lax`, `scout_session=${valeur}; Path=/; HttpOnly; SameSite=Lax`]
const serveur = http.createServer(async (req, res) => {
  const chemin = new URL(req.url, 'http://127.0.0.1').pathname
  const cle = /scout_acces=([^;]+)/.exec(req.headers.cookie || '')?.[1] || ''
  const utilisateur = { ...membre, role: cle.includes('admin') ? 'ADMIN_PLATEFORME' : 'CHEF_GROUPE', doitChangerMotDePasse: cle.includes('temp') }
  const repondre = (donnees, status = 200, entetes = {}) => { res.writeHead(status, { 'content-type': 'application/json', ...entetes }); res.end(JSON.stringify(donnees)) }
  let corps = ''
  for await (const fragment of req) corps += fragment
  const data = corps ? JSON.parse(corps) : {}
  if (chemin === '/health') return repondre({ ok: true })
  if (chemin === '/api/public/identite') return repondre({
    nomSite: 'SCOUT E2E', sousTitreSite: 'Environnement simulé', logoUrl: null,
    theme: { couleurPrimaire: '#1a4731', couleurAccent: '#f39c12', couleurFond: '#f7faf8', couleurHover: '#246344' },
    accueil: { badge: null, titre: null, sousTitre: null, imageUrl: null, imageAlt: null, stats: null },
  })
  if (chemin === '/api/auth/connexion') {
    if (data.password === 'incorrect') return repondre({ erreur: 'Identifiant ou mot de passe incorrect.' }, 401)
    const session = `${String(data.identifiant).includes('ADMIN') ? 'admin' : 'paroisse'}${String(data.identifiant).includes('TEMP') ? '-temp' : ''}`
    return repondre({ utilisateur: { ...membre, role: session.includes('admin') ? 'ADMIN_PLATEFORME' : 'CHEF_GROUPE', doitChangerMotDePasse: session.includes('temp') } }, 200, { 'set-cookie': cookies(session) })
  }
  if (chemin === '/api/auth/deconnexion' || chemin === '/api/auth/changer-mot-de-passe') return repondre({ message: 'Session fermée' }, 200, { 'set-cookie': cookies('').map((c) => `${c}; Max-Age=0`) })
  if (chemin === '/api/auth/session') return cle ? repondre({ utilisateur }) : repondre({ erreur: 'Non authentifié' }, 401)
  if (chemin === '/api/public/logo') return repondre({ nomSite: 'SCOUT E2E', sousTitreSite: 'Tests', logoUrl: null })
  if (chemin === '/api/scouts') return repondre({ scouts: [scout], total: 1, page: 1, totalPages: 1 })
  if (chemin === '/api/scouts/scout-test') return repondre(scout)
  if (chemin === '/api/activites') return repondre({ activites: [activite], pagination: { total: 1, totalPages: 1, page: 1 } })
  if (chemin === '/api/activites/activite-test') return repondre(activite)
  if (chemin === '/api/activites/activite-test/presences') return repondre(req.method === 'POST' ? { message: 'Enregistré' } : [{ id: 'presence-test', present: false, commentaire: null, scout }])
  if (chemin === '/api/admin/audit') return repondre({ entrees: [{ id: 'audit-test', action: 'MODIFICATION_UTILISATEUR', entite: 'Utilisateur', entiteId: membre.id, details: { operation: 'Nomination de test' }, createdAt: '2026-01-10T10:00:00.000Z', acteur: membre, paroisse }], pagination: { totalPages: 1 } })
  if (chemin === '/api/admin/utilisateurs/membre-test/nominations') return repondre({ ...membre, ...data })
  if (chemin === '/api/paroisse') return repondre(paroisse)
  if (chemin === '/api/admin/paroisses') return repondre([paroisse])
  if (chemin === '/api/admin/districts') return repondre({ districts: [] })
  if (chemin === '/api/admin/rapports') return repondre(rapports)
  if (chemin === '/api/dashboard/kpis') return repondre({ kpis: { Scouts: 3, Activités: 2 }, activitesRecentes: [] })
  if (/^\/api\/(admin\/)?utilisateurs$/.test(chemin)) {
    if (req.method === 'POST') return repondre({ ...membre, ...data, motDePasseTemporaire: 'Secret-Test-Unique!42' }, 201)
    return repondre({ utilisateurs: [membre], total: 1, page: 1, totalPages: 1 })
  }
  if (/^\/api\/(admin\/)?utilisateurs\/membre-test$/.test(chemin)) return repondre({ ...membre, ...data })
  return repondre({ erreur: 'Route absente du scénario E2E' }, 404)
})
serveur.listen(4199, '127.0.0.1')
