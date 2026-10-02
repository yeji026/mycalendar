// 서비스워커 — 오프라인 지원
const CACHE = 'workcal-v1';
const ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './css/style.css',
  './js/holidays.js',
  './js/base-schedule.js',
  './js/dates.js',
  './js/store.js',
  './js/schedule.js',
  './js/app.js',
  './icon/icon.svg',
  './icon/icon-192.png',
  './icon/icon-512.png'
];

self.addEventListener('install', function (e) {
  e.waitUntil(
    caches.open(CACHE).then(function (c) {
      // 일부 자원이 없어도 설치가 실패하지 않도록 개별 처리
      return Promise.all(ASSETS.map(function (url) {
        return c.add(url).catch(function () {});
      }));
    }).then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener('activate', function (e) {
  e.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.filter(function (k) { return k !== CACHE; }).map(function (k) { return caches.delete(k); }));
    }).then(function () { return self.clients.claim(); })
  );
});

self.addEventListener('fetch', function (e) {
  if (e.request.method !== 'GET') return;
  const url = new URL(e.request.url);
  // 외부(CDN 폰트 등)는 네트워크 우선, 실패 시 캐시
  if (url.origin !== self.location.origin) {
    e.respondWith(fetch(e.request).catch(function () { return caches.match(e.request); }));
    return;
  }
  // 로컬 자원은 캐시 우선
  e.respondWith(
    caches.match(e.request).then(function (cached) {
      return cached || fetch(e.request).then(function (resp) {
        const copy = resp.clone();
        caches.open(CACHE).then(function (c) { c.put(e.request, copy); });
        return resp;
      }).catch(function () {
        return caches.match('./index.html');
      });
    })
  );
});
