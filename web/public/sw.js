/*
 * Service worker d'Autoverse : application installable et utilisable hors ligne.
 * - Pages : réseau d'abord, repli sur la dernière version en cache (l'app s'ouvre sans connexion).
 * - Données (/data/*.json) : réseau d'abord, repli sur la dernière copie (les écrans indiquent la date).
 * - Fichiers de l'application (/assets, polices, icônes) : cache d'abord (noms versionnés par le build).
 * - Photos (Wikimedia, médias) : cache puis mise à jour en arrière-plan, nombre d'entrées limité.
 */
const VERSION = 'v3';
const SHELL = `autoverse-shell-${VERSION}`;
const DATA = `autoverse-data-${VERSION}`;
const IMAGES = `autoverse-images-${VERSION}`;
const MAX_IMAGES = 250;

const base = new URL(self.registration.scope).pathname; // ex. /AutoVerse/

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(SHELL)
      .then((c) => c.addAll([base, `${base}manifest.webmanifest`, `${base}favicon.svg`, `${base}icons/icon-192.png`]))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('autoverse-') && ![SHELL, DATA, IMAGES].includes(k)).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

async function networkFirst(request, cacheName, fallbackUrl) {
  const cache = await caches.open(cacheName);
  try {
    const response = await fetch(request);
    if (response.ok) cache.put(fallbackUrl ?? request, response.clone());
    return response;
  } catch (e) {
    const cached = await cache.match(fallbackUrl ?? request);
    if (cached) return cached;
    throw e;
  }
}

async function cacheFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response.ok) cache.put(request, response.clone());
  return response;
}

async function trim(cacheName, max) {
  const cache = await caches.open(cacheName);
  const keys = await cache.keys();
  await Promise.all(keys.slice(0, Math.max(0, keys.length - max)).map((k) => cache.delete(k)));
}

async function staleWhileRevalidate(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  const update = fetch(request)
    .then((response) => {
      // Réponses « opaques » (autres domaines) acceptées : statut illisible mais image affichable.
      if (response.ok || response.type === 'opaque') cache.put(request, response.clone()).then(() => trim(cacheName, MAX_IMAGES));
      return response;
    })
    .catch(() => cached);
  return cached ?? update;
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);

  if (request.mode === 'navigate' && url.origin === self.location.origin) {
    // Application monopage : toutes les routes servent index.html.
    event.respondWith(networkFirst(request, SHELL, base));
    return;
  }
  if (url.origin === self.location.origin && url.pathname.startsWith(`${base}data/`)) {
    event.respondWith(networkFirst(request, DATA));
    return;
  }
  if (url.origin === self.location.origin) {
    event.respondWith(cacheFirst(request, SHELL));
    return;
  }
  if (request.destination === 'image') {
    event.respondWith(staleWhileRevalidate(request, IMAGES));
  }
});

// ---------- Notifications push (nouvelles dates de sortie, résultats F1 / WEC / WRC) ----------
self.addEventListener('push', (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    payload = { body: event.data?.text() };
  }
  const title = payload.title || 'Autoverse';
  event.waitUntil(self.registration.showNotification(title, {
    body: payload.body || '',
    tag: payload.tag,
    icon: `${base}icons/icon-192.png`,
    badge: `${base}icons/icon-192.png`,
    lang: 'fr',
    data: { url: payload.url || base },
  }));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const target = event.notification.data?.url || base;
  event.waitUntil((async () => {
    // Réutilise une fenêtre déjà ouverte de l'application si possible.
    const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const client of windows) {
      if (new URL(client.url).pathname.startsWith(base) && 'navigate' in client) {
        await client.focus();
        return client.navigate(target);
      }
    }
    return self.clients.openWindow(target);
  })());
});
