/* App Assentos MVV: guarda os arquivos para abrir rápido e sem internet.
 * Os dados ao vivo (Firebase) nunca passam por aqui. Ao mudar arquivos do app, troque a VERSAO. */
var VERSAO = 'assentos-v3';
var APP = ['./', './index.html', './locais.js', './mapa3d.js', './reserva.js', './manifest.webmanifest',
  './icone-192.png', './icone-512.png', './apple-touch-icon.png', './favicon-32.png', './capa.png'];
var FIXOS = /^https:\/\/(cdn\.jsdelivr\.net\/npm\/three@|www\.gstatic\.com\/firebasejs\/|fonts\.(googleapis|gstatic)\.com\/)/;

self.addEventListener('install', function (e) {
  e.waitUntil(caches.open(VERSAO).then(function (c) { return c.addAll(APP); }).then(function () { return self.skipWaiting(); }));
});
self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (ks) {
    return Promise.all(ks.filter(function (k) { return k !== VERSAO; }).map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});
self.addEventListener('fetch', function (e) {
  var req = e.request; if (req.method !== 'GET') return;
  var url = new URL(req.url);
  if (url.origin === location.origin) {
    // Arquivos do app: tenta a versão nova na internet; sem conexão, usa a guardada.
    e.respondWith(fetch(req).then(function (r) {
      if (r.ok) { var cp = r.clone(); caches.open(VERSAO).then(function (c) { c.put(req, cp); }); }
      return r;
    }).catch(function () {
      return caches.match(req, { ignoreSearch: true }).then(function (r) { return r || caches.match('./index.html'); });
    }));
  } else if (FIXOS.test(req.url)) {
    // Bibliotecas com versão fixa e fontes: usa a guardada; busca só na primeira vez.
    e.respondWith(caches.match(req).then(function (r) {
      return r || fetch(req).then(function (n) {
        if (n.ok || n.type === 'opaque') { var cp = n.clone(); caches.open(VERSAO).then(function (c) { c.put(req, cp); }); }
        return n;
      });
    }));
  }
});
