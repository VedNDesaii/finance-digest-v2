importScripts("https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.sw.js");

self.addEventListener('push', function(event) {
  const data = event.data ? event.data.json() : {}
  const options = {
    body:    data.body  || 'New stories are ready for you.',
    icon:    '/icon-192.png',
    badge:   '/icon-192.png',
    vibrate: [200, 100, 200],
    data:    { url: data.url || 'https://financedigest.xyz' },
    actions: [
      { action: 'read',    title: '📰 Read Now' },
      { action: 'dismiss', title: 'Later' },
    ],
  }
  event.waitUntil(
    self.registration.showNotification(data.title || '📰 Finance Digest', options)
  )
})

self.addEventListener('notificationclick', function(event) {
  event.notification.close()
  if (event.action === 'read' || !event.action) {
    event.waitUntil(clients.openWindow(event.notification.data.url))
  }
})
