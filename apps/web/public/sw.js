// Service worker minimal : n'existe que pour satisfaire les critères
// d'installabilité PWA de Chrome/Android (manifest + SW enregistré avec un
// gestionnaire fetch). Aucune mise en cache applicative volontaire — les
// données (présences, documents, cotisations...) doivent toujours venir du
// réseau, jamais d'un cache qui pourrait devenir incohérent ou obsolète.
self.addEventListener('install', () => {
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim())
})

self.addEventListener('fetch', () => {
  // Volontairement vide : laisse le navigateur gérer la requête normalement.
})
