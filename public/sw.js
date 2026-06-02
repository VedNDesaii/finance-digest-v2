self.addEventListener('push', function(event) {
  const data = event.data ? event.data.json() : {}
  const title   = data.title   || 'Finance Digest'
  const options = {
    body:    data.body    || 'Markets are moving.',
    icon:    data.icon    || '/favicon.ico',
    badge:   '/favicon.ico',
    tag:     'market-alert',
    renotify: true,
    data:    { url: data.url || 'https://financedigest.xyz' },
    actions: [{ action: 'open', title: 'Read now' }],
  }
  event.waitUntil(self.registration.showNotification(title, options))
})

self.addEventListener('notificationclick', function(event) {
  event.notification.close()
  const url = event.notification.data?.url || 'https://financedigest.xyz'
  event.waitUntil(clients.openWindow(url))
})