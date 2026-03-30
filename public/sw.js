// Service Worker — LS Impulsiona CRM
// NUNCA cacheia HTML — sempre busca do servidor
const CACHE = 'ls-crm-v5';

self.addEventListener('install', e => {
  // Ativa imediatamente, sem esperar tabs fecharem
  e.waitUntil(self.skipWaiting());
});

self.addEventListener('activate', e => {
  // Apaga TODOS os caches antigos
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.map(k => caches.delete(k))))
      .then(() => self.clients.claim())
      .then(() => {
        // Força reload em todos os clientes para pegar nova versão
        return self.clients.matchAll({ type: 'window' }).then(clients => {
          clients.forEach(client => client.navigate(client.url));
        });
      })
  );
});

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);

  // NUNCA interceptar: API, HTML principal
  if (url.pathname.includes('/api/')) return;
  if (url.pathname === '/' || url.pathname.endsWith('.html')) return;

  // Para outros assets (JS, CSS), tenta rede primeiro
  e.respondWith(
    fetch(e.request).catch(() => caches.match(e.request))
  );
});

// ── Push Notifications ────────────────────────────────────────────────────────
self.addEventListener('push', e => {
  let data = { title: 'LS Impulsiona', body: 'Nova notificação', url: '/' };
  try { data = e.data.json(); } catch(err) {}
  e.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: '/icons/icon-192.png',
      badge: '/icons/icon-72.png',
      data: { url: data.url },
      vibrate: [200, 100, 200],
      requireInteraction: false,
    })
  );
});

self.addEventListener('notificationclick', e => {
  e.notification.close();
  const url = (e.notification.data && e.notification.data.url) || '/';
  e.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(cs => {
      const c = cs.find(w => w.url.includes(self.location.origin));
      if (c) { c.focus(); c.navigate(url); }
      else clients.openWindow(url);
    })
  );
});
