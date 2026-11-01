const VERSION = 'ocr-pwa-v3';
const SHELL = VERSION + '-shell';
const RUNTIME = VERSION + '-runtime';

const PRECACHE = [
  './',
  './index.html',
  './manifest.json',
  './icon.svg',
  './offline.html'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(SHELL).then(cache => cache.addAll(PRECACHE)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(k => k !== SHELL && k !== RUNTIME).map(k => caches.delete(k)));
    await self.clients.claim();
  })());
});

function isCDN(url) {
  return /cdnjs\.cloudflare\.com|cdn\.jsdelivr\.net|unpkg\.com|tessdata\.projectnaptha\.com/i.test(url);
}

self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);

  if (req.mode === 'navigate') {
    event.respondWith((async () => {
      try {
        const fresh = await fetch(req);
        const cache = await caches.open(SHELL);
        cache.put('./index.html', fresh.clone());
        return fresh;
      } catch {
        return (await caches.match('./index.html')) || (await caches.match('./offline.html'));
      }
    })());
    return;
  }

  if (url.origin === location.origin) {
    event.respondWith(
      caches.match(req).then(cached => cached || fetch(req).then(res => {
        const copy = res.clone();
        caches.open(SHELL).then(c => c.put(req, copy));
        return res;
      }).catch(() => caches.match('./offline.html')))
    );
    return;
  }

  if (isCDN(req.url)) {
    event.respondWith((async () => {
      const cache = await caches.open(RUNTIME);
      const cached = await cache.match(req);
      if (cached) return cached;
      try {
        const res = await fetch(req);
        if (res.ok) cache.put(req, res.clone());
        return res;
      } catch {
        if (cached) return cached;
        throw new Error('offline');
      }
    })());
  }
});
