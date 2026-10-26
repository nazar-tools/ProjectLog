// Project Log service worker: works offline and picks up new versions in the background.
// The cache name comes from js/version.js, so bumping the version there is all an update needs.
importScripts('js/version.js');
const CACHE = 'projectlog-' + self.APP_VERSION;
const FILES = [
  './', 'index.html', 'manifest.webmanifest', 'css/styles.css',
  'js/version.js', 'js/seed.js', 'js/store.js', 'js/core.js',
  'js/views/outline.js', 'js/views/week.js', 'js/views/plan.js', 'js/views/projects.js',
  'js/views/project.js', 'js/views/time.js', 'js/views/settings.js',
  'js/actions.js', 'js/app.js',
  'icons/favicon.svg', 'icons/icon-192.png', 'icons/icon-512.png', 'icons/icon-maskable-512.png', 'icons/apple-touch-icon.png'
];

self.addEventListener('install', e => {
  // cache: 'reload' skips the browser's HTTP cache, so a new version never installs old files.
  const requests = FILES.map(f => new Request(f, { cache: 'reload' }));
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(requests)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

// Stale-while-revalidate: answer from the cache right away, refresh the cache from the network.
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET' || new URL(e.request.url).origin !== location.origin) return;
  e.respondWith(caches.open(CACHE).then(async cache => {
    const hit = await cache.match(e.request, { ignoreSearch: true });
    const fresh = fetch(e.request).then(res => {
      if (res.ok) cache.put(e.request, res.clone());
      return res;
    }).catch(() => hit);
    return hit || fresh;
  }));
});
