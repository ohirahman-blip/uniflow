import { useLayoutEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { ArrowLeft, ChevronRight, FileText, Mail, Paperclip, PenLine, Plus, Reply, Search, Send, X } from 'lucide-react'
import './mail-prototype.css'
import { validDemoRecipient, replySubject } from './mail-prototype-logic'

type DemoMessage={id:string;subject:string;text:string;date:string}
type DemoThread={id:string;name:string;address:string;initials:string;preview:string;date:string;messages:DemoMessage[]}
/** This is a local UI preview. No connection, transmission, upload or persistence. */
const examples:DemoThread[]=[
  {id:'campus',name:'Studienbüro',address:'studienbuero@beispiel.invalid',initials:'SB',
    preview:'Deine Studienunterlagen',date:'Mo',messages:[{id:'a',subject:'Deine Studienunterlagen',
    text:'Hallo! Hier siehst du später E-Mails aus deinem verbundenen Postfach – übersichtlich als Unterhaltung.',date:'Montag · 10:24'}]},
  {id:'course',name:'Tutorium',address:'tutorium@beispiel.invalid',initials:'TU',
    preview:'Rückfrage zum nächsten Termin',date:'Fr',messages:[{id:'b',subject:'Rückfrage zum nächsten Termin',
    text:'In dieser Ansicht werden Nachrichten desselben Absenders wie in einem Chat zusammengeführt.',date:'Freitag · 14:08'}]},
  {id:'service',name:'Campus-Service',address:'service@beispiel.invalid',initials:'CS',
    preview:'Willkommen im Postfach-Prototyp',date:'Do',messages:[{id:'c',subject:'Willkommen im Postfach-Prototyp',
    text:'Dies ist nur eine Beispielnachricht. Der Posteingang ist noch mit keinem Konto verbunden.',date:'Donnerstag · 09:15'}]}
]

export default function MailPrototype(){
  const [threads,setThreads]=useState<DemoThread[]>(examples)
  const [names,setNames]=useState<Record<string,string>>({})
  const [active,setActive]=useState<string|null>(null)
  const [query,setQuery]=useState('')
  const [renaming,setRenaming]=useState(false)
  const [draftName,setDraftName]=useState('')
  const [drafts,setDrafts]=useState<Record<string,string>>({})
  const [attachments,setAttachments]=useState<Record<string,{id:string;name:string}[]>>({})
  const [replyingTo,setReplyingTo]=useState<Record<string,DemoMessage|undefined>>({})
  const [subjects,setSubjects]=useState<Record<string,string>>({})
  const [subjectOpen,setSubjectOpen]=useState(false)
  const [subject,setSubject]=useState('')
  const fileInput=useRef<HTMLInputElement>(null)
  const composer=useRef<HTMLTextAreaElement>(null)
  const swipeStart=useRef<{id:string;x:number;y:number}|null>(null)
  const thread=threads.find(t=>t.id===active)||null
  const nameFor=(item:DemoThread)=>names[item.id]||item.name
  const q=query.trim().toLocaleLowerCase('de-DE')
  const filtered=threads.filter(item=>[nameFor(item),item.address,item.preview,...item.messages.map(m=>m.subject)]
    .join(' ').toLocaleLowerCase('de-DE').includes(q))
  const hasRecipient=threads.some(t=>t.address.toLocaleLowerCase('de-DE')===q)
  const offerNew=!!q&&!hasRecipient&&validDemoRecipient(query)
  const currentText=thread?drafts[thread.id]||'':''
  const currentAttachments=thread?attachments[thread.id]||[]:[]
  const currentReply=thread?replyingTo[thread.id]:undefined

  useLayoutEffect(()=>{
    const el=composer.current
    if(!el)return
    el.style.height='auto'
    el.style.height=Math.min(172,Math.max(36,el.scrollHeight))+'px'
    el.style.overflowY=el.scrollHeight>172?'auto':'hidden'
  },[active,currentText])

  const select=(id:string)=>{
    setActive(id);setRenaming(false);setSubjectOpen(false);setQuery('')
  }
  const createRecipient=()=>{
    if(!validDemoRecipient(query))return
    const email=query.trim().toLowerCase()
    const existing=threads.find(t=>t.address.toLowerCase()===email)
    if(existing){select(existing.id);return}
    const item:DemoThread={id:'recipient:'+email,name:email,address:email,initials:email[0].toUpperCase(),
      preview:'Neue Unterhaltung',date:'Neu',messages:[]}
    setThreads(prev=>[item,...prev])
    select(item.id)
  }
  const beginReply=(message:DemoMessage)=>{
    if(!thread)return
    setReplyingTo(prev=>({...prev,[thread.id]:message}))
    setSubjects(prev=>({...prev,[thread.id]:replySubject(message.subject)}))
    composer.current?.focus()
  }
  const onMessageDown=(e:ReactPointerEvent<HTMLDivElement>,id:string)=>{
    if(e.pointerType==='mouse'&&e.button!==0)return
    swipeStart.current={id,x:e.clientX,y:e.clientY}
  }
  const onMessageUp=(e:ReactPointerEvent<HTMLDivElement>,message:DemoMessage)=>{
    const start=swipeStart.current;swipeStart.current=null
    if(!start||start.id!==message.id)return
    if(e.clientX-start.x>55&&Math.abs(e.clientY-start.y)<Math.abs(e.clientX-start.x)*0.7)beginReply(message)
  }
  const showSubject=()=>{
    if(!thread||(!currentText.trim()&&!currentAttachments.length))return
    setSubject(currentReply?replySubject(currentReply.subject):subjects[thread.id]||'')
    setSubjectOpen(true)
  }
  const confirmSubject=()=>{
    if(!thread||!subject.trim())return
    // Only save the subject locally in memory. No message is sent or added.
    setSubjects(prev=>({...prev,[thread.id]:subject.trim()}))
    setSubjectOpen(false)
  }
  const startRename=()=>{if(!thread)return;setDraftName(nameFor(thread));setRenaming(true)}
  const saveName=()=>{if(!thread)return;setNames(prev=>({...prev,[thread.id]:draftName.trim()||thread.name}));setRenaming(false)}
  const addFiles=(files:FileList|null)=>{
    if(!thread||!files?.length)return
    const selected=Array.from(files).map((f,i)=>({id:Date.now()+':'+i+':'+f.name,name:f.name}))
    setAttachments(prev=>({...prev,[thread.id]:[...(prev[thread.id]||[]),...selected]}))
    if(fileInput.current)fileInput.current.value=''
  }

  return <section className="mail-prototype screen secondary-screen" aria-label="Postfach – Designvorschau">
    <div className={'mail-layout'+(thread?' has-thread':'')}>
      <aside className="mail-inbox" aria-label="Unterhaltungen">
        <div className="mail-inbox-heading"><strong>Postfach</strong><small>Vorschau</small></div>
        <label className="mail-search"><Search size={16}/><input value={query}
          onChange={e=>setQuery(e.target.value)} placeholder="Name oder E-Mail suchen" aria-label="Unterhaltungen oder E-Mail-Adresse suchen"
          autoComplete="off" autoCapitalize="off" spellCheck={false}/></label>
        <div className="mail-thread-list">
          {filtered.map(item=><button type="button" key={item.id} className={'mail-thread'+(active===item.id?' selected':'')}
            onClick={()=>select(item.id)}>
            <span className="mail-avatar">{item.initials}</span>
            <span className="mail-thread-main"><strong>{nameFor(item)}</strong>
              <small>{item.preview}</small><small className="mail-thread-address">{item.address}</small>
            </span>
            <span className="mail-thread-meta"><time>{item.date}</time><ChevronRight size={15}/></span>
          </button>)}
          {offerNew&&<button className="mail-create-thread" type="button" onClick={createRecipient}
            aria-label={'Neue Unterhaltung mit '+query.trim()+' beginnen'}>
            <Plus size={17}/><span>Neue Unterhaltung mit<strong>{query.trim()}</strong></span>
          </button>}
          {!filtered.length&&!offerNew&&<div className="mail-empty-search">
            {query.trim()?'Keine Unterhaltung gefunden. Gib eine vollständige E-Mail-Adresse ein.':'Noch keine Unterhaltungen.'}
            {query.trim()&&!validDemoRecipient(query)&&query.includes('@')&&
              <small>Beispiel: name@hochschule.de</small>}
          </div>}
        </div>
        <div className="mail-inbox-bottom"><Mail size={14}/><span>Nur Design · kein verbundenes Postfach</span></div>
      </aside>
      <div className="mail-conversation">
        {thread?<><header className="mail-conversation-header">
          <button type="button" className="mail-back" onClick={()=>setActive(null)} aria-label="Zurück zum Postfach"><ArrowLeft size={19}/></button>
          <div className="mail-avatar small">{thread.initials}</div>
          <div className="mail-person">
            {renaming?<form onSubmit={e=>{e.preventDefault();saveName()}}>
              <input autoFocus aria-label="Absender umbenennen" value={draftName} maxLength={64} onChange={e=>setDraftName(e.target.value)}/>
              <button type="submit">Speichern</button><button type="button" onClick={()=>setRenaming(false)} aria-label="Abbrechen"><X size={15}/></button>
            </form>:<><strong>{nameFor(thread)}</strong><small>{thread.address}</small></>}
          </div>
          {!renaming&&<button type="button" className="mail-rename" onClick={startRename}
            title="Anzeigenamen ändern" aria-label="Absender umbenennen"><PenLine size={16}/></button>}
        </header>
        <div className="mail-messages">
          {thread.messages.map(message=><div className="mail-message" key={message.id}
            onPointerDown={e=>onMessageDown(e,message.id)}
            onPointerUp={e=>onMessageUp(e,message)}
            onPointerCancel={()=>{swipeStart.current=null}}>
            <span className="mail-message-time">{message.date}</span>
            <div className="mail-bubble"><small>Betreff: {message.subject}</small><p>{message.text}</p></div>
            <button type="button" className="mail-reply" onClick={()=>beginReply(message)}
              title="Nach rechts wischen oder hier antworten"><Reply size={13}/> Antworten</button>
          </div>)}
          {!thread.messages.length&&<div className="mail-empty-thread">Noch keine Nachrichten. Du kannst hier einen Entwurf vorbereiten.</div>}
        </div>
        <div className="mail-compose">
          {currentReply&&<div className="mail-reply-preview"><Reply size={14}/>
            <span>Antwort auf: {currentReply.subject}</span><button type="button" aria-label="Antwortmodus schließen"
              onClick={()=>setReplyingTo(prev=>({...prev,[thread.id]:undefined}))}><X size={14}/></button>
          </div>}
          {currentAttachments.length>0&&<div className="mail-attachments">{currentAttachments.map(a=><span key={a.id}>
            <FileText size={13}/><span>{a.name}</span><button type="button" title="Anhang entfernen"
              aria-label={a.name+' entfernen'} onClick={()=>setAttachments(prev=>({
                ...prev,[thread.id]:(prev[thread.id]||[]).filter(x=>x.id!==a.id)
              }))}><X size={13}/></button>
          </span>)}</div>}
          <div className="mail-compose-box">
            <button type="button" className="mail-attach" onClick={()=>fileInput.current?.click()}
              title="Datei vormerken" aria-label="Anhang auswählen"><Paperclip size={19}/></button>
            <input type="file" multiple hidden ref={fileInput} onChange={e=>addFiles(e.target.files)} aria-label="Anhänge auswählen"/>
            <textarea ref={composer} rows={1} placeholder="Schreibe etwas …" aria-label="Nachricht schreiben"
              value={currentText} onChange={e=>setDrafts(prev=>({...prev,[thread.id]:e.target.value}))}/>
            <button type="button" className="mail-send" disabled={!currentText.trim()&&!currentAttachments.length}
              onClick={showSubject} title="Betreff eingeben" aria-label="Nachricht vorbereiten"><Send size={17}/></button>
          </div>
        </div></>:<div className="mail-no-conversation"><div className="mail-empty-icon"><Mail size={26}/></div>
          <h2>Wähle eine Unterhaltung</h2>
          <p>Oder suche nach einer vollständigen E-Mail-Adresse, um einen neuen Chat-Entwurf zu öffnen.</p>
        </div>}
      </div>
    </div>
    {subjectOpen&&thread&&<div className="mail-modal-backdrop" role="presentation"
      onMouseDown={e=>{if(e.target===e.currentTarget)setSubjectOpen(false)}}>
      <div className="mail-subject-dialog" role="dialog" aria-modal="true" aria-labelledby="mail-subject-title">
        <button className="mail-modal-close" type="button" onClick={()=>setSubjectOpen(false)} aria-label="Schließen"><X size={18}/></button>
        <span>ENTWURF</span><h2 id="mail-subject-title">Betreff</h2>
        <p>An {thread.address}</p>
        <form onSubmit={e=>{e.preventDefault();confirmSubject()}}>
          <label>Betreff<input autoFocus required value={subject} onChange={e=>setSubject(e.target.value)}
            placeholder="Worum geht es?" maxLength={200}/></label>
          <div className="mail-modal-actions"><button type="button" onClick={()=>setSubjectOpen(false)}>Zurück</button>
            <button type="submit" className="mail-confirm-subject" disabled={!subject.trim()}>Bestätigen</button></div>
        </form>
        <small>Nur ein Prototyp. Beim Bestätigen wird nichts gesendet; dein Text bleibt stehen.</small>
      </div>
    </div>}
  </section>
}
