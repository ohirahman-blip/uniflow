self.addEventListener('push', event => {
  const payload = event.data ? event.data.json() : {}
  event.waitUntil(self.registration.showNotification(payload.title || 'uniflow', {
    body: payload.body || '', icon: payload.icon || '/icon.svg', badge: '/icon.svg',
    tag: payload.tag || 'uniflow', data: { url: payload.url || '/' }
  }))
})
self.addEventListener('notificationclick', event => {
  event.notification.close()
  const target = new URL(event.notification.data?.url || '/', self.location.origin).href
  event.waitUntil(clients.matchAll({ type: 'window', includeUncontrolled: true }).then(windows => {
    const existing = windows.find(window => window.url.startsWith(self.location.origin))
    if (existing) { existing.navigate(target); return existing.focus() }
    return clients.openWindow(target)
  }))
})
