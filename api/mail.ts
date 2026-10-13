import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient, type User } from '@supabase/supabase-js'
import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto'
import { isIP } from 'node:net'
import { lookup } from 'node:dns/promises'
import { ImapFlow } from 'imapflow'
import { simpleParser } from 'mailparser'
import nodemailer from 'nodemailer'

type AccountRow = {
  user_id: string; email: string; display_name: string; username: string
  imap_host: string; imap_port: number; imap_secure: boolean
  smtp_host: string; smtp_port: number; smtp_secure: boolean
  encrypted_password: string; history_mode: 'all' | 'new'; connected_at: string
  last_sync_at: string | null; last_notified_uid: number; status: 'connected' | 'error'; last_error: string | null; updated_at: string
}
type ApiMessage = {
  id: string; uid: number; mailbox: string; from: string; fromName: string; to: string
  subject: string; text: string; date: string; outgoing: boolean; unread: boolean
  attachments: { filename: string; contentType: string; size: number }[]
}

const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || ''
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ''
const credentialSecret = process.env.MAIL_CREDENTIAL_SECRET || ''
const database = url && serviceKey ? createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } }) : null

function fail(res: VercelResponse, status: number, error: string) { return res.status(status).json({ error }) }
function bearer(req: VercelRequest) { return String(req.headers.authorization || '').replace(/^Bearer\s+/i, '') }
async function currentUser(req: VercelRequest): Promise<User> {
  if (!database) throw new Error('Das Mail-Backend ist noch nicht konfiguriert.')
  const token = bearer(req)
  if (!token) throw new Error('Bitte melde dich erneut an.')
  const { data, error } = await database.auth.getUser(token)
  if (error || !data.user) throw new Error('Deine Anmeldung ist abgelaufen.')
  return data.user
}
function encryptionKey() {
  if (credentialSecret.length < 32) throw new Error('MAIL_CREDENTIAL_SECRET muss mindestens 32 Zeichen lang sein.')
  return createHash('sha256').update(credentialSecret).digest()
}
function encrypt(value: string) {
  const iv = randomBytes(12), cipher = createCipheriv('aes-256-gcm', encryptionKey(), iv)
  const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()])
  return ['v1', iv.toString('base64url'), cipher.getAuthTag().toString('base64url'), encrypted.toString('base64url')].join(':')
}
function decrypt(value: string) {
  const [version, iv, tag, encrypted] = value.split(':')
  if (version !== 'v1' || !iv || !tag || !encrypted) throw new Error('Gespeicherte Postfachdaten sind ungültig.')
  const decipher = createDecipheriv('aes-256-gcm', encryptionKey(), Buffer.from(iv, 'base64url'))
  decipher.setAuthTag(Buffer.from(tag, 'base64url'))
  return Buffer.concat([decipher.update(Buffer.from(encrypted, 'base64url')), decipher.final()]).toString('utf8')
}
function isPrivateAddress(address: string) {
  if (address === '::1' || address.startsWith('fe80:') || address.startsWith('fc') || address.startsWith('fd')) return true
  const parts = address.split('.').map(Number)
  return parts.length === 4 && (parts[0] === 10 || parts[0] === 127 || parts[0] === 0 || (parts[0] === 169 && parts[1] === 254) || (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) || (parts[0] === 192 && parts[1] === 168))
}
async function assertPublicHost(host: string) {
  const normalized = host.trim().toLowerCase()
  if (!/^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/.test(normalized) || isIP(normalized) || normalized.endsWith('.local')) {
    throw new Error('Bitte gib einen öffentlichen Mailserver als Domain ein.')
  }
  const addresses = await lookup(normalized, { all: true })
  if (!addresses.length || addresses.some(item => isPrivateAddress(item.address))) throw new Error('Private oder lokale Mailserver sind nicht erlaubt.')
}
function imapClient(account: AccountRow, password = decrypt(account.encrypted_password)) {
  return new ImapFlow({
    host: account.imap_host, port: account.imap_port, secure: account.imap_secure,
    auth: { user: account.username, pass: password }, logger: false,
    tls: { rejectUnauthorized: true, servername: account.imap_host }
  })
}
function transport(account: AccountRow, password = decrypt(account.encrypted_password)) {
  return nodemailer.createTransport({
    host: account.smtp_host, port: account.smtp_port, secure: account.smtp_secure,
    requireTLS: !account.smtp_secure, auth: { user: account.username, pass: password },
    tls: { rejectUnauthorized: true, servername: account.smtp_host }
  })
}
function publicAccount(account?: AccountRow | null) {
  if (!account) return { connected: false }
  return {
    connected: true, email: account.email, displayName: account.display_name,
    historyMode: account.history_mode, connectedAt: account.connected_at,
    lastSyncAt: account.last_sync_at, status: account.status, error: account.last_error
  }
}
async function accountFor(userId: string) {
  const { data, error } = await database!.from('mail_accounts').select('*').eq('user_id', userId).maybeSingle()
  if (error) throw error
  return data as AccountRow | null
}
function messageId(mailbox: string, uid: number) { return Buffer.from(`${mailbox}\0${uid}`).toString('base64url') }
function decodeMessageId(id: string) {
  const decoded = Buffer.from(id, 'base64url').toString('utf8'), divider = decoded.lastIndexOf('\0')
  if (divider < 1) throw new Error('Ungültige Nachrichten-ID.')
  return { mailbox: decoded.slice(0, divider), uid: Number(decoded.slice(divider + 1)) }
}
function cleanAddress(value?: string | null) { return String(value || '').trim().toLowerCase() }
async function readMailbox(client: ImapFlow, path: string, outgoing: boolean, since?: Date): Promise<ApiMessage[]> {
  const lock = await client.getMailboxLock(path)
  try {
    const found = await client.search(since ? { since } : { all: true }, { uid: true })
    const uids = found || []
    if (!uids.length) return []
    const messages: ApiMessage[] = []
    for await (const item of client.fetch(uids, { uid: true, envelope: true, flags: true, source: true }, { uid: true })) {
      const parsed = await simpleParser(item.source)
      const from = item.envelope?.from?.[0], to = item.envelope?.to?.[0]
      messages.push({
        id: messageId(path, item.uid), uid: item.uid, mailbox: path,
        from: cleanAddress(from?.address), fromName: String(from?.name || ''), to: cleanAddress(to?.address),
        subject: String(item.envelope?.subject || parsed.subject || ''),
        text: String(parsed.text || '').trim(), date: new Date(item.envelope?.date || parsed.date || Date.now()).toISOString(),
        outgoing, unread: !item.flags?.has('\\Seen'),
        attachments: parsed.attachments.map(file => ({ filename: file.filename || 'Anhang', contentType: file.contentType, size: file.size }))
      })
    }
    return messages
  } finally { lock.release() }
}
async function loadMessages(account: AccountRow) {
  const client = imapClient(account)
  await client.connect()
  try {
    const boxes = await client.list()
    const inbox = boxes.find(box => box.specialUse === '\\Inbox')?.path || 'INBOX'
    const sent = boxes.find(box => box.specialUse === '\\Sent')?.path
    const since = account.history_mode === 'new' ? new Date(account.connected_at) : undefined
    const incoming = await readMailbox(client, inbox, false, since)
    const outgoing = sent && sent !== inbox ? await readMailbox(client, sent, true, since) : []
    return [...incoming, ...outgoing]
  } finally { await client.logout().catch(() => undefined) }
}

async function getAccount(req: VercelRequest, res: VercelResponse) {
  const user = await currentUser(req)
  return res.json(publicAccount(await accountFor(user.id)))
}
async function connect(req: VercelRequest, res: VercelResponse) {
  const user = await currentUser(req), body = req.body || {}
  const email = cleanAddress(body.email), username = String(body.username || email).trim()
  const password = String(body.password || ''), imapHost = String(body.imapHost || '').trim().toLowerCase(), smtpHost = String(body.smtpHost || '').trim().toLowerCase()
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !password || !username) return fail(res, 400, 'E-Mail, Benutzername und Passwort sind erforderlich.')
  await Promise.all([assertPublicHost(imapHost), assertPublicHost(smtpHost)])
  const draft = {
    user_id: user.id, email, display_name: String(body.displayName || '').trim().slice(0, 120), username,
    imap_host: imapHost, imap_port: Number(body.imapPort), imap_secure: body.imapSecure !== false,
    smtp_host: smtpHost, smtp_port: Number(body.smtpPort), smtp_secure: body.smtpSecure !== false,
    encrypted_password: encrypt(password), history_mode: body.historyMode === 'new' ? 'new' : 'all',
    connected_at: new Date().toISOString(), last_notified_uid: 0,
    status: 'connected', last_error: null, updated_at: new Date().toISOString()
  } satisfies Partial<AccountRow>
  if (![draft.imap_port, draft.smtp_port].every(port => Number.isInteger(port) && port > 0 && port < 65536)) return fail(res, 400, 'Die Mailserver-Ports sind ungültig.')
  const testAccount = { ...draft, last_sync_at: null } as AccountRow
  const imap = imapClient(testAccount, password)
  try {
    await imap.connect()
    await imap.mailboxOpen('INBOX', { readOnly: true })
    draft.last_notified_uid = imap.mailbox ? Math.max(0, Number(imap.mailbox.uidNext || 1) - 1) : 0
    await imap.logout()
    await transport(testAccount, password).verify()
  } catch (reason) {
    await imap.logout().catch(() => undefined)
    const message = reason instanceof Error ? reason.message : 'Anmeldung fehlgeschlagen.'
    return fail(res, 400, `Mailserver-Anmeldung fehlgeschlagen: ${message}`)
  }
  const { data, error } = await database!.from('mail_accounts').upsert(draft, { onConflict: 'user_id' }).select('*').single()
  if (error) throw error
  return res.json(publicAccount(data as AccountRow))
}
async function disconnect(req: VercelRequest, res: VercelResponse) {
  const user = await currentUser(req)
  const { error } = await database!.from('mail_accounts').delete().eq('user_id', user.id)
  if (error) throw error
  await Promise.all([
    database!.from('mail_thread_preferences').delete().eq('user_id', user.id),
    database!.from('mail_sent_messages').delete().eq('user_id', user.id)
  ])
  return res.json({ ok: true })
}
async function threads(req: VercelRequest, res: VercelResponse) {
  const user = await currentUser(req), account = await accountFor(user.id)
  if (!account) return fail(res, 409, 'Verbinde zuerst dein Postfach.')
  let messages: ApiMessage[]
  try { messages = await loadMessages(account) }
  catch (reason) {
    const message = reason instanceof Error ? reason.message : 'Synchronisierung fehlgeschlagen.'
    await database!.from('mail_accounts').update({ status: 'error', last_error: message, updated_at: new Date().toISOString() }).eq('user_id', user.id)
    throw new Error(`Postfach konnte nicht synchronisiert werden: ${message}`)
  }
  const [{ data: preferences }, { data: sentCache }] = await Promise.all([
    database!.from('mail_thread_preferences').select('correspondent,muted').eq('user_id', user.id),
    database!.from('mail_sent_messages').select('*').eq('user_id', user.id).order('sent_at')
  ])
  for (const cached of sentCache || []) {
    const duplicate = messages.some(message => message.outgoing && cleanAddress(message.to) === cleanAddress(cached.to_address) &&
      message.subject === cached.subject && Math.abs(Date.parse(message.date) - Date.parse(cached.sent_at)) < 120_000)
    if (!duplicate) messages.push({
      id: `cache:${cached.id}`, uid: 0, mailbox: 'Gesendet', from: account.email,
      fromName: account.display_name, to: cached.to_address, subject: cached.subject,
      text: cached.body_text, date: cached.sent_at, outgoing: true, unread: false,
      attachments: Array.isArray(cached.attachments) ? cached.attachments : []
    })
  }
  const muted = new Map((preferences || []).map(item => [cleanAddress(item.correspondent), !!item.muted]))
  const grouped = new Map<string, ApiMessage[]>()
  for (const message of messages) {
    const address = cleanAddress(message.outgoing ? message.to : message.from)
    if (!address || address === account.email && !message.outgoing) continue
    grouped.set(address, [...(grouped.get(address) || []), message])
  }
  const result = [...grouped.entries()].map(([address, items]) => {
    items.sort((a, b) => a.date.localeCompare(b.date))
    const last = items.at(-1)!, incoming = [...items].reverse().find(item => !item.outgoing)
    const name = incoming?.fromName?.trim() || address
    return {
      id: Buffer.from(address).toString('base64url'), name, address,
      initials: name.split(/\s+/).map(part => part[0]).join('').slice(0, 2).toUpperCase(),
      preview: last.text.replace(/\s+/g, ' ').slice(0, 110) || last.subject || 'Anhang', date: last.date,
      unread: items.filter(item => !item.outgoing && item.unread).length, muted: muted.get(address) || false, messages: items
    }
  }).sort((a, b) => b.date.localeCompare(a.date))
  const syncedAt = new Date().toISOString()
  await database!.from('mail_accounts').update({ last_sync_at: syncedAt, status: 'connected', last_error: null, updated_at: syncedAt }).eq('user_id', user.id)
  return res.json({ threads: result, unread: result.reduce((sum, item) => sum + item.unread, 0), syncedAt })
}
async function send(req: VercelRequest, res: VercelResponse) {
  const user = await currentUser(req), account = await accountFor(user.id)
  if (!account) return fail(res, 409, 'Verbinde zuerst dein Postfach.')
  const to = cleanAddress(req.body?.to), subject = String(req.body?.subject || '').trim().slice(0, 200), text = String(req.body?.text || '').slice(0, 100_000)
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to) || !subject || (!text && !req.body?.attachments?.length)) return fail(res, 400, 'Empfänger, Betreff und Inhalt fehlen.')
  const attachments = (Array.isArray(req.body.attachments) ? req.body.attachments : []).slice(0, 10).map((file: Record<string, unknown>) => ({
    filename: String(file.filename || 'Anhang').slice(0, 180), contentType: String(file.contentType || 'application/octet-stream'),
    content: Buffer.from(String(file.content || ''), 'base64')
  }))
  if (attachments.reduce((sum: number, file: { content: Buffer }) => sum + file.content.length, 0) > 10 * 1024 * 1024) return fail(res, 413, 'Anhänge dürfen zusammen höchstens 10 MB groß sein.')
  await transport(account).sendMail({ from: { name: account.display_name || account.email, address: account.email }, to, subject, text, attachments })
  const metadata = attachments.map(file => ({ filename: file.filename, contentType: file.contentType, size: file.content.length }))
  const { data, error } = await database!.from('mail_sent_messages').insert({ user_id: user.id, to_address: to, subject, body_text: text, attachments: metadata }).select('*').single()
  if (error) throw error
  return res.json({ message: { id: `cache:${data.id}`, uid: 0, mailbox: 'Gesendet', from: account.email, fromName: account.display_name, to, subject, text, date: data.sent_at, outgoing: true, unread: false, attachments: metadata } })
}
async function threadAction(req: VercelRequest, res: VercelResponse) {
  const user = await currentUser(req), account = await accountFor(user.id)
  if (!account) return fail(res, 409, 'Verbinde zuerst dein Postfach.')
  const address = cleanAddress(req.body?.address), operation = String(req.body?.operation || '')
  if (!address || !['mute', 'unmute', 'delete', 'read', 'unread'].includes(operation)) return fail(res, 400, 'Ungültige Postfachaktion.')
  if (operation === 'mute' || operation === 'unmute') {
    const { error } = await database!.from('mail_thread_preferences').upsert({ user_id: user.id, correspondent: address, muted: operation === 'mute', updated_at: new Date().toISOString() }, { onConflict: 'user_id,correspondent' })
    if (error) throw error
    return res.json({ ok: true })
  }
  const ids = Array.isArray(req.body?.messageIds) ? req.body.messageIds.map(String) : []
  const cacheIds = ids.filter((id: string) => id.startsWith('cache:')).map((id: string) => id.slice(6))
  if (operation === 'delete' && cacheIds.length) await database!.from('mail_sent_messages').delete().eq('user_id', user.id).in('id', cacheIds)
  const imapIds = ids.filter((id: string) => !id.startsWith('cache:')).map(decodeMessageId)
  if (imapIds.length) {
    const client = imapClient(account); await client.connect()
    try {
      const boxes = await client.list(), trash = boxes.find(box => box.specialUse === '\\Trash')?.path
      const grouped = new Map<string, number[]>()
      for (const item of imapIds) grouped.set(item.mailbox, [...(grouped.get(item.mailbox) || []), item.uid])
      for (const [mailbox, uids] of grouped) {
        const lock = await client.getMailboxLock(mailbox)
        try {
          if (operation === 'delete') {
            if (trash && trash !== mailbox) await client.messageMove(uids, trash, { uid: true })
            else await client.messageDelete(uids, { uid: true })
          } else if (operation === 'read') await client.messageFlagsAdd(uids, ['\\Seen'], { uid: true })
          else if (operation === 'unread') await client.messageFlagsRemove(uids, ['\\Seen'], { uid: true })
        } finally { lock.release() }
      }
    } finally { await client.logout().catch(() => undefined) }
  }
  return res.json({ ok: true })
}
async function push(req: VercelRequest, res: VercelResponse) {
  const user = await currentUser(req), subscription = req.body?.subscription
  const mailEnabled = !!req.body?.mail, lessonEnabled = !!req.body?.lessonFeedback
  if (!subscription?.endpoint) {
    if (!mailEnabled && !lessonEnabled) await database!.from('push_subscriptions').delete().eq('user_id', user.id)
    return res.json({ ok: true })
  }
  const { error } = await database!.from('push_subscriptions').upsert({
    endpoint: String(subscription.endpoint), user_id: user.id,
    p256dh: String(subscription.keys?.p256dh || ''), auth: String(subscription.keys?.auth || ''),
    timezone: String(req.body?.timezone || 'Europe/Berlin').slice(0, 80),
    mail_enabled: mailEnabled, lesson_feedback_enabled: lessonEnabled, updated_at: new Date().toISOString()
  }, { onConflict: 'endpoint' })
  if (error) throw error
  return res.json({ ok: true })
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('cache-control', 'no-store')
  try {
    const action = String(req.query.action || '')
    if (req.method === 'GET' && action === 'account') return await getAccount(req, res)
    if (req.method === 'GET' && action === 'threads') return await threads(req, res)
    if (req.method === 'POST' && action === 'connect') return await connect(req, res)
    if (req.method === 'POST' && action === 'disconnect') return await disconnect(req, res)
    if (req.method === 'POST' && action === 'send') return await send(req, res)
    if (req.method === 'POST' && action === 'thread') return await threadAction(req, res)
    if (req.method === 'POST' && action === 'push') return await push(req, res)
    return fail(res, 404, 'Unbekannte Mail-Aktion.')
  } catch (reason) {
    const message = reason instanceof Error ? reason.message : 'Interner Mailfehler.'
    return fail(res, /Anmeldung|melde dich/i.test(message) ? 401 : 500, message)
  }
}
