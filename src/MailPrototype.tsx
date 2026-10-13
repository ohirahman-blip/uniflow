import { useRef, useState } from 'react'
import { ArrowLeft, ChevronRight, FileText, Mail, Paperclip, PenLine, Search, Send, X } from 'lucide-react'
import './mail-prototype.css'

type DemoThread={id:string;name:string;address:string;initials:string;preview:string;date:string;
  messages:{id:string;from:'in';subject:string;text:string;date:string}[]}
/** Strictly visual demo: no IMAP, uploads, persistence or outbound messages. */
const examples:DemoThread[]=[
  {id:'campus',name:'Studienbüro',address:'studienbuero@beispiel.invalid',initials:'SB',
    preview:'Deine Studienunterlagen',date:'Mo',
    messages:[{id:'a',from:'in',subject:'Deine Studienunterlagen',text:'Hallo! Hier siehst du später E-Mails aus deinem verbundenen Postfach – übersichtlich als Unterhaltung.',date:'Montag · 10:24'}]},
  {id:'course',name:'Tutorium',address:'tutorium@beispiel.invalid',initials:'TU',
    preview:'Rückfrage zum nächsten Termin',date:'Fr',
    messages:[{id:'b',from:'in',subject:'Rückfrage zum nächsten Termin',text:'In dieser Ansicht werden Nachrichten desselben Absenders wie in einem Chat zusammengeführt.',date:'Freitag · 14:08'}]},
  {id:'service',name:'Campus-Service',address:'service@beispiel.invalid',initials:'CS',
    preview:'Willkommen im Mail-Prototyp',date:'Do',
    messages:[{id:'c',from:'in',subject:'Willkommen im Mail-Prototyp',text:'Dies ist nur eine Beispielnachricht. Der Posteingang ist noch mit keinem Konto verbunden.',date:'Donnerstag · 09:15'}]}
]

export default function MailPrototype(){
  const [names,setNames]=useState<Record<string,string>>({})
  const [active,setActive]=useState<string|null>(null)
  const [query,setQuery]=useState('')
  const [renaming,setRenaming]=useState(false)
  const [draftName,setDraftName]=useState('')
  const [drafts,setDrafts]=useState<Record<string,string>>({})
  const [attachments,setAttachments]=useState<Record<string,{id:string;name:string}[]>>({})
  const [subjectOpen,setSubjectOpen]=useState(false)
  const [subject,setSubject]=useState('')
  const fileInput=useRef<HTMLInputElement>(null)
  const thread=examples.find(item=>item.id===active)||null
  const nameFor=(item:DemoThread)=>names[item.id]||item.name
  const filtered=examples.filter(item=>(nameFor(item)+' '+item.preview).toLocaleLowerCase('de-DE').includes(query.toLocaleLowerCase('de-DE')))
  const currentText=thread?drafts[thread.id]||'':''
  const currentAttachments=thread?attachments[thread.id]||[]:[]
  const showSubject=()=>{if(!thread||(!currentText.trim()&&!currentAttachments.length))return;setSubject('');setSubjectOpen(true)}
  const startRename=()=>{if(!thread)return;setDraftName(nameFor(thread));setRenaming(true)}
  const saveName=()=>{if(!thread)return;setNames(prev=>({...prev,[thread.id]:draftName.trim()||thread.name}));setRenaming(false)}
  const addFiles=(files:FileList|null)=>{
    if(!thread||!files?.length)return
    const selected=Array.from(files).map(file=>({id:crypto.randomUUID(),name:file.name}))
    setAttachments(prev=>({...prev,[thread.id]:[...(prev[thread.id]||[]),...selected]}))
    if(fileInput.current)fileInput.current.value=''
  }
  return <section className="mail-prototype screen secondary-screen" aria-label="Mail-Prototyp">
    <header className="mail-page-heading"><div><span>DEINE NACHRICHTEN</span><h1>Mail</h1></div>
      <span className="mail-demo-pill">Designvorschau</span>
    </header>
    <p className="mail-preview-disclaimer">Noch kein Postfach verbunden. Alle Gespräche sind Beispiele; E-Mails werden nicht gesendet oder empfangen.</p>
    <div className={'mail-layout'+(thread?' has-thread':'')}>
      <aside className="mail-inbox" aria-label="Absender">
        <div className="mail-inbox-heading"><strong>Postfach</strong><small>{examples.length} Beispiele</small></div>
        <label className="mail-search"><Search size={16}/><input value={query}
          onChange={e=>setQuery(e.target.value)} placeholder="Unterhaltungen suchen" aria-label="Unterhaltungen suchen"/></label>
        <div className="mail-thread-list">
          {filtered.map(item=><button type="button" key={item.id} className={'mail-thread'+(active===item.id?' selected':'')}
            onClick={()=>{setActive(item.id);setRenaming(false);setSubjectOpen(false)}}>
            <span className="mail-avatar">{item.initials}</span>
            <span className="mail-thread-main"><strong>{nameFor(item)}</strong><small>{item.preview}</small></span>
            <span className="mail-thread-meta"><time>{item.date}</time><ChevronRight size={15}/></span>
          </button>)}
          {!filtered.length&&<p className="mail-empty-search">Keine Beispiele gefunden.</p>}
        </div>
        <div className="mail-inbox-bottom"><Mail size={15}/><span>IMAP-Verbindung folgt später</span></div>
      </aside>
      <div className="mail-conversation">
        {thread?<><header className="mail-conversation-header">
          <button type="button" className="mail-back" onClick={()=>setActive(null)} aria-label="Zurück zur Übersicht"><ArrowLeft size={19}/></button>
          <div className="mail-avatar small">{thread.initials}</div>
          <div className="mail-person">
            {renaming?<form onSubmit={e=>{e.preventDefault();saveName()}}>
              <input autoFocus aria-label="Absender umbenennen" value={draftName} maxLength={64} onChange={e=>setDraftName(e.target.value)}/>
              <button type="submit">Speichern</button><button type="button" onClick={()=>setRenaming(false)} aria-label="Abbrechen"><X size={15}/></button>
            </form>:<><strong>{nameFor(thread)}</strong><small>{thread.address}</small></>}
          </div>
          {!renaming&&<button type="button" className="mail-rename" onClick={startRename} title="Anzeigenamen ändern" aria-label="Absender umbenennen"><PenLine size={16}/></button>}
        </header>
        <div className="mail-messages">
          <span className="mail-demo-marker">BEISPIELUNTERHALTUNG</span>
          {thread.messages.map(message=><div className="mail-message" key={message.id}>
            <span className="mail-message-time">{message.date}</span>
            <div className="mail-bubble"><small>Betreff: {message.subject}</small><p>{message.text}</p></div>
          </div>)}
        </div>
        <div className="mail-compose">
          {currentAttachments.length>0&&<div className="mail-attachments">{currentAttachments.map(a=><span key={a.id}>
            <FileText size={13}/><span>{a.name}</span><button type="button" title="Anhang entfernen" aria-label={a.name+' entfernen'}
              onClick={()=>setAttachments(prev=>({...prev,[thread.id]:(prev[thread.id]||[]).filter(x=>x.id!==a.id)}))}><X size={13}/></button>
          </span>)}</div>}
          <div className="mail-compose-box">
            <button type="button" className="mail-attach" onClick={()=>fileInput.current?.click()} title="Datei vormerken" aria-label="Anhang auswählen"><Paperclip size={19}/></button>
            <input type="file" multiple hidden ref={fileInput} onChange={e=>addFiles(e.target.files)} aria-label="Anhänge auswählen"/>
            <textarea rows={1} placeholder="Schreibe etwas …" aria-label="Nachricht schreiben" value={currentText}
              onChange={e=>setDrafts(prev=>({...prev,[thread.id]:e.target.value}))}/>
            <button type="button" className="mail-send" disabled={!currentText.trim()&&!currentAttachments.length}
              onClick={showSubject} title="Betreff auswählen (Versand noch nicht verfügbar)" aria-label="Nachricht vorbereiten"><Send size={17}/></button>
          </div>
          <small>Nur Vorschau – kein Versand und kein Upload</small>
        </div></>:<div className="mail-no-conversation"><div className="mail-empty-icon"><Mail size={28}/></div>
          <h2>Deine Mails. Wie ein Chat.</h2>
          <p>Wähle einen Absender aus, um die Ansicht zu testen. Bald kannst du hier Postfächer verbinden.</p>
        </div>}
      </div>
    </div>
    {subjectOpen&&thread&&<div className="mail-modal-backdrop" role="presentation" onMouseDown={e=>{if(e.target===e.currentTarget)setSubjectOpen(false)}}>
      <div className="mail-subject-dialog" role="dialog" aria-modal="true" aria-labelledby="mail-subject-title">
        <button className="mail-modal-close" type="button" onClick={()=>setSubjectOpen(false)} aria-label="Schließen"><X size={18}/></button>
        <span>MAIL VORBEREITEN</span><h2 id="mail-subject-title">Betreff hinzufügen</h2>
        <p>An {nameFor(thread)} · {currentAttachments.length} Anhänge ausgewählt</p>
        <label>Betreff<input autoFocus value={subject} onChange={e=>setSubject(e.target.value)} placeholder="Worum geht es?"/></label>
        <div className="mail-modal-actions"><button type="button" onClick={()=>setSubjectOpen(false)}>Zurück</button>
          <button type="button" className="mail-disabled-send" disabled title="Versand folgt später">Senden · bald verfügbar</button></div>
        <small>Prototyp: Diese Nachricht wird nicht verschickt. Text und Anhänge bleiben als lokaler Entwurf erhalten.</small>
      </div>
    </div>}
  </section>
}
