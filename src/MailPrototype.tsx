import { useCallback, useEffect, useLayoutEffect, useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode, type TouchEvent as ReactTouchEvent } from 'react'
import { ArrowLeft, ArrowRight, BellOff, Check, CheckCheck, Download, FileText, Inbox, Mail, Paperclip, Plus, Reply, Search, Send, Trash2, X } from 'lucide-react'
import './mail-prototype.css'
import { replySubject, validDemoRecipient } from './mail-prototype-logic'
import {
  connectMailAccount, downloadMailAttachment, encodeMailAttachments, getMailAccount, getMailThreads, sendMailMessage,
  suggestedMailServers, updateMailThread, mergeMailPages, type MailAccount, type MailConnectionInput,
  type MailMessage, type MailThread
} from './mail-client'

type Props = {
  userId: string
  onUnreadChange?: (count: number) => void
  onAccountChange?: (account: MailAccount) => void
  onNotice?: (text: string,action?:()=>void) => void
}

const emptyConnection: MailConnectionInput = {
  email: '', password: '', displayName: '', username: '',
  imapHost: '', imapPort: 993, imapSecure: true,
  smtpHost: '', smtpPort: 465, smtpSecure: true, historyMode: 'all'
}

const messageDate = (value: string) => new Date(value).toLocaleString('de-DE', {
  weekday: 'short', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit'
})
const threadDate = (value: string) => {
  const date = new Date(value), now = new Date()
  return date.toDateString() === now.toDateString()
    ? date.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })
    : date.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' })
}

const linkPattern = /(?:https?:\/\/|www\.)[^\s<>]+/gi
function linkedMailText(text: string) {
  const parts: ReactNode[] = [], decoded=text
    .replace(/&nbsp;/gi,' ').replace(/&amp;/gi,'&').replace(/&lt;/gi,'<').replace(/&gt;/gi,'>').replace(/&quot;/gi,'"').replace(/&#39;/gi,"'")
  let last=0
  for(const match of decoded.matchAll(linkPattern)){
    const start=match.index??0,raw=match[0],url=raw.replace(/[),.;!?]+$/,'')
    if(start>last)parts.push(decoded.slice(last,start))
    parts.push(<a key={`${start}-${url}`} href={url.startsWith('www.')?`https://${url}`:url} target="_blank" rel="noreferrer">{url}</a>)
    if(url.length<raw.length)parts.push(raw.slice(url.length))
    last=start+raw.length
  }
  if(last<decoded.length)parts.push(decoded.slice(last))
  return parts.length?parts:decoded
}

function MailOnboarding({ onConnected }: { onConnected: (account: MailAccount) => void }) {
  const [step, setStep] = useState<1 | 2>(1)
  const [values, setValues] = useState<MailConnectionInput>(emptyConnection)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const update = <K extends keyof MailConnectionInput>(key: K, value: MailConnectionInput[K]) =>
    setValues(current => ({ ...current, [key]: value }))
  const continueToServer = () => {
    const email = values.email.trim().toLowerCase()
    if (!validDemoRecipient(email) || !values.password) { setError('Bitte gib E-Mail-Adresse und Postfachpasswort ein.'); return }
    const suggestion = suggestedMailServers(email)
    setValues(current => ({ ...current, email, username: current.username || email, displayName: current.displayName.trim(), ...suggestion }))
    setError(''); setStep(2)
  }
  const connect = async () => {
    setBusy(true); setError('')
    try { onConnected(await connectMailAccount(values)) }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Das Postfach konnte nicht verbunden werden.') }
    finally { setBusy(false) }
  }
  return <div className="mail-onboarding">
    <div className="mail-onboarding-brand"><strong>Postfach</strong></div>
    <span className="mail-onboarding-step">SCHRITT {step} VON 2</span>
    <h1>{step === 1 ? <>Deine Mails.<br/>Wie ein Chat.</> : <>Fast<br/>verbunden.</>}</h1>
    <p>{step === 1
      ? 'UniFlow verbindet sich direkt mit deinem Hochschul-Postfach. Dein Passwort wird verschlüsselt auf dem Server gespeichert und nie an den Browser zurückgegeben.'
      : 'Prüfe die automatisch erkannten Serverdaten. Bei deiner Hochschule findest du sie meist unter „IMAP/SMTP“.'}</p>
    {step === 1 ? <form onSubmit={event => { event.preventDefault(); continueToServer() }} className="mail-onboarding-form">
      <label><span>E-Mail-Adresse</span><input type="email" autoComplete="email" required value={values.email} placeholder="name@hochschule.de" onChange={event => update('email', event.target.value)}/></label>
      <label><span>Anzeigename <small>optional</small></span><input value={values.displayName} placeholder="Dein Name" onChange={event => update('displayName', event.target.value)}/></label>
      <label><span>Postfach- oder App-Passwort</span><input type="password" autoComplete="current-password" required value={values.password} onChange={event => update('password', event.target.value)}/></label>
      <button className="mail-onboarding-primary" type="submit">Weiter <ArrowRight size={18}/></button>
    </form> : <form onSubmit={event => { event.preventDefault(); void connect() }} className="mail-onboarding-form mail-server-form">
      <label><span>Benutzername</span><input required value={values.username} onChange={event => update('username', event.target.value)}/></label>
      <div className="mail-server-row"><label><span>IMAP-Server</span><input required value={values.imapHost} onChange={event => update('imapHost', event.target.value)}/></label><label className="mail-port"><span>Port</span><input type="number" required value={values.imapPort} onChange={event => update('imapPort', Number(event.target.value))}/></label></div>
      <div className="mail-server-row"><label><span>SMTP-Server</span><input required value={values.smtpHost} onChange={event => update('smtpHost', event.target.value)}/></label><label className="mail-port"><span>Port</span><input type="number" required value={values.smtpPort} onChange={event => update('smtpPort', Number(event.target.value))}/></label></div>
      <label className="mail-history-choice"><input type="checkbox" checked={values.historyMode === 'all'} onChange={event => update('historyMode', event.target.checked ? 'all' : 'new')}/><span><strong>Vorhandene Mails übernehmen</strong><small>Wenn dein Mailserver sie gespeichert hat, zeigt UniFlow auch ältere Nachrichten.</small></span></label>
      <div className="mail-onboarding-actions"><button type="button" onClick={() => setStep(1)}>Zurück</button><button className="mail-onboarding-primary" disabled={busy} type="submit">{busy ? 'Verbindung wird geprüft …' : 'Postfach verbinden'}</button></div>
    </form>}
    {error && <p className="mail-onboarding-error" role="alert">{error}</p>}
    <small className="mail-privacy-note">Tipp: Nutze ein App-Passwort, falls deine Hochschule Zwei-Faktor-Anmeldung aktiviert hat.</small>
  </div>
}

type MailSnapshot = { account: MailAccount | null; threads: MailThread[]; active: string | null; drafts: Record<string,string>; nextCursor: string | null }
function readSnapshot(userId: string): MailSnapshot {
  try {
    const value=JSON.parse(sessionStorage.getItem('uniflow-mail:'+userId)||'null')
    if(value&&Array.isArray(value.threads))return {account:value.account||null,threads:value.threads,active:typeof value.active==='string'?value.active:null,drafts:value.drafts||{},nextCursor:typeof value.nextCursor==='string'?value.nextCursor:null}
  } catch { /* A missing or invalid cache must not prevent opening mail. */ }
  return {account:null,threads:[],active:null,drafts:{},nextCursor:null}
}

export default function MailPrototype({ userId, onUnreadChange, onAccountChange, onNotice }: Props) {
  const [snapshot]=useState(()=>readSnapshot(userId))
  const [account, setAccount] = useState<MailAccount | null>(snapshot.account)
  const [threads, setThreads] = useState<MailThread[]>(snapshot.threads)
  const [active, setActive] = useState<string | null>(snapshot.active)
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(true)
  const [syncBusy, setSyncBusy] = useState(false)
  const [nextCursor, setNextCursor] = useState<string | null>(snapshot.nextCursor)
  const [pullDistance, setPullDistance] = useState(0)
  const [error, setError] = useState('')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [revealed, setRevealed] = useState<string | null>(null)
  const [drafts, setDrafts] = useState<Record<string, string>>(snapshot.drafts)
  const [files, setFiles] = useState<Record<string, File[]>>({})
  const [replyingTo, setReplyingTo] = useState<Record<string, MailMessage | undefined>>({})
  const [subjectOpen, setSubjectOpen] = useState(false)
  const [subject, setSubject] = useState('')
  const [sending, setSending] = useState(false)
  const [downloading, setDownloading] = useState<string | null>(null)
  const [context, setContext] = useState<{ id: string; x: number; y: number } | null>(null)
  const composer = useRef<HTMLTextAreaElement>(null)
  const fileInput = useRef<HTMLInputElement>(null)
  const threadList = useRef<HTMLDivElement>(null)
  const loadMoreMarker = useRef<HTMLDivElement>(null)
  const pullStart = useRef<number | null>(null)
  const swipeStart = useRef<{ id: string; x: number; y: number; moved: boolean } | null>(null)
  const ignoreClick = useRef(false)
  const syncing = useRef(false)
  const deletedMessageIds=useRef(new Set<string>())
  const thread = threads.find(item => item.id === active) || null
  const currentText = thread ? drafts[thread.id] || '' : ''
  const currentFiles = thread ? files[thread.id] || [] : []
  const currentReply = thread ? replyingTo[thread.id] : undefined
  useEffect(()=>{
    if(!subjectOpen&&!context&&!active&&!selected.size&&!revealed)return
    const onBack=(event:Event)=>{
      const detail=(event as CustomEvent<{handled:boolean}>).detail
      if(detail?.handled)return
      detail.handled=true
      if(subjectOpen)setSubjectOpen(false)
      else if(context)setContext(null)
      else if(active)setActive(null)
      else if(selected.size)setSelected(new Set())
      else setRevealed(null)
    }
    window.addEventListener('uniflow-back',onBack)
    return()=>window.removeEventListener('uniflow-back',onBack)
  },[active,context,revealed,selected.size,subjectOpen])

  const loadThreads = useCallback(async (quiet = false) => {
    if(syncing.current)return
    syncing.current=true
    setSyncBusy(true)
    if (!quiet) setLoading(true)
    try {
      const result = await getMailThreads()
      const incoming=result.threads.map(item=>({...item,messages:item.messages.filter(message=>!deletedMessageIds.current.has(message.id))})).filter(item=>item.messages.length>0)
      setThreads(current=>mergeMailPages(current.map(item=>({...item,messages:item.messages.filter(message=>!deletedMessageIds.current.has(message.id))})).filter(item=>item.messages.length>0||item.id.startsWith('new:')),incoming))
      setActive(current=>current?.startsWith('new:')?(incoming.find(item=>item.address===current.slice(4))?.id||current):current)
      setNextCursor(result.nextCursor||null)
      setError('')
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Mails konnten nicht geladen werden.') }
    finally { syncing.current=false; setSyncBusy(false); if (!quiet) setLoading(false) }
  }, [])

  const loadOlderThreads = useCallback(async () => {
    if(syncing.current||!nextCursor)return
    const cursor=nextCursor
    syncing.current=true;setSyncBusy(true)
    try{
      const result=await getMailThreads(cursor)
      const incoming=result.threads.map(item=>({...item,messages:item.messages.filter(message=>!deletedMessageIds.current.has(message.id))})).filter(item=>item.messages.length>0)
      setThreads(current=>mergeMailPages(current,incoming))
      setNextCursor(result.nextCursor||null)
      setError('')
    }catch(reason){setError(reason instanceof Error?reason.message:'Ältere Mails konnten nicht geladen werden.')}
    finally{syncing.current=false;setSyncBusy(false)}
  },[nextCursor])

  useEffect(()=>{
    try { sessionStorage.setItem('uniflow-mail:'+userId,JSON.stringify({account,threads,active,drafts,nextCursor})) }
    catch { /* Storage quota must not interrupt sending or synchronization. */ }
  },[userId,account,threads,active,drafts,nextCursor])

  useEffect(()=>{onUnreadChange?.(threads.reduce((sum,item)=>sum+item.unread,0))},[threads,onUnreadChange])
  useEffect(()=>{
    const marker=loadMoreMarker.current,root=threadList.current
    if(!marker||!root||!nextCursor||query)return
    const observer=new IntersectionObserver(entries=>{if(entries[0]?.isIntersecting)void loadOlderThreads()},{root,rootMargin:'180px 0px'})
    observer.observe(marker)
    return()=>observer.disconnect()
  },[nextCursor,query,loadOlderThreads])

  useEffect(() => {
    let alive = true
    void getMailAccount().then(value => {
      if (!alive) return
      setAccount(value); onAccountChange?.(value)
      if (value.connected) void loadThreads()
      else {setThreads([]);setActive(null);setDrafts({});setLoading(false)}
    }).catch(reason => { if (alive) { setError(reason instanceof Error ? reason.message : 'Postfachstatus nicht verfügbar.'); setLoading(false) } })
    return () => { alive = false }
  }, [loadThreads, onAccountChange])
  useEffect(() => {
    if (!account?.connected) return
    const timer = window.setInterval(() => void loadThreads(true), 60_000)
    const refresh=()=>{if(document.visibilityState==='visible')void loadThreads(true)}
    window.addEventListener('online',refresh)
    window.addEventListener('focus',refresh)
    return () => {window.clearInterval(timer);window.removeEventListener('online',refresh);window.removeEventListener('focus',refresh)}
  }, [account?.connected, loadThreads])
  useEffect(() => {
    if (!context) return
    const close = () => setContext(null)
    window.addEventListener('pointerdown', close)
    window.addEventListener('blur', close)
    return () => { window.removeEventListener('pointerdown', close); window.removeEventListener('blur', close) }
  }, [context])
  useLayoutEffect(() => {
    const element = composer.current
    if (!element) return
    element.style.height = 'auto'
    element.style.height = `${Math.min(172, Math.max(36, element.scrollHeight))}px`
  }, [active, currentText])

  const connected = (value: MailAccount) => {
    setAccount(value); onAccountChange?.(value); setLoading(true); void loadThreads()
  }
  const selectThread = async (id: string) => {
    if (ignoreClick.current) { ignoreClick.current = false; return }
    setActive(id); setRevealed(null); setQuery('')
    const item = threads.find(candidate => candidate.id === id)
    if (item?.unread) {
      setThreads(current => current.map(candidate => candidate.id === id ? { ...candidate, unread: 0, messages: candidate.messages.map(message => ({ ...message, unread: false })) } : candidate))
      onUnreadChange?.(Math.max(0, threads.reduce((sum, candidate) => sum + candidate.unread, 0) - item.unread))
      void updateMailThread({ address: item.address, operation: 'read', messageIds: item.messages.map(message => message.id) })
    }
  }
  const toggleSelected = (id: string) => setSelected(current => {
    const next = new Set(current); if (next.has(id)) next.delete(id); else next.add(id); return next
  })
  const act = async (item: MailThread, operation: 'mute' | 'unmute' | 'delete' | 'read' | 'unread') => {
    if(operation==='delete'){await deleteItems([item]);return}
    try {
      await updateMailThread({ address: item.address, operation, messageIds: item.messages.map(message => message.id) })
      setThreads(current => current.map(candidate => candidate.id === item.id ? { ...candidate, muted: operation === 'mute' ? true : operation === 'unmute' ? false : candidate.muted, unread: operation === 'read' ? 0 : operation === 'unread' ? Math.max(1, candidate.unread) : candidate.unread } : candidate))
      setRevealed(null); setContext(null); onNotice?.(operation === 'mute' ? 'Unterhaltung stummgeschaltet.' : operation === 'unmute' ? 'Stummschaltung aufgehoben.' : 'Postfach aktualisiert.')
      void loadThreads(true)
    } catch (reason) { onNotice?.(reason instanceof Error ? reason.message : 'Aktion fehlgeschlagen.') }
  }
  const actSelected = async (operation: 'mute' | 'delete') => {
    const items = threads.filter(item => selected.has(item.id))
    if (!items.length) return
    if(operation==='delete'){await deleteItems(items);return}
    try {
      await Promise.all(items.map(item => updateMailThread({ address: item.address, operation, messageIds: item.messages.map(message => message.id) })))
      const ids = new Set(items.map(item => item.id))
      setThreads(current => current.map(item => ids.has(item.id) ? { ...item, muted: true } : item))
      setSelected(new Set()); onNotice?.('Unterhaltungen stummgeschaltet.'); void loadThreads(true)
    } catch (reason) { onNotice?.(reason instanceof Error ? reason.message : 'Aktion fehlgeschlagen.') }
  }
  const deleteItems=async(items:MailThread[])=>{
    const deleted:{item:MailThread;token:string}[]=[]
    let failure=''
    for(const item of items){
      try{
        const result=await updateMailThread({address:item.address,operation:'delete',messageIds:item.messages.map(message=>message.id)})
        if(!result.undoToken)throw new Error('Der Server hat keine Wiederherstellung angeboten. Postfach erneut laden.')
        deleted.push({item,token:result.undoToken})
        for(const message of item.messages)deletedMessageIds.current.add(message.id)
        setThreads(current=>current.filter(thread=>thread.id!==item.id))
        if(active===item.id)setActive(null)
      }catch(reason){failure=reason instanceof Error?reason.message:'Löschen fehlgeschlagen.';break}
    }
    setSelected(new Set());setContext(null);setRevealed(null)
    if(!deleted.length){onNotice?.(failure);return}
    onNotice?.((deleted.length===1?'Unterhaltung gelöscht.':`${deleted.length} Unterhaltungen gelöscht.`)+(failure?' Weitere konnten nicht gelöscht werden.':''),()=>{
      void(async()=>{
        try{
          for(const entry of deleted){
            await updateMailThread({address:entry.item.address,operation:'restore',undoToken:entry.token})
            for(const message of entry.item.messages)deletedMessageIds.current.delete(message.id)
          }
          onNotice?.('Löschen rückgängig gemacht.');void loadThreads(true)
        }catch(reason){onNotice?.(reason instanceof Error?reason.message:'Wiederherstellung fehlgeschlagen.')}
      })()
    })
  }
  const pointerDown = (event: ReactPointerEvent, id: string) => {
    if (event.pointerType === 'mouse' && event.button !== 0) return
    ignoreClick.current = false
    swipeStart.current = { id, x: event.clientX, y: event.clientY, moved: false }
  }
  const pointerMove = (event: ReactPointerEvent) => {
    const start = swipeStart.current
    if (start && Math.abs(event.clientX - start.x) > 10) start.moved = true
  }
  const pointerUp = (event: ReactPointerEvent, id: string) => {
    const start = swipeStart.current; swipeStart.current = null
    if (!start || start.id !== id) return
    const dx = event.clientX - start.x, dy = event.clientY - start.y
    if (Math.abs(dx) < 55 || Math.abs(dy) > Math.abs(dx) * .7) return
    ignoreClick.current = true
    window.setTimeout(() => { ignoreClick.current = false }, 0)
    if (dx < 0) setRevealed(id); else { setRevealed(null); toggleSelected(id) }
  }
  const beginReply = (message: MailMessage) => {
    if (!thread) return
    setReplyingTo(current => ({ ...current, [thread.id]: message }))
    composer.current?.focus()
  }
  const downloadAttachment = async (message:MailMessage,index:number,filename:string) => {
    const key=`${message.id}:${index}`
    setDownloading(key)
    try{await downloadMailAttachment(message.id,index,filename)}
    catch(reason){onNotice?.(reason instanceof Error?reason.message:'Der Anhang konnte nicht geladen werden.')}
    finally{setDownloading(null)}
  }
  const send = async () => {
    if (!thread || (!currentText.trim() && !currentFiles.length) || !subject.trim()) return
    setSending(true)
    try {
      const attachments = await encodeMailAttachments(currentFiles)
      const result = await sendMailMessage({ to: thread.address, subject: subject.trim(), text: currentText.trim(), attachments })
      setThreads(current => current.map(item => item.id === thread.id ? { ...item, preview: currentText.trim() || 'Anhang', date: result.message.date, messages: [...item.messages, result.message] } : item))
      setDrafts(current => ({ ...current, [thread.id]: '' })); setFiles(current => ({ ...current, [thread.id]: [] })); setReplyingTo(current => ({ ...current, [thread.id]: undefined })); setSubjectOpen(false); setSubject(''); onNotice?.('E-Mail gesendet.')
    } catch (reason) { onNotice?.(reason instanceof Error ? reason.message : 'E-Mail konnte nicht gesendet werden.') }
    finally { setSending(false) }
  }
  const q = query.trim().toLocaleLowerCase('de-DE')
  const filtered = threads.filter(item => [item.name, item.address, item.preview, ...item.messages.map(message => message.subject)].join(' ').toLocaleLowerCase('de-DE').includes(q))
  const offerNew = !!q && validDemoRecipient(query) && !threads.some(item => item.address.toLowerCase() === q)
  const newConversation = () => {
    const address = query.trim().toLowerCase(), id = `new:${address}`
    setThreads(current => [{ id, name: address, address, initials: address[0].toUpperCase(), preview: 'Neue Unterhaltung', date: new Date().toISOString(), unread: 0, muted: false, messages: [] }, ...current])
    setActive(id); setQuery('')
  }
  const beginPullRefresh = (event: ReactTouchEvent<HTMLDivElement>) => {
    if((threadList.current?.scrollTop||0)<=0&&!syncing.current)pullStart.current=event.touches[0]?.clientY??null
  }
  const movePullRefresh = (event: ReactTouchEvent<HTMLDivElement>) => {
    if(pullStart.current===null)return
    if((threadList.current?.scrollTop||0)>0){pullStart.current=null;setPullDistance(0);return}
    const distance=(event.touches[0]?.clientY??pullStart.current)-pullStart.current
    setPullDistance(distance>0?Math.min(64,distance*.36):0)
  }
  const finishPullRefresh = () => {
    const shouldRefresh=pullDistance>=48
    pullStart.current=null;setPullDistance(0)
    if(shouldRefresh)void loadThreads(true)
  }

  if (loading && !account) return <section className="mail-prototype mail-loading" aria-live="polite"><span className="mail-loading-spinner" aria-hidden="true"/><span>Postfach wird geladen …</span></section>
  if (account && !account.connected) return <section className="mail-prototype screen secondary-screen"><MailOnboarding onConnected={connected}/></section>
  return <section className="mail-prototype screen secondary-screen" aria-label="Postfach">
    <div className={'mail-layout' + (thread ? ' has-thread' : '')}>
      <aside className="mail-inbox" aria-label="Unterhaltungen">
        <div className="mail-inbox-heading"><strong>{selected.size ? `${selected.size} ausgewählt` : 'Postfach'}</strong>{selected.size ? <span className="mail-selection-actions"><button type="button" onClick={() => void actSelected('mute')} aria-label="Auswahl stummschalten"><BellOff size={16}/></button><button type="button" onClick={() => void actSelected('delete')} aria-label="Auswahl löschen"><Trash2 size={16}/></button><button type="button" title="Alle auswählen" aria-label="Alle Unterhaltungen auswählen" onClick={() => setSelected(new Set(threads.map(item=>item.id)))}><CheckCheck size={16}/></button><button type="button" onClick={() => setSelected(new Set())} aria-label="Auswahl aufheben"><X size={16}/></button></span> : syncBusy ? <span className="mail-loading-spinner small" role="status" aria-label="Postfach wird synchronisiert"/> : null}</div>
        <label className="mail-search"><Search size={16}/><input value={query} onChange={event => setQuery(event.target.value)} placeholder="Name oder E-Mail suchen" aria-label="Unterhaltungen suchen"/></label>
        {error && <button className="mail-sync-error" onClick={() => void loadThreads()}>{error} · erneut versuchen</button>}
        <div className="mail-thread-list" ref={threadList} onTouchStart={beginPullRefresh} onTouchMove={movePullRefresh} onTouchEnd={finishPullRefresh} onTouchCancel={()=>{pullStart.current=null;setPullDistance(0)}}>
          <div className={'mail-pull-refresh'+(pullDistance>=48?' is-ready':'')} style={{height:pullDistance}} aria-hidden="true"><span>↓</span>{pullDistance>=48?'Loslassen zum Aktualisieren':'Zum Aktualisieren ziehen'}</div>
          {filtered.map(item => <div className={'mail-thread-swipe' + (revealed === item.id ? ' is-revealed' : '')} key={item.id}>
            <div className="mail-thread-actions"><button type="button" onClick={() => void act(item, item.muted ? 'unmute' : 'mute')}><BellOff size={16}/><span>{item.muted ? 'Laut' : 'Stumm'}</span></button><button type="button" className="danger" onClick={() => void act(item, 'delete')}><Trash2 size={16}/><span>Löschen</span></button></div>
            <button type="button" className={'mail-thread' + (active === item.id ? ' active' : '') + (selected.has(item.id) ? ' selected' : '')}
              onClick={event => {
                if(ignoreClick.current){ignoreClick.current=false;return}
                const avatarClicked=event.target instanceof Element&&!!event.target.closest('.mail-avatar')
                if(selected.size>0&&(avatarClicked||event.detail===0))toggleSelected(item.id)
                else void selectThread(item.id)
              }} onPointerDown={event => pointerDown(event, item.id)} onPointerMove={pointerMove} onPointerUp={event => pointerUp(event, item.id)} onPointerCancel={() => { swipeStart.current = null }}
              aria-pressed={selected.has(item.id)} onContextMenu={event => { event.preventDefault(); setContext({ id: item.id, x: Math.min(event.clientX, window.innerWidth - 226), y: Math.min(event.clientY, window.innerHeight - 230) }) }}>
              <span className="mail-avatar">{selected.has(item.id) ? <Check size={17}/> : item.initials}</span>
              <span className="mail-thread-main"><strong>{item.name}{item.muted && <BellOff size={11}/>}</strong><span className="mail-thread-subject">{item.messages[item.messages.length-1]?.subject || '(Kein Betreff)'}</span><small>{item.preview}</small></span>
              <span className="mail-thread-meta"><time>{threadDate(item.date)}</time>{item.unread > 0 && <span>{item.unread}</span>}</span>
            </button>
          </div>)}
          {offerNew && <button className="mail-create-thread" type="button" onClick={newConversation}><Plus size={17}/><span>Neue Unterhaltung mit<strong>{query.trim()}</strong></span></button>}
          {!filtered.length && !offerNew && <div className="mail-empty-search">{query ? 'Keine Unterhaltung gefunden.' : 'Dein Postfach ist leer.'}</div>}
          {!query&&nextCursor&&<div className="mail-load-more" ref={loadMoreMarker}>{syncBusy?<><span className="mail-loading-spinner small" aria-hidden="true"/> Ältere Mails werden geladen …</>:<button type="button" onClick={()=>void loadOlderThreads()}>Ältere Mails laden</button>}</div>}
        </div>
        <div className="mail-inbox-bottom"><Inbox size={14}/><span>{account?.email} · synchronisiert</span></div>
      </aside>
      <div className="mail-conversation">
        {thread ? <><header className="mail-conversation-header"><button type="button" className="mail-back" onClick={() => setActive(null)} aria-label="Zurück"><ArrowLeft size={19}/></button><div className="mail-avatar small">{thread.initials}</div><div className="mail-person"><strong>{thread.name}</strong><span className="mail-header-subject">{thread.messages[thread.messages.length-1]?.subject || '(Kein Betreff)'}</span><small>{thread.address}</small></div><button type="button" className="mail-rename" onClick={() => void act(thread, thread.muted ? 'unmute' : 'mute')} title={thread.muted ? 'Stummschaltung aufheben' : 'Stummschalten'}><BellOff size={16}/></button></header>
          <div className="mail-messages">{thread.messages.map(message => <div className={'mail-message' + (message.outgoing ? ' outgoing' : '')} key={message.id}><span className="mail-message-time">{messageDate(message.date)}</span><div className="mail-bubble"><strong className="mail-message-subject">{message.subject || '(Kein Betreff)'}</strong><p>{linkedMailText(message.text || 'Diese Nachricht enthält keinen Text.')}</p>{message.attachments.map((attachment,index) => {const key=`${message.id}:${index}`,pending=message.id.startsWith('cache:');return <button type="button" className="mail-received-attachment" key={key} disabled={pending||downloading===key} title={pending?'Download nach Synchronisierung mit dem Gesendet-Ordner verfügbar':'Anhang herunterladen'} onClick={()=>void downloadAttachment(message,index,attachment.filename)}><FileText size={14}/><span>{attachment.filename}<small>{attachment.size?`${Math.max(1,Math.round(attachment.size/1024))} KB`:'Anhang'}</small></span><Download size={14}/></button>})}</div>{!message.outgoing && <button type="button" className="mail-reply" onClick={() => beginReply(message)}><Reply size={13}/> Antworten</button>}</div>)}</div>
          <div className="mail-compose">{currentReply && <div className="mail-reply-preview"><Reply size={14}/><span>Antwort auf: {currentReply.subject}</span><button type="button" aria-label="Antwortbezug entfernen" onClick={() => setReplyingTo(current => ({ ...current, [thread.id]: undefined }))}><X size={14}/></button></div>}
            {currentFiles.length > 0 && <div className="mail-attachments">{currentFiles.map(file => <span key={`${file.name}-${file.lastModified}`}><FileText size={13}/><span>{file.name}</span><button type="button" aria-label={`${file.name} entfernen`} onClick={() => setFiles(current => ({ ...current, [thread.id]: currentFiles.filter(item => item !== file) }))}><X size={13}/></button></span>)}</div>}
            <div className="mail-compose-box"><button type="button" className="mail-attach" onClick={() => fileInput.current?.click()} aria-label="Anhang auswählen"><Paperclip size={19}/></button><input type="file" multiple hidden ref={fileInput} onChange={event => { const next = Array.from(event.target.files || []); setFiles(current => ({ ...current, [thread.id]: [...currentFiles, ...next] })); event.target.value = '' }}/><textarea ref={composer} rows={1} aria-label="Nachricht schreiben" placeholder="Schreibe etwas …" value={currentText} onChange={event => setDrafts(current => ({ ...current, [thread.id]: event.target.value }))}/><button type="button" className="mail-send" aria-label="E-Mail senden" disabled={!currentText.trim() && !currentFiles.length} onClick={() => { setSubject(currentReply ? replySubject(currentReply.subject) : ''); setSubjectOpen(true) }}><Send size={17}/></button></div>
          </div></> : <div className="mail-no-conversation"><div className="mail-empty-icon"><Mail size={26}/></div><h2>Wähle eine Unterhaltung</h2><p>Deine E-Mails werden hier nach Personen wie Chats zusammengeführt.</p></div>}
      </div>
    </div>
    {context && (() => { const item = threads.find(candidate => candidate.id === context.id); return item ? <div className="mail-context-menu" role="menu" aria-label="Unterhaltungsaktionen" style={{ left: context.x, top: context.y }} onPointerDown={event => event.stopPropagation()}><button role="menuitem" onClick={() => void selectThread(item.id)}>Öffnen</button><button role="menuitem" onClick={() => void act(item, item.unread ? 'read' : 'unread')}>{item.unread ? 'Als gelesen markieren' : 'Als ungelesen markieren'}</button><button role="menuitem" onClick={() => void act(item, item.muted ? 'unmute' : 'mute')}>{item.muted ? 'Stummschaltung aufheben' : 'Stummschalten'}</button><button role="menuitem" onClick={() => { toggleSelected(item.id); setContext(null) }}>Auswählen</button><button role="menuitem" className="danger" onClick={() => void act(item, 'delete')}>Löschen</button></div> : null })()}
    {subjectOpen && thread && <div className="mail-modal-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) setSubjectOpen(false) }}><div className="mail-subject-dialog" role="dialog" aria-modal="true" aria-labelledby="mail-subject-title"><button className="mail-modal-close" type="button" aria-label="Schließen" onClick={() => setSubjectOpen(false)}><X size={18}/></button><span>E-MAIL SENDEN</span><h2 id="mail-subject-title">Betreff</h2><p>An {thread.address}</p><form onSubmit={event => { event.preventDefault(); void send() }}><label>Betreff<input autoFocus required value={subject} onChange={event => setSubject(event.target.value)} maxLength={200}/></label><div className="mail-modal-actions"><button type="button" onClick={() => setSubjectOpen(false)}>Zurück</button><button type="submit" className="mail-confirm-subject" disabled={!subject.trim() || sending}>{sending ? 'Wird gesendet …' : 'Senden'}</button></div></form></div></div>}
  </section>
}
