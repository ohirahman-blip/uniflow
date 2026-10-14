import type { VercelRequest, VercelResponse } from '@vercel/node'
import { loadEnvFile } from 'node:process'
import { createClient } from '@supabase/supabase-js'
import { createDecipheriv, createHash } from 'node:crypto'
import { ImapFlow } from 'imapflow'
import webpush from 'web-push'

type SubscriptionRow = {
  endpoint: string; user_id: string; p256dh: string; auth: string; timezone: string
  mail_enabled: boolean; lesson_feedback_enabled: boolean
}
type MailAccountRow = {
  user_id: string; email: string; username: string; imap_host: string; imap_port: number
  imap_secure: boolean; encrypted_password: string; last_notified_uid: number
}

// vercel dev can start API workers without locally defined variables.
// Read the project file before creating clients; deployed environments use Vercel.
if (process.env.VERCEL_ENV !== 'production' && process.env.VERCEL_ENV !== 'preview') {
  try { loadEnvFile('.env.local') }
  catch (reason) {
    if ((reason as NodeJS.ErrnoException).code !== 'ENOENT') throw reason
  }
}

const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || ''
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ''
const credentialSecret = process.env.MAIL_CREDENTIAL_SECRET || ''
const database = url && serviceKey ? createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } }) : null

function decrypt(value: string) {
  const [version, iv, tag, encrypted] = value.split(':')
  if (version !== 'v1') throw new Error('Ungültiges Zugangsdatenformat.')
  const key = createHash('sha256').update(credentialSecret).digest()
  const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(iv, 'base64url'))
  decipher.setAuthTag(Buffer.from(tag, 'base64url'))
  return Buffer.concat([decipher.update(Buffer.from(encrypted, 'base64url')), decipher.final()]).toString('utf8')
}
function localParts(date: Date, timezone: string) {
  const values = Object.fromEntries(new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23'
  }).formatToParts(date).filter(item => item.type !== 'literal').map(item => [item.type, item.value]))
  return { date: `${values.year}-${values.month}-${values.day}`, minutes: Number(values.hour) * 60 + Number(values.minute) }
}
function daysBetween(from: string, to: string) {
  return Math.round((Date.parse(`${to}T12:00:00Z`) - Date.parse(`${from}T12:00:00Z`)) / 86_400_000)
}
function lessonDue(offering: Record<string, unknown>, now: { date: string; minutes: number }) {
  const start = String(offering.date || ''), end = String(offering.endDate || ''), to = String(offering.to || '')
  if (!start || !end || !to || now.date < start || now.date > end || offering.selected === false) return false
  const delta = daysBetween(start, now.date), recurrence = String(offering.recurrence || 'once')
  if (delta < 0 || recurrence === 'once' && delta !== 0 || recurrence === 'weekly' && delta % 7 !== 0 || recurrence === 'biweekly' && delta % 14 !== 0) return false
  const override = (offering.overrides as Record<string, { cancelled?: boolean; selected?: boolean; to?: string }> | undefined)?.[now.date]
  if (override?.cancelled || override?.selected === false) return false
  const endMinutes = Number((override?.to || to).slice(0, 2)) * 60 + Number((override?.to || to).slice(3, 5))
  return now.minutes >= endMinutes && now.minutes < endMinutes + 7
}
async function deliver(rows: SubscriptionRow[], payload: Record<string, unknown>) {
  const dead: string[] = []
  await Promise.all(rows.map(async row => {
    try {
      await webpush.sendNotification({ endpoint: row.endpoint, keys: { p256dh: row.p256dh, auth: row.auth } }, JSON.stringify(payload), { TTL: 300 })
    } catch (reason) {
      const status = (reason as { statusCode?: number }).statusCode
      if (status === 404 || status === 410) dead.push(row.endpoint)
      else throw reason
    }
  }))
  if (dead.length) await database!.from('push_subscriptions').delete().in('endpoint', dead)
}
async function notifyMail(userId: string, rows: SubscriptionRow[]) {
  const { data } = await database!.from('mail_accounts').select('*').eq('user_id', userId).maybeSingle()
  const account = data as MailAccountRow | null
  if (!account) return 0
  const client = new ImapFlow({ host: account.imap_host, port: account.imap_port, secure: account.imap_secure, auth: { user: account.username, pass: decrypt(account.encrypted_password) }, logger: false, tls: { rejectUnauthorized: true, servername: account.imap_host } })
  client.on('error', () => { client.close() })
  try {
    await client.connect()
    const lock = await client.getMailboxLock('INBOX')
    try {
      const found = await client.search({ seen: false }, { uid: true })
      const uids = (found || []).filter(uid => uid > Number(account.last_notified_uid || 0))
      if (!uids.length) return 0
      const { data: preferences } = await database!.from('mail_thread_preferences').select('correspondent,muted').eq('user_id', userId)
      const muted = new Set((preferences || []).filter(item => item.muted).map(item => String(item.correspondent).toLowerCase()))
      const senders: string[] = []
      for await (const item of client.fetch(uids, { uid: true, envelope: true }, { uid: true })) {
        const sender = String(item.envelope?.from?.[0]?.address || '').toLowerCase()
        if (sender && !muted.has(sender)) senders.push(String(item.envelope?.from?.[0]?.name || sender))
      }
      const maxUid = Math.max(...uids)
      await database!.from('mail_accounts').update({ last_notified_uid: maxUid }).eq('user_id', userId)
      if (!senders.length) return 0
      await deliver(rows, {
        title: senders.length === 1 ? `Neue Mail von ${senders[0]}` : `${senders.length} neue Mails`,
        body: senders.length === 1 ? 'Tippe, um die Unterhaltung zu öffnen.' : `Von ${senders.slice(0, 3).join(', ')}`,
        tag: 'uniflow-mail', url: '/?page=mail', icon: '/icon.svg'
      })
      return senders.length
    } finally { lock.release() }
  } finally {
    if (client.usable) {
      try { await client.logout() } catch { client.close() }
    } else client.close()
  }
}
async function notifyLessons(userId: string, rows: SubscriptionRow[]) {
  const { data } = await database!.from('private_workspaces').select('payload').eq('user_id', userId).maybeSingle()
  const payload = data?.payload as { offerings?: Record<string, unknown>[] } | undefined
  if (!payload?.offerings?.length) return 0
  const now = localParts(new Date(), rows[0]?.timezone || 'Europe/Berlin')
  let count = 0
  for (const offering of payload.offerings) {
    if (!lessonDue(offering, now)) continue
    const key = `lesson:${String(offering.id)}:${now.date}`
    const { error } = await database!.from('notification_deliveries').insert({ user_id: userId, delivery_key: key })
    if (error?.code === '23505') continue
    if (error) throw error
    await deliver(rows, { title: 'Wie lief dein Termin?', body: `${String(offering.name || 'Veranstaltung')} ist gerade zu Ende. Gib kurz Feedback.`, tag: key, url: '/?page=dashboard', icon: '/icon.svg' })
    count++
  }
  return count
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Methode nicht erlaubt.' })
  if (!database) return res.status(500).json({ error: 'Supabase ist nicht konfiguriert.' })
  const expected = process.env.CRON_SECRET
  if (!expected) return res.status(500).json({ error: 'CRON_SECRET fehlt.' })
  if (req.headers.authorization !== `Bearer ${expected}`) return res.status(401).json({ error: 'Nicht autorisiert.' })
  const vapidPublic = process.env.WEB_PUSH_PUBLIC_KEY || '', vapidPrivate = process.env.WEB_PUSH_PRIVATE_KEY || ''
  if (!vapidPublic || !vapidPrivate) return res.status(500).json({ error: 'Web-Push-Schlüssel fehlen.' })
  webpush.setVapidDetails(process.env.WEB_PUSH_CONTACT || 'mailto:admin@uniflow.app', vapidPublic, vapidPrivate)
  try {
    const { data, error } = await database.from('push_subscriptions').select('*').or('mail_enabled.eq.true,lesson_feedback_enabled.eq.true')
    if (error) throw error
    const groups = new Map<string, SubscriptionRow[]>()
    for (const row of data as SubscriptionRow[]) groups.set(row.user_id, [...(groups.get(row.user_id) || []), row])
    let mails = 0, lessons = 0
    const failures: string[] = []
    for (const [userId, rows] of groups) {
      try {
        const mailRows = rows.filter(row => row.mail_enabled), lessonRows = rows.filter(row => row.lesson_feedback_enabled)
        if (mailRows.length) mails += await notifyMail(userId, mailRows)
        if (lessonRows.length) lessons += await notifyLessons(userId, lessonRows)
      } catch (reason) {
        failures.push(`${userId.slice(0,8)}: ${reason instanceof Error ? reason.message : 'Unbekannter Fehler'}`)
      }
    }
    return res.json({ ok: failures.length === 0, users: groups.size, mails, lessons, failures })
  } catch (reason) {
    return res.status(500).json({ error: reason instanceof Error ? reason.message : 'Benachrichtigungen fehlgeschlagen.' })
  }
}
