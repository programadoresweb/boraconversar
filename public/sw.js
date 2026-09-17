self.addEventListener('push', (event) => {
    console.log('🔔 PUSH CHEGOU NO SERVICE WORKER')

  if (!event.data) return

  let data

  try {
    data = event.data.json()
  } catch {
    data = {
      title: 'Bora Conversar 💬',
      body: event.data.text(),
    }
  }

  const title = data.title || 'Nova mensagem'

  const options = {
    body: data.body || 'Você recebeu uma nova mensagem.',
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    silent: false,
    renotify: true,
    tag: 'bora-conversar-mensagem',
    vibrate: [200, 100, 200],
    data: {
      url: data.url || '/',
    },
  }

  event.waitUntil(
    self.registration.showNotification(
      title,
      options
    )
  )
})

self.addEventListener(
  'notificationclick',
  (event) => {
    event.notification.close()

    const url =
      event.notification.data?.url || '/'

    event.waitUntil(
      clients.matchAll({
        type: 'window',
        includeUncontrolled: true,
      }).then((clientList) => {
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
  }
)
