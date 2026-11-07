// 看護師用タブレット説明アプリ（tablet.html）専用。患者用アプリ（index.html）には関係しません。
// ネットにつながるときは GitHub の最新版を使い、つながらないときは前回の版で開きます。
const CACHE = 'tablet-app-v1';
const FILES = ['tablet.html', 'tablet.webmanifest', 'tablet-icon-192.png', 'tablet-icon-512.png'];
self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES)).catch(() => {}));
  self.skipWaiting();
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k.startsWith('tablet-app-') && k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const u = new URL(e.request.url);
  if (e.request.method !== 'GET' || u.origin !== location.origin) return;
  const name = u.pathname.split('/').pop();
  if (!FILES.includes(name)) return;
  e.respondWith((async () => {
    const c = await caches.open(CACHE);
    try {
      const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), 4000);
      const r = await fetch(e.request, { cache: 'no-cache', signal: ctl.signal }); clearTimeout(t);
      if (r.ok) c.put(name, r.clone());
      return r;
    } catch (_) {
      return (await c.match(name)) || Response.error();
    }
  })());
});
