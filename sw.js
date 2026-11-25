const CACHE_NAME = 'monesito-cache-v1';
const CDN_CACHE = 'monesito-cdn-v1';

const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './style.css',
  './script.js',
  './manifest.json',
  './icons/favicon.ico',
  './icons/favicon-32.png',
  './icons/favicon-48.png',
  './icons/apple-touch-icon.png',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-512.png'
];

// Só estes arquivos externos são guardados (ícones Font Awesome e Firebase, com versão fixa)
function ehCdnPermitido(url) {
  return (url.hostname === 'cdnjs.cloudflare.com' && url.pathname.includes('/font-awesome/')) ||
         (url.hostname === 'www.gstatic.com' && url.pathname.includes('/firebasejs/'));
}

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) =>
      Promise.all(ASSETS_TO_CACHE.map((asset) => cache.add(asset).catch(() => {})))
    )
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((nomes) =>
      Promise.all(
        nomes
          .filter((nome) => nome.startsWith('monesito-') && nome !== CACHE_NAME && nome !== CDN_CACHE)
          .map((nome) => caches.delete(nome))
      )
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);

  // Ícones e Firebase: usa o que já foi guardado, senão busca e guarda
  if (ehCdnPermitido(url)) {
    event.respondWith(
      caches.open(CDN_CACHE).then((cache) =>
        cache.match(req).then((guardado) => {
          if (guardado) return guardado;
          return fetch(req).then((res) => {
            if (res && (res.status === 200 || res.type === 'opaque')) cache.put(req, res.clone());
            return res;
          });
        })
      )
    );
    return;
  }

  // Qualquer outro domínio (Firestore, etc.) passa direto
  if (url.origin !== self.location.origin) return;

  // Rede primeiro: sempre busca a versão mais nova do app.
  // O cache só é usado quando está sem internet.
  event.respondWith(
    fetch(req)
      .then((res) => {
        if (res && res.status === 200) {
          const copia = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(req, copia));
        }
        return res;
      })
      .catch(() =>
        caches.match(req, { ignoreSearch: true }).then((r) => r || caches.match('./index.html'))
      )
  );
});