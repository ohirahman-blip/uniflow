import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { ArrowLeft, BookOpen, Check, ChevronDown, Copy, Lock, Plus, RotateCcw, Sparkles, Trash2 } from 'lucide-react'
import {
  addDays, candidateOccurrencesOn, colors, contentGroups, formatDate, fromDate,
  intersects, isAssessment, minutes, occurrenceAtOrigin, timeString, today, uid,
  weekday, weekStart,
  type Offering, type Repeat, type Semester, type StudyModule, type Occurrence
} from './model'
import type { Journey } from './learning'
import UniflowPicker from './UniflowPicker'
import { supabase } from './supabase'
import { describeAiRequestError } from './ai-errors'
import { aiScheduleCategories, parseAiSchedulePreview, type AiScheduleSlot, type AiScheduleTopic, type AiSchedulePreview } from './ai-schedule'
import './module-schedule.css'

const dayNames = ['Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag', 'Sonntag']
const weekdayAliases: Record<string,number> = {
  mo:0,montag:0,di:1,dienstag:1,mi:2,mittwoch:2,do:3,donnerstag:3,
  fr:4,freitag:4,sa:5,samstag:5,so:6,sonntag:6
}
type Slot = AiScheduleSlot
type QuickTopic = AiScheduleTopic
type QuickPreview = AiSchedulePreview
const prettyLabel = (type:string,n:number) => type+' '+String(n).padStart(2,'0')
const norm = (value:string) => value.toLocaleLowerCase('de-DE').replace(/[\s_-]/g,'').replace(/0+(\d+)$/, '$1')
const durationOf = (o:Offering) => Math.max(1,minutes(o.to)-minutes(o.from))
const initialDate = (semester:Semester, day:number) =>
  addDays(semester.start,(day-weekday(semester.start)+7)%7)
const typeFromPrefix = (text:string) => {
  const p=text.toLocaleUpperCase('de-DE')
  if(p==='VL'||p==='VORLESUNG')return {prefix:'VL',category:'Vorlesung'}
  if(p==='Ü'||p==='UE'||p==='ÜBUNG')return {prefix:'Ü',category:'Übung'}
  if(p==='TUT'||p==='TUTORIUM')return {prefix:'TUT',category:'Tutorium'}
  if(p==='SE'||p==='SEMINAR')return {prefix:'SE',category:'Seminar'}
  return {prefix:'LERN',category:'Freies Lernen'}
}
const clock = (value:string):string|null => {
  if(!/^\d{1,2}(?::\d{1,2}|\.\d{1,2})?$/.test(value))return null
  const [h,m='0']=value.replace('.',':').split(':')
  const hh=Number(h),mm=Number(m)
  return hh>=0&&hh<=23&&mm>=0&&mm<=59?timeString(hh*60+mm):null
}
export function parseModuleQuickInput(raw:string, expectedModule:string):QuickPreview {
  const errors:string[]=[]
  const topics:QuickTopic[]=[]
  let source=raw.trim()
  const header=source.match(/^([^:\n]+):\s*(?=(?:VL|VORLESUNG|Ü|UE|ÜBUNG|TUT|TUTORIUM|SE|SEMINAR)\s*\d+)/i)
  if(header){
    if(norm(header[1])!==norm(expectedModule))errors.push('Die Überschrift "'+header[1].trim()+'" passt nicht zu '+expectedModule+'.')
    source=source.slice(header[0].length)
  }
  const entries=source.split(/[;\n]+/).map(x=>x.trim()).filter(Boolean)
  if(!entries.length)errors.push('Bitte mindestens eine Veranstaltung angeben.')
  for(const [index,entry] of entries.entries()){
    const match=entry.match(/^(VL|VORLESUNG|Ü|UE|ÜBUNG|TUT|TUTORIUM|SE|SEMINAR)\s*0*(\d+)\s+(.+)$/i)
    if(!match){errors.push('Zeile '+(index+1)+': Erwartet z. B. VL1 Mo 8 MA041 oder Di 10 MA043.');continue}
    const kind=typeFromPrefix(match[1]),label=prettyLabel(kind.prefix,Number(match[2]))
    const alternatives=match[3].split(/\s+oder\s+/i)
    const slots:Slot[]=[]
    for(const alt of alternatives){
      const parsed=alt.trim().match(/^(Mo|Montag|Di|Dienstag|Mi|Mittwoch|Do|Donnerstag|Fr|Freitag|Sa|Samstag|So|Sonntag)\s+(\d{1,2}(?::\d{1,2}|\.\d{1,2})?)(?:\s+|$)(.*)$/i)
      if(!parsed){errors.push(label+': Tag oder Uhrzeit fehlt in "'+alt.trim()+'".');continue}
      const day=weekdayAliases[parsed[1].toLocaleLowerCase('de-DE')]
      const from=clock(parsed[2])
      let tail=parsed[3].trim()
      let duration=120
      const length=tail.match(/(?:^|\s)(\d{1,3})\s*(?:min(?:uten)?|m)(?=\s|$)/i)
      if(length){duration=Number(length[1]);tail=tail.replace(length[0],' ').trim()}
      if(!from||!Number.isInteger(duration)||duration<5||duration>1440||minutes(from)+duration>1440){
        errors.push(label+': Ungültige Zeit oder Dauer in "'+alt.trim()+'".');continue
      }
      slots.push({day,from,duration,room:tail})
    }
    if(slots.length){
      const existing=topics.find(t=>norm(t.label)===norm(label)&&t.category===kind.category)
      if(existing)existing.slots.push(...slots)
      else topics.push({label,category:kind.category,slots})
    }
  }
  return {topics,errors}
}
type Props = {
  module:StudyModule;semester?:Semester;offerings:Offering[];journey?:Journey;premium:boolean;
  onBack:()=>void;onUpdateModule:(next:StudyModule)=>void;onDeleteModule:()=>void;
  onChangeOfferings:(next:Offering[])=>void;
  onOpenOccurrence:(occ:Occurrence)=>void;
  onClearException:(offeringId:string,origin:string)=>void;
  cloudStatus:'loading'|'saving'|'synced'|'error';cloudError:string;onRetrySync:()=>void;
}
export default function ModuleScheduleEditor({
  module,semester,offerings,journey,premium,onBack,onUpdateModule,onDeleteModule,
  onChangeOfferings,onOpenOccurrence,onClearException,cloudStatus,cloudError,onRetrySync
}:Props) {
  const [quickText,setQuickText]=useState('')
  const quickInputRef=useRef<HTMLTextAreaElement|null>(null)
  const resizeQuickInput=()=>{
    const field=quickInputRef.current
    if(!field)return
    field.style.height='auto'
    field.style.height=Math.max(44,field.scrollHeight)+'px'
  }
  useLayoutEffect(()=>{resizeQuickInput()},[quickText])
  const [preview,setPreview]=useState<QuickPreview|null>(null)
  const [advanced,setAdvanced]=useState(false)
  const [exceptionsOpen,setExceptionsOpen]=useState(false)
  const [expandedTopics,setExpandedTopics]=useState<Record<string,boolean>>({})
  const [deleted,setDeleted]=useState<Offering[]>([])
  const [warning,setWarning]=useState('')
  const [thinking,setThinking]=useState(false)
  const [quickError,setQuickError]=useState('')
  const previewRequest=useRef<AbortController|null>(null)
  useEffect(()=>()=>{previewRequest.current?.abort()},[])
  const imported=useRef(false)
  const own=useMemo(()=>offerings.filter(o=>
    o.moduleId===module.id&&o.semesterId===semester?.id&&!isAssessment(o.category)
  ),[offerings,module.id,semester?.id])
  const groups=useMemo(()=>contentGroups(own,module.id,semester?.id||''),[own,module.id,semester?.id])
  if(!semester)return <div className="screen secondary-screen"><button className="text-back" onClick={onBack}>← Module</button><p>Bitte zuerst ein Semester auswählen.</p></div>

  const commit=(next:Offering[])=>{setWarning('');onChangeOfferings(next)}
  const update=(id:string,changes:Partial<Offering>)=>
    commit(own.map(o=>o.id===id?{...o,...changes}:o))
  const newOffering=(contentId:string,label:string,category:string,slot:Slot,selected=false):Offering=>{
    const date=initialDate(semester,slot.day)
    const id=uid()
    return {
      id,semesterId:semester.id,moduleId:module.id,name:module.name,category,
      contentId,contentLabel:label,date,
      endDate:semester.lectureEnd>=date?semester.lectureEnd:date,
      from:slot.from,to:timeString(minutes(slot.from)+slot.duration),
      recurrence:'weekly',overrides:{},scheduleChanges:[],
      room:slot.room,onlineLink:'',organizer:'',selected
    }
  }
  const collides=(candidate:Offering,others:Offering[])=>{
    for(let date=candidate.date,i=0;i<150&&date<=candidate.endDate;i++,date=addDays(date,7)){
      if(candidateOccurrencesOn(others,date).some(x=>x.offering.semesterId===semester.id&&intersects(x,candidate)))return true
    }
    return false
  }
  const addTopic=()=>{
    const used=groups.map(g=>g.offerings[0]?.contentLabel||'')
    let n=1
    while(used.some(s=>norm(s)===norm(prettyLabel('VL',n))))n++
    const label=prettyLabel('VL',n)
    const slot={day:0,from:'08:00',duration:120,room:''}
    const fresh=newOffering('',label,'Vorlesung',slot)
    fresh.contentId=fresh.id
    fresh.selected=!collides(fresh,offerings)
    setExpandedTopics(prev=>({...prev,[fresh.contentId||fresh.id]:true}))
    commit([...own,fresh])
  }
  const addAlternative=(parent:Offering)=>{
    const slot={day:(weekday(parent.date)+1)%7,from:parent.from,duration:120,room:''}
    const fresh=newOffering(parent.contentId||parent.familyId||parent.id,parent.contentLabel||parent.category,parent.category,slot,false)
    commit([...own,fresh])
  }
  const cloneAlternative=(original:Offering)=>{
    const fresh={...original,id:uid(),overrides:{},scheduleChanges:[],selected:false}
    commit([...own,fresh])
  }
  const duplicateTopic=(topic:Offering[])=>{
    const newId=uid()
    const copies=topic.map((o,i)=>({
      ...o,id:i===0?newId:uid(),contentId:newId,
      contentLabel:(o.contentLabel||o.category)+' Kopie',
      selected:false,overrides:{},scheduleChanges:[]
    }))
    commit([...own,...copies])
  }
  const remove=(items:Offering[])=>{
    const ids=new Set(items.map(o=>o.id))
    setDeleted(items)
    commit(own.filter(o=>!ids.has(o.id)))
  }
  const undoDelete=()=>{
    if(!deleted.length)return
    const ids=new Set(own.map(o=>o.id))
    commit([...own,...deleted.filter(o=>!ids.has(o.id))])
    setDeleted([])
  }
  const setDay=(o:Offering,day:number)=>{
    let next=addDays(weekStart(o.date),day)
    if(next<semester.start)next=initialDate(semester,day)
    if(next>semester.end){setWarning('Dieser Wochentag liegt außerhalb des Semesters.');return}
    const shift=Math.round((fromDate(next).getTime()-fromDate(o.date).getTime())/86400000)
    const overrides=Object.fromEntries(Object.entries(o.overrides||{}).map(([key,value])=>[addDays(key,shift),value]))
    const scheduleChanges=o.scheduleChanges?.map(change=>({...change,fromOrigin:addDays(change.fromOrigin,shift)}))
    update(o.id,{date:next,endDate:o.recurrence==='once'?next:next>o.endDate?next:o.endDate,overrides,scheduleChanges})
  }
  const setClock=(o:Offering,from:string)=>{
    if(!from||minutes(from)+durationOf(o)>1440){setWarning('Die Veranstaltung muss am selben Tag enden.');return}
    update(o.id,{from,to:timeString(minutes(from)+durationOf(o))})
  }
  const setDuration=(o:Offering,value:number)=>{
    if(!Number.isInteger(value)||value<5||value>1440||minutes(o.from)+value>1440){
      setWarning('Dauer: 5 bis 1440 Minuten, ohne Tageswechsel.');return
    }
    update(o.id,{to:timeString(minutes(o.from)+value)})
  }
  const renameTopic=(items:Offering[],label:string)=>
    commit(own.map(o=>items.some(x=>x.id===o.id)?{...o,contentLabel:label}:o))
  const recategorize=(items:Offering[],category:string)=>
    commit(own.map(o=>items.some(x=>x.id===o.id)?{...o,category}:o))
  const updateQuickTopic=(index:number,changes:Partial<QuickTopic>)=>
    setPreview(prev=>prev?{...prev,topics:prev.topics.map((x,i)=>i===index?{...x,...changes}:x)}:null)
  const updateQuickSlot=(topicIndex:number,slotIndex:number,changes:Partial<Slot>)=>
    setPreview(prev=>prev?{...prev,topics:prev.topics.map((topic,i)=>i===topicIndex?
      {...topic,slots:topic.slots.map((slot,j)=>j===slotIndex?{...slot,...changes}:slot)}:topic)}:null)
  const generatePreview=async()=>{
    if(!premium||!quickText.trim()||thinking)return
    setPreview(null)
    setQuickError('')
    if(!supabase){setQuickError('Supabase ist nicht eingerichtet.');return}
    const controller=new AbortController()
    previewRequest.current=controller
    setThinking(true)
    try{
      // An explicit button click sends only this module name and input text,
      // never the full timetable or private workspace, to our secure Edge Function.
      const {data,error}=await supabase.functions.invoke('uniflow-ai-schedule',{
        body:{moduleName:module.name,text:quickText.trim()},
        signal:controller.signal
      })
      if(controller.signal.aborted)return
      if(error)throw new Error(await describeAiRequestError(error,'uniflow-ai-schedule'))
      setPreview(parseAiSchedulePreview(data))
    }catch(error){
      if(!controller.signal.aborted)
        setQuickError(error instanceof Error?error.message:'Die KI-Erkennung ist fehlgeschlagen.')
    }finally{
      if(previewRequest.current===controller){
        previewRequest.current=null
        setThinking(false)
      }
    }
  }
  const applyPreview=()=>{
    if(!premium||!preview||imported.current)return
    let validated:QuickPreview
    try{validated=parseAiSchedulePreview(preview)}
    catch(error){setQuickError(error instanceof Error?error.message:'Bitte prüfe die Termine.');return}
    if(!validated.topics.length)return
    imported.current=true
    const added:Offering[]=[]
    for(const topic of validated.topics){
      const current=[...own,...added].filter(o=>
        norm(o.contentLabel||'')===norm(topic.label)&&o.category===topic.category
      )
      const contentId=current[0]?.contentId||current[0]?.familyId||current[0]?.id||uid()
      for(const slot of topic.slots){
        const fresh=newOffering(contentId,topic.label,topic.category,slot,false)
        const duplicate=[...own,...added].some(o=>
          (o.contentId||o.familyId||o.id)===contentId&&
          weekday(o.date)===slot.day&&o.from===fresh.from&&o.to===fresh.to&&
          o.room.trim().toLocaleLowerCase('de-DE')===slot.room.trim().toLocaleLowerCase('de-DE')
        )
        if(duplicate)continue
        fresh.selected=current.length===0&&![...own,...added].some(o=>
          (o.contentId||o.familyId||o.id)===contentId)&&!collides(fresh,[...offerings,...added])
        added.push(fresh)
      }
    }
    if(added.length)commit([...own,...added])
    else setWarning('Alle erkannten Termine sind bereits vorhanden.')
    setPreview(null);setQuickText('');setQuickError('')
    imported.current=false
  }
  const futureExceptions=own.flatMap(o=>Object.entries(o.overrides||{})
    .filter(([date,value])=>date>=today()&&(value.scope==='single'||(!value.scope&&(!!value.cancelled||!!value.date||!!value.from))))
    .map(([origin,value])=>({o,origin,value}))).sort((a,b)=>a.origin.localeCompare(b.origin))

  return <div className="screen secondary-screen module-detail-screen module-fast">
    <button className="text-back" onClick={onBack}><ArrowLeft size={18}/> Alle Module</button>
    <div className="module-detail-heading">
      <span className="module-emoji" style={{background:module.color}}>{module.emoji||<BookOpen size={20}/>}</span>
      <div><span className="overline">MODUL</span><h1>{module.name}</h1><p>{module.credits} LP · {module.shortName}</p></div>
    </div>
    {journey&&journey.total>0&&<div className="module-fast-journey">
      <div className="module-fast-journey-head"><strong>{journey.status}</strong><span>{journey.rated}/{journey.total} bewertet</span></div>
      <p>{journey.message}</p>
      <div className="module-fast-journey-stats"><span>Verständnis <b>{journey.understanding===null?'—':journey.understanding+' %'}</b></span><span>Wiederholung <b>{journey.repetition} %</b></span><span>Klausurtraining <b>{journey.training} %</b></span></div>
    </div>}
    <div className="module-fast-state" role="status">
      {cloudStatus==='error'?<><span>Cloud-Speicherung fehlgeschlagen · Eingaben bleiben lokal erhalten.</span><button onClick={onRetrySync}>Erneut synchronisieren</button><small>{cloudError}</small></>:
        <span>{cloudStatus==='saving'?'Synchronisiere …':cloudStatus==='synced'?'Automatisch gespeichert':'Speichere lokal …'}</span>}
    </div>
    <details className="module-fast-meta" open={advanced} onToggle={e=>setAdvanced(e.currentTarget.open)}>
      <summary><span>Modulangaben bearbeiten</span><ChevronDown size={17}/></summary>
      <div className="module-fast-meta-grid">
        <label>Name<input value={module.name} onChange={e=>onUpdateModule({...module,name:e.target.value})}/></label>
        <label>Kurzname<input value={module.shortName} maxLength={10} onChange={e=>onUpdateModule({...module,shortName:e.target.value})}/></label>
        <label>Leistungspunkte<input type="number" min="0" step="0.5" value={module.credits} onChange={e=>onUpdateModule({...module,credits:Math.max(0,Number(e.target.value)||0)})}/></label>
        <label>Emoji<input value={module.emoji||''} maxLength={8} onChange={e=>onUpdateModule({...module,emoji:e.target.value})}/></label>
        <label>Status<UniflowPicker label="Modulstatus" value={module.status} onChange={value=>onUpdateModule({...module,status:value as StudyModule['status']})} options={([['current','Aktuell'],['planned','Geplant'],['open','Offen'],['passed','Bestanden'],['failed','Nicht bestanden'],['recognized','Anerkannt']] as const).map(([value,label])=>({value,label}))}/></label>
        <label>Note<input value={module.grade} onChange={e=>onUpdateModule({...module,grade:e.target.value})}/></label>
      </div>
      <div className="module-fast-colors">{colors.map(c=><button key={c} title={c} aria-label={'Modulfarbe '+c} className={module.color===c?'picked':''} style={{background:c}} onClick={()=>onUpdateModule({...module,color:c})}>{module.color===c&&<Check size={15}/>}</button>)}</div>
      <button className="module-fast-remove" onClick={onDeleteModule}><Trash2 size={16}/> Modul löschen</button>
    </details>

    {premium?
      <details className="module-fast-quick module-fast-quick-premium"
        onToggle={e=>{if(e.currentTarget.open)requestAnimationFrame(resizeQuickInput)}}>
        <summary><Sparkles size={17}/> Schnelleingabe <span className="module-quick-premium-label">uniflow+</span><ChevronDown size={16}/></summary>
        <div className="module-fast-quick-body">
          <textarea ref={quickInputRef} rows={1} aria-label="Veranstaltungen per Schnelleingabe erfassen" value={quickText}
            placeholder="Veranstaltungen, Wochentage, Zeiten und Räume eingeben …"
            maxLength={3500}
            onChange={e=>{previewRequest.current?.abort();previewRequest.current=null;setThinking(false);setQuickText(e.target.value);setPreview(null);setQuickError('')}}/>
          <button className="module-fast-preview-button" disabled={!quickText.trim()||thinking}
            onClick={()=>void generatePreview()}>{thinking?<><Sparkles size={16}/> Wird analysiert …</>:<><Sparkles size={16}/> Termine erkennen</>}</button>
          {thinking&&<div className="module-quick-thinking" aria-live="polite" role="status">
            <span className="module-quick-thinking-symbol"><Sparkles size={23}/></span>
            <div><strong>Eingabe wird analysiert</strong><span>Veranstaltungen und Alternativen werden zugeordnet.</span></div>
            <span className="module-quick-thinking-track" aria-hidden="true"><i/></span>
          </div>}
          {quickError&&<p className="module-fast-warning" role="alert">{quickError}</p>}
          {!thinking&&preview&&<div className="module-fast-preview" role="region" aria-label="Vorschau Schnelleingabe">
            <h3>Vorschau</h3>
            {preview.topics.map((t,ti)=><div className="module-fast-ai-topic" key={ti}>
              <div className="module-fast-ai-topic-head">
                <label>Veranstaltung<input aria-label={'Veranstaltung '+(ti+1)} value={t.label}
                  maxLength={90} onChange={e=>updateQuickTopic(ti,{label:e.target.value})}/></label>
                <label>Art<select aria-label={'Art '+(ti+1)} value={t.category}
                  onChange={e=>updateQuickTopic(ti,{category:e.target.value})}>
                  {aiScheduleCategories.map(cat=><option key={cat} value={cat}>{cat}</option>)}
                </select></label>
              </div>
              {t.slots.map((s,si)=><div className="module-fast-ai-slot" key={si}>
                <label>Wochentag<select aria-label={t.label+' Wochentag '+(si+1)} value={s.day}
                  onChange={e=>updateQuickSlot(ti,si,{day:Number(e.target.value)})}>
                  {dayNames.map((day,i)=><option value={i} key={day}>{day}</option>)}
                </select></label>
                <label>Beginn<input aria-label={t.label+' Beginn '+(si+1)} type="time" value={s.from}
                  onChange={e=>updateQuickSlot(ti,si,{from:e.target.value})}/></label>
                <label>Dauer (Min.)<input aria-label={t.label+' Dauer '+(si+1)} type="number" min={5} max={1440}
                  value={s.duration} onChange={e=>updateQuickSlot(ti,si,{duration:Number(e.target.value)})}/></label>
                <label>Raum<input aria-label={t.label+' Raum '+(si+1)} value={s.room} maxLength={100}
                  placeholder="Optional" onChange={e=>updateQuickSlot(ti,si,{room:e.target.value})}/></label>
              </div>)}
            </div>)}
            {preview.errors.map((message,i)=><p className="module-fast-warning" key={i}>{message}</p>)}
            <div className="module-fast-preview-actions"><button onClick={()=>setPreview(null)}>Zurück</button>
              <button className="module-fast-preview-button" disabled={!preview.topics.length}
                onClick={applyPreview}><Check size={16}/> Übernehmen</button>
            </div>
          </div>}
        </div>
      </details>
      :<div className="module-fast-quick-locked">
        <span className="module-fast-quick-locked-icon"><Lock size={17}/></span>
        <div><strong>Schnelleingabe <span>uniflow+</span></strong>
          <small>Mehrere Veranstaltungen und Alternativen direkt aus Text übernehmen.</small></div>
        <span className="module-fast-quick-lock-label">Premium</span>
      </div>}

    <div className="module-fast-section-head"><div><span className="overline">DEINE VERANSTALTUNGEN</span><h2>Vorlesungen & Übungen <small>{groups.length}</small></h2></div><button onClick={addTopic}><Plus size={17}/> Hinzufügen</button></div>
    <p className="module-fast-intro">Alle Gruppen bleiben erhalten. Bearbeite Zeiten direkt – Ende automatisch aus Beginn und Dauer.</p>
    {groups.map((group,index)=>{
      const first=group.offerings[0]
      const expanded=expandedTopics[group.id]??false
      return <section className={'module-fast-topic '+(expanded?'topic-expanded':'topic-collapsed')} key={group.id}>
        <div className="module-fast-topic-bar">
          <button type="button" className="module-fast-topic-toggle" aria-expanded={expanded} onClick={()=>setExpandedTopics(prev=>({...prev,[group.id]:!expanded}))}>
            <ChevronDown size={17} className={expanded?'expanded':''}/>
            <span>{first.contentLabel||first.category}</span>
            <small>{group.offerings.length} {group.offerings.length===1?'Termin':'Alternativen'}</small>
          </button>
        </div>
        {expanded&&<><div className="module-fast-topic-head">
          <div className="module-fast-topic-inputs">
            <label>Inhalt<input aria-label={'Inhalt Veranstaltung '+(index+1)} value={first.contentLabel??first.category} onChange={e=>renameTopic(group.offerings,e.target.value)}/></label>
            <label>Art<UniflowPicker label="Veranstaltungsart" value={first.category} allowCustom onChange={value=>recategorize(group.offerings,value)}
              options={[...(!['Vorlesung','Übung','Tutorium','Seminar','Freies Lernen'].includes(first.category)?[first.category]:[]),'Vorlesung','Übung','Tutorium','Seminar','Freies Lernen'].map(value=>({value,label:value}))}/></label>
          </div>
          <div className="module-fast-icon-actions">
            <button title="Veranstaltung duplizieren" aria-label="Veranstaltung duplizieren" onClick={()=>duplicateTopic(group.offerings)}><Copy size={17}/></button>
            <button title="Veranstaltung löschen" aria-label="Veranstaltung löschen" onClick={()=>remove(group.offerings)}><Trash2 size={17}/></button>
          </div>
        </div>
        <div className="module-fast-slot-list">
          {group.offerings.map((o,i)=>{
            const active=!!occurrenceAtOrigin(o,o.date,false)
            return <div className="module-fast-slot" key={o.id}>
              <div className="module-fast-slot-caption">
                <span className={'module-fast-dot '+(active?'active':'')}/>
                <strong>{i===0?'Gruppe 1':'Alternative '+i}</strong>
                <span>{active?'Im Plan':'Alternative'}</span>
                <div className="module-fast-icon-actions">
                  <button title="Alternative duplizieren" aria-label="Alternative duplizieren" onClick={()=>cloneAlternative(o)}><Copy size={16}/></button>
                  <button title="Alternative löschen" aria-label="Alternative löschen" onClick={()=>remove([o])}><Trash2 size={16}/></button>
                </div>
              </div>
              <div className="module-fast-fields">
                <label>Wochentag<UniflowPicker label="Wochentag" value={String(weekday(o.date))} onChange={value=>setDay(o,Number(value))} options={dayNames.map((label,n)=>({value:String(n),label}))}/></label>
                <label>Beginn<UniflowPicker kind="time" label="Beginn" value={o.from} maxMinutes={1440-durationOf(o)} onChange={value=>setClock(o,value)}/></label>
                <label>Dauer<UniflowPicker kind="duration" label="Dauer" value={String(durationOf(o))} maxMinutes={1440-minutes(o.from)} onChange={value=>setDuration(o,Number(value))}/></label>
                <label>Raum<input placeholder="z. B. MA 041" value={o.room} onChange={e=>update(o.id,{room:e.target.value})}/></label>
              </div>
              <div className="module-fast-time"><span>{dayNames[weekday(o.date)]} · {o.from}–{o.to}</span><span>{o.recurrence==='once'?'Einmalig':o.recurrence==='biweekly'?'14-täglich':'Wöchentlich'}</span></div>
              <details className="module-fast-slot-advanced"><summary>Weitere Angaben <ChevronDown size={14}/></summary>
                <div className="module-fast-fields">
                  <label>Lehrperson<input value={o.organizer||''} onChange={e=>update(o.id,{organizer:e.target.value})}/></label>
                  <label>Online-Link<input type="url" value={o.onlineLink||''} onChange={e=>update(o.id,{onlineLink:e.target.value})}/></label>
                  <label>Wiederholung<UniflowPicker label="Wiederholung" value={o.recurrence} options={[{value:'weekly',label:'Wöchentlich'},{value:'biweekly',label:'Alle 2 Wochen'},{value:'once',label:'Einmalig'}]} onChange={value=>update(o.id,{recurrence:value as Repeat,endDate:value==='once'?o.date:o.recurrence==='once'?semester.lectureEnd:o.endDate<o.date?semester.lectureEnd:o.endDate})}/></label>
                  {o.recurrence==='once'
                    ?<label>Datum<UniflowPicker kind="date" label="Datum" min={semester.start} max={semester.end} value={o.date} onChange={value=>{if(value>=semester.start&&value<=semester.end)update(o.id,{date:value,endDate:value})}}/></label>
                    :<label>Bis<UniflowPicker kind="date" label="Bis" min={o.date} max={semester.end} value={o.endDate} onChange={value=>{if(value>=o.date&&value<=semester.end)update(o.id,{endDate:value})}}/></label>}
                </div>
              </details>
            </div>
          })}
        </div>
        <div className="module-fast-topic-foot">
          <button className="module-fast-add-alt" onClick={()=>addAlternative(first)}><Plus size={16}/> Alternative hinzufügen</button>
          <details className="module-fast-link"><summary>Bestehende Gruppe zuordnen</summary>
            <div>{own.filter(o=>!group.offerings.some(g=>g.id===o.id)&&o.category===first.category).map(o=>
              <button key={o.id} onClick={()=>commit(own.map(x=>x.id===o.id?{...x,contentId:first.contentId||first.familyId||first.id,contentLabel:first.contentLabel}:x))}>
                {o.contentLabel||o.category} · {o.from}–{o.to}
              </button>)}</div>
          </details>
        </div></>}
      </section>
    })}
    {!groups.length&&<div className="module-topic-empty">Noch keine Veranstaltungen. Du kannst eine Veranstaltung anlegen oder die Schnelleingabe verwenden.</div>}
    {deleted.length>0&&<div className="module-fast-undo">Gelöscht: {deleted.length} {deleted.length===1?'Gruppe':'Gruppen'} <button onClick={undoDelete}><RotateCcw size={15}/> Rückgängig</button></div>}
    {warning&&<p className="module-fast-warning" role="alert">{warning}</p>}

    <details className="module-fast-exceptions" open={exceptionsOpen} onToggle={e=>setExceptionsOpen(e.currentTarget.open)}>
      <summary>Zukünftige Ausnahmen · {futureExceptions.length}<ChevronDown size={17}/></summary>
      {futureExceptions.length===0?<p>Keine zukünftigen Einzelausnahmen.</p>:futureExceptions.map(({o,origin,value})=>
        <div className="module-fast-exception" key={o.id+origin}><span>{formatDate(origin)} · {o.contentLabel||o.category}<small>{value.cancelled?'Entfällt':value.reason==='move'?'Einmalig verschoben':value.selected?'Einmalig besuchen':'Einmalig nicht besuchen'}</small></span>
          <button onClick={()=>{const occ=occurrenceAtOrigin(o,origin,true);if(occ)onOpenOccurrence(occ)}}>Ansehen</button>
          <button onClick={()=>onClearException(o.id,origin)}>Zurücksetzen</button>
        </div>)}
    </details>
  </div>
}
