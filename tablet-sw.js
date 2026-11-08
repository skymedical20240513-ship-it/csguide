// 看護師用タブレット説明アプリ（tablet.html）専用。患者用アプリ（index.html）には関係しません。
// ネットにつながるときは GitHub の最新版を使い、つながらないときは前回の版で開きます。
// Ver2.15.0：動画（tablet-movie-*.mp4）は一度読み込んだらタブレットに保存し、次からはネットなしでも再生できます。
const CACHE = 'tablet-app-v1';
const MOVIE_CACHE = 'tablet-movie-v1';
const FILES = ['tablet.html', 'tablet.webmanifest', 'tablet-icon-192.png', 'tablet-icon-512.png'];
const MOVIES = ['tablet-movie-dissolve.mp4', 'tablet-movie-drink.mp4'];
self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES)).catch(() => {}));
  self.skipWaiting();
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k =>
    (k.startsWith('tablet-app-') && k !== CACHE) || (k.startsWith('tablet-movie-') && k !== MOVIE_CACHE)
  ).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});

// 動画を丸ごと保存（同じ動画を同時に何度も取りに行かないようにする）
const saving = new Set();
async function saveMovie(name, url) {
  if (saving.has(name)) return;
  saving.add(name);
  try {
    const r = await fetch(url, { cache: 'no-cache' });
    if (r.ok && r.status === 200) await (await caches.open(MOVIE_CACHE)).put(name, r);
  } catch (_) {} finally { saving.delete(name); }
}
// 保存した動画から、再生に必要な部分だけを返す
async function fromSaved(resp, range) {
  const buf = await resp.arrayBuffer();
  const total = buf.byteLength;
  const type = resp.headers.get('Content-Type') || 'video/mp4';
  const m = /bytes=(\d*)-(\d*)/.exec(range || '');
  if (!m) return new Response(buf, { status: 200, headers: { 'Content-Type': type, 'Content-Length': String(total), 'Accept-Ranges': 'bytes' } });
  let start = m[1] === '' ? total - Number(m[2]) : Number(m[1]);
  let end = (m[1] !== '' && m[2] !== '') ? Number(m[2]) : total - 1;
  start = Math.max(0, start); end = Math.min(end, total - 1);
  if (start > end) return new Response(null, { status: 416, headers: { 'Content-Range': `bytes */${total}` } });
  return new Response(buf.slice(start, end + 1), { status: 206, headers: {
    'Content-Type': type, 'Content-Length': String(end - start + 1),
    'Content-Range': `bytes ${start}-${end}/${total}`, 'Accept-Ranges': 'bytes' } });
}

self.addEventListener('fetch', e => {
  const u = new URL(e.request.url);
  if (e.request.method !== 'GET' || u.origin !== location.origin) return;
  const name = u.pathname.split('/').pop();
  if (MOVIES.includes(name)) {
    e.respondWith((async () => {
      const saved = await (await caches.open(MOVIE_CACHE)).match(name);
      if (saved) return fromSaved(saved, e.request.headers.get('Range'));
      e.waitUntil(saveMovie(name, u.href));   // 再生しながら裏で丸ごと保存
      return fetch(e.request);
    })());
    return;
  }
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
