/* Service worker do Laboratório de Cafeteria.
 * Estratégia: REDE PRIMEIRO para os arquivos do app (sempre pega a versão
 * publicada quando há internet) e CACHE como reserva para funcionar offline.
 * Troque VERSAO a cada publicação para forçar a atualização nos aparelhos. */
const VERSAO = '2026-10-30.2';
const CACHE = 'cafelab-' + VERSAO;
const ASSETS = ['./', './index.html', './styles.css', './fotos.js', './data.js', './icones.js', './engine.js', './mascote.js', './app.js', './tutorial.js', './timer.js', './rotulo.js', './cafeina.js', './latte.js', './sync.js', './vendor/anthropic-sdk.mjs', './manifest.webmanifest',
  './icons/icon.svg', './icons/icon-192.png', './icons/icon-512.png', './icons/icon-512-maskable.png'];

self.addEventListener('install', (e) => {
  // cache: 'reload' ignora o cache HTTP do navegador/CDN e baixa os arquivos novos
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS.map((u) => new Request(u, { cache: 'reload' })))).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    const antigos = (await caches.keys()).filter((k) => k !== CACHE);
    await Promise.all(antigos.map((k) => caches.delete(k)));
    await self.clients.claim();
    // substituiu uma versão anterior: recarrega as telas abertas para já mostrar a nova
    if (antigos.length) {
      const janelas = await self.clients.matchAll({ type: 'window' });
      janelas.forEach((c) => { try { c.navigate(c.url); } catch (err) { /* navegador sem suporte */ } });
    }
  })());
});
self.addEventListener('message', (e) => { if (e.data === 'versao' && e.source) e.source.postMessage({ versao: VERSAO }); });
self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // APIs e CDNs: direto na rede
  e.respondWith((async () => {
    try {
      const res = await fetch(req, { cache: 'no-cache' }); // revalida com o servidor
      if (res && res.ok) { const copia = res.clone(); caches.open(CACHE).then((c) => c.put(req, copia)); }
      return res;
    } catch (err) {
      const hit = await caches.match(req, { ignoreSearch: true });
      return hit || (req.mode === 'navigate' ? caches.match('./index.html') : Response.error());
    }
  })());
});
