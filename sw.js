// Service worker : met le jeu en cache pour qu'il fonctionne hors ligne.
// __APP_VERSION__ est remplacé par le numéro de build lors de la publication : chaque version
// a donc son propre cache, et le navigateur détecte automatiquement une nouvelle version.
const CACHE = 'totalkill2000-__APP_VERSION__';
const FILES = [
  './',
  './index.html',
  './manifest.webmanifest',
  './lib/peerjs.min.js',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/maskable-512.png'
];

self.addEventListener('install', e => {
  // cache:'reload' contourne le cache HTTP pour être sûr de récupérer les nouveaux fichiers
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES.map(f => new Request(f, { cache: 'reload' })))));
  // Pas de skipWaiting ici : le jeu propose la mise à jour et l'active à la demande du joueur.
});

self.addEventListener('message', e => {
  if (e.data === 'skipWaiting') self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const req = e.request;
  const url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== self.location.origin) return;
  if (url.pathname.endsWith('/version.json')) return; // toujours depuis le réseau
  e.respondWith(
    caches.open(CACHE).then(async cache => {
      const cached = await cache.match(req, { ignoreSearch: true });
      if (cached) return cached;
      try {
        const res = await fetch(req);
        if (res && res.ok) cache.put(req, res.clone());
        return res;
      } catch (err) {
        if (req.mode === 'navigate') return cache.match('./index.html');
        return Response.error();
      }
    })
  );
});
