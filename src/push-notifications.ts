import { supabase } from './supabase'

function base64ToBytes(value: string) {
  const normalized = `${value}${'='.repeat((4 - value.length % 4) % 4)}`.replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(normalized)
  return Uint8Array.from(raw, char => char.charCodeAt(0))
}

async function pushRequest(body: unknown) {
  if (!supabase) throw new Error('Supabase ist nicht verbunden.')
  const { data: { session } } = await supabase.auth.getSession()
  if (!session?.access_token) throw new Error('Bitte melde dich erneut an.')
  const response = await fetch('/api/notifications', {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${session.access_token}` },
    body: JSON.stringify(body)
  })
  const result = await response.json().catch(() => ({})) as { error?: string }
  if (!response.ok) throw new Error(result.error || 'Benachrichtigungen konnten nicht gespeichert werden.')
}

export async function configurePushPreferences(lessonFeedback: boolean) {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    if (!lessonFeedback) return
    throw new Error('Push-Benachrichtigungen werden von diesem Browser nicht unterstützt.')
  }
  const registration = await navigator.serviceWorker.register('/sw.js')
  let subscription = await registration.pushManager.getSubscription()
  if (lessonFeedback && Notification.permission !== 'granted') {
    const permission = await Notification.requestPermission()
    if (permission !== 'granted') throw new Error('Benachrichtigungen wurden nicht erlaubt.')
  }
  if (lessonFeedback && !subscription) {
    const publicKey = import.meta.env.VITE_WEB_PUSH_PUBLIC_KEY as string | undefined
    if (!publicKey) throw new Error('Der öffentliche Push-Schlüssel fehlt in der App-Konfiguration.')
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: base64ToBytes(publicKey)
    })
  }
  await pushRequest({
    subscription: subscription?.toJSON() || null,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    lessonFeedback
  })
}
