// Beyin servis çalışanı (K-031): yalnız sayfa açılışlarına bakar; sunucu kapalıysa boş ekran yerine "Beyin kapalı" sayfası.
// Başka hiçbir isteği önbelleğe almaz: veri ve kod her zaman sunucudan, taze gelir.
const SURUM = 'beyin-3', KAPALI = '/uygulama/kapali.html';
self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(SURUM).then((c) => c.addAll([KAPALI, '/uygulama/ikon.svg'])).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((k) => Promise.all(k.filter((x) => x !== SURUM).map((x) => caches.delete(x)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', (e) => {
  if (e.request.mode !== 'navigate') return;
  e.respondWith(fetch(e.request).catch(() => caches.match(KAPALI)));
});
