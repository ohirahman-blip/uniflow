import { supabase } from './supabase'

export type MailAttachment = {
  filename: string
  contentType: string
  size: number
}

export type MailMessage = {
  id: string
  uid: number
  mailbox: string
  from: string
  fromName: string
  to: string
  subject: string
  text: string
  date: string
  outgoing: boolean
  unread: boolean
  attachments: MailAttachment[]
}

export type MailThread = {
  id: string
  name: string
  address: string
  initials: string
  preview: string
  date: string
  unread: number
  muted: boolean
  messages: MailMessage[]
}

export type MailAccount = {
  connected: boolean
  email?: string
  displayName?: string
  historyMode?: 'all' | 'new'
  connectedAt?: string
  lastSyncAt?: string | null
  status?: 'connected' | 'error'
  error?: string | null
}

export type MailConnectionInput = {
  email: string
  password: string
  displayName: string
  imapHost: string
  imapPort: number
  imapSecure: boolean
  smtpHost: string
  smtpPort: number
  smtpSecure: boolean
  username: string
  historyMode: 'all' | 'new'
}

export type MailDraftAttachment = {
  filename: string
  contentType: string
  content: string
}

async function mailRequest<T>(action: string, init?: RequestInit): Promise<T> {
  if (!supabase) throw new Error('Supabase ist nicht verbunden.')
  const { data: { session } } = await supabase.auth.getSession()
  if (!session?.access_token) throw new Error('Bitte melde dich erneut an.')
  let response: Response
  try { response = await fetch(`/api/mail?action=${encodeURIComponent(action)}`, {
    ...init,
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${session.access_token}`,
      ...(init?.headers || {})
    }
  }) } catch { throw new Error('[MAIL_NETWORK] Backend nicht erreichbar. Internetverbindung prüfen und lokal mit npx vercel dev starten.') }
  const body = await response.json().catch(() => null) as ({ error?: string; code?: string } & T) | null
  if (!body) throw new Error(`[MAIL_API_RESPONSE] Keine gültige API-Antwort (HTTP ${response.status}). Lokal die Adresse von npx vercel dev öffnen, nicht den separaten Vite-Port.`)
  if (!response.ok) throw new Error(`[${body.code || 'MAIL_HTTP_' + response.status}] ${body.error || 'Das Postfach konnte nicht erreicht werden.'}`)
  return body
}

export const getMailAccount = () => mailRequest<MailAccount>('account')
type MailThreadResult = { threads: MailThread[]; unread: number; syncedAt: string }
const threadRequests=new Map<string,Promise<MailThreadResult>>()
export async function getMailThreads(): Promise<MailThreadResult> {
  const session=await supabase?.auth.getSession()
  const userId=session?.data.session?.user.id
  if(!userId)throw new Error('Bitte melde dich erneut an.')
  const existing=threadRequests.get(userId)
  if(existing)return existing
  const request=mailRequest<MailThreadResult>('threads')
  threadRequests.set(userId,request)
  try {return await request}
  finally {if(threadRequests.get(userId)===request)threadRequests.delete(userId)}
}
export const connectMailAccount = (input: MailConnectionInput) => mailRequest<MailAccount>('connect', {
  method: 'POST', body: JSON.stringify(input)
})
export const disconnectMailAccount = () => mailRequest<{ ok: true }>('disconnect', { method: 'POST', body: '{}' })
export const sendMailMessage = (input: { to: string; subject: string; text: string; attachments: MailDraftAttachment[] }) =>
  mailRequest<{ message: MailMessage }>('send', { method: 'POST', body: JSON.stringify(input) })
export const updateMailThread = (input: { address: string; operation: 'mute' | 'unmute' | 'delete' | 'read' | 'unread'; messageIds?: string[] }) =>
  mailRequest<{ ok: true }>('thread', { method: 'POST', body: JSON.stringify(input) })

export function suggestedMailServers(address: string) {
  const domain = address.trim().toLowerCase().split('@')[1] || ''
  const known: Record<string, { imapHost: string; smtpHost: string; smtpPort: number }> = {
    'gmail.com': { imapHost: 'imap.gmail.com', smtpHost: 'smtp.gmail.com', smtpPort: 465 },
    'googlemail.com': { imapHost: 'imap.gmail.com', smtpHost: 'smtp.gmail.com', smtpPort: 465 },
    'outlook.com': { imapHost: 'outlook.office365.com', smtpHost: 'smtp.office365.com', smtpPort: 587 },
    'hotmail.com': { imapHost: 'outlook.office365.com', smtpHost: 'smtp.office365.com', smtpPort: 587 },
    'live.de': { imapHost: 'outlook.office365.com', smtpHost: 'smtp.office365.com', smtpPort: 587 },
    'icloud.com': { imapHost: 'imap.mail.me.com', smtpHost: 'smtp.mail.me.com', smtpPort: 587 },
    'me.com': { imapHost: 'imap.mail.me.com', smtpHost: 'smtp.mail.me.com', smtpPort: 587 }
  }
  return known[domain] || { imapHost: domain ? `imap.${domain}` : '', smtpHost: domain ? `smtp.${domain}` : '', smtpPort: 465 }
}

export async function encodeMailAttachments(files: File[]): Promise<MailDraftAttachment[]> {
  const total = files.reduce((sum, file) => sum + file.size, 0)
  if (total > 10 * 1024 * 1024) throw new Error('Anhänge dürfen zusammen höchstens 10 MB groß sein.')
  return Promise.all(files.map(async file => ({
    filename: file.name,
    contentType: file.type || 'application/octet-stream',
    content: await new Promise<string>((resolve, reject) => {
      const reader = new FileReader()
      reader.onerror = () => reject(new Error(`${file.name} konnte nicht gelesen werden.`))
      reader.onload = () => resolve(String(reader.result).split(',')[1] || '')
      reader.readAsDataURL(file)
    })
  })))
}
