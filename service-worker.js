const CACHE_NAME = 'ddok-v1';

self.addEventListener('install', event => {
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(clients.claim());
});

// 네트워크 우선 (항상 최신 코드 반영)
self.addEventListener('fetch', event => {
  event.respondWith(
    fetch(event.request)
      .catch(() => caches.match(event.request))
  );
});

// 푸시 알림 수신
self.addEventListener('push', event => {
  const data = event.data ? event.data.json() : {};
  const title = data.title || '똑비서 알림';
  const options = {
    body: data.body || '',
    icon: '/Ddog/logo.png',
    badge: '/Ddog/logo.png',
    vibrate: [200, 100, 200],
    data: data
  };
  event.waitUntil(
    self.registration.showNotification(title, options)
  );
});

// 알림 클릭 시 앱 열기
self.addEventListener('notificationclick', event => {
  event.notification.close();
  event.waitUntil(
    clients.openWindow('/Ddog/')
  );
});
