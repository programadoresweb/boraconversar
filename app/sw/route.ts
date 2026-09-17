export async function GET() {
  const sw = `
    self.addEventListener('push', (event) => {
      let data

      try {
        data = event.data?.json ? event.data.json() : null
      } catch {
        data = null
      }

      const title = data?.title || 'Bora Conversar 💬'
      const body = data?.body || 'Você recebeu uma nova mensagem.'
      const url = data?.url || '/'

      const options = {
        body,
        icon: '/icon-192.png',
        badge: '/icon-192.png',
        silent: false,
        renotify: true,
        tag: 'bora-conversar-mensagem',
        vibrate: [200, 100, 200],
        data: { url },
      }

      event.waitUntil(self.registration.showNotification(title, options))
    })

    self.addEventListener('notificationclick', (event) => {
      event.notification.close()

      const url = event.notification.data?.url || '/'

      event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
          for (const client of clientList) {
            if ('focus' in client) {
              client.navigate(url)
              return client.focus()
            }
          }

          if (clients.openWindow) {
            return clients.openWindow(url)
          }
        })
      )
    })
  `

  return new Response(sw, {
    headers: {
      'Content-Type': 'application/javascript; charset=utf-8',
      'Cache-Control': 'no-cache, no-store, must-revalidate',
    },
  })
}
