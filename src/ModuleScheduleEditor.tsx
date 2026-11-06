import { useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { ArrowLeft, Check, ChevronDown, Lock, PenLine, Plus, RotateCcw, Sparkles, Trash2, X } from 'lucide-react'
import {
  addDays, candidateOccurrencesOn, colors, contentGroups, formatDate, fromDate,
  inferOfferingCategory, intersects, isAssessment, minutes, occurrenceAtOrigin, timeString, today, uid,
  upsertAssessment, weekday, weekStart,
  type Assessment, type Offering, type OfferingImportance, type Repeat, type Semester, type StudyModule, type Occurrence
} from './model'
import type { Journey, LearningCheckin, LearningSession, LessonTopic } from './learning'
import UniflowPicker from './UniflowPicker'
import { supabase } from './supabase'
import { describeAiRequestError } from './ai-errors'
import { parseAiSchedulePreview, type AiScheduleSlot, type AiScheduleTopic, type AiSchedulePreview } from './ai-schedule'
import { useSwipeToDismiss } from './useSwipeToDismiss'
import './module-schedule.css'

const dayNames = ['Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag', 'Sonntag']
const weekdayAliases: Record<string,number> = {
  mo:0,montag:0,di:1,dienstag:1,mi:2,mittwoch:2,do:3,donnerstag:3,
  fr:4,freitag:4,sa:5,samstag:5,so:6,sonntag:6
}
type Slot = AiScheduleSlot
type QuickTopic = AiScheduleTopic
type QuickPreview = AiSchedulePreview
type EventDraft={name:string;linkedGroupId:string;day:number;from:string;to:string;room:string;importance:OfferingImportance;recurrence:Repeat;date:string;endDate:string;organizer:string;onlineLink:string;advanced:boolean}
const prettyLabel = (type:string,n:number) => type+' '+String(n).padStart(2,'0')
const norm = (value:string) => value.toLocaleLowerCase('de-DE').replace(/[\s_-]/g,'').replace(/0+(\d+)$/, '$1')
const durationOf = (o:Offering) => Math.max(1,minutes(o.to)-minutes(o.from))
const offeringSentence=(offering:Offering)=>{
  const date=formatDate(offering.date,{day:'numeric',month:'short',year:'numeric'})
  if(offering.recurrence==='once')return `Einmalig am ${date} · ${offering.from}–${offering.to}`
  const rhythm=offering.recurrence==='biweekly'?'Alle 2 Wochen':'Wöchentlich'
  return `${rhythm} ab ${date} · jeden ${dayNames[weekday(offering.date)]} um ${offering.from}–${offering.to}`
}
const initialDate = (semester:Semester, day:number) =>
  addDays(semester.start,(day-weekday(semester.start)+7)%7)
function ModuleOverlay({title,onClose,accent,children}:{title:string;onClose:()=>void;accent:string;children:ReactNode}){
  const sheet=useRef<HTMLElement>(null)
  useSwipeToDismiss(sheet,onClose)
  useEffect(()=>{
    const close=(event:KeyboardEvent)=>{if(event.key==='Escape')onClose()}
    window.addEventListener('keydown',close)
    return()=>window.removeEventListener('keydown',close)
  },[onClose])
  return createPortal(<div className="mlh-overlay module-event-overlay" onPointerDown={event=>{if(event.target===event.currentTarget)onClose()}}>
    <section ref={sheet} className="mlh-sheet module-event-sheet" role="dialog" aria-modal="true" aria-label={title} style={{'--module-accent':accent,'--mlh-accent':accent} as CSSProperties}>
      <i className="mlh-sheet-handle" aria-hidden="true"/>
      <header><h2>{title}</h2><button type="button" onClick={onClose} aria-label="Schließen"><X size={20}/></button></header>
      <div className="module-event-sheet-body">{children}</div>
    </section>
  </div>,document.body)
}
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
  return {topics,assessments:[],exceptions:[],errors}
}
type Props = {
  module:StudyModule;moduleSemesterControl?:import('react').ReactNode;semester?:Semester;offerings:Offering[];assessments:Assessment[];journey?:Journey;premium:boolean;
  onBack:()=>void;onUpdateModule:(next:StudyModule)=>void;onDeleteModule:()=>void;
  onChangeOfferings:(next:Offering[])=>void;
  onChangeAssessments:(next:Assessment[])=>void;
  onOpenOccurrence:(occ:Occurrence)=>void;
  onClearException:(offeringId:string,origin:string)=>void;
  learningSessions:LearningSession[];learningCheckins:LearningCheckin[];lessonTopics:LessonTopic[];
  onChangeLearningSessions:(next:LearningSession[])=>void;
  onChangeLearningCheckins:(next:LearningCheckin[])=>void;
}
export default function ModuleScheduleEditor({
  module,moduleSemesterControl,semester,offerings,assessments,premium,onBack,onUpdateModule,onDeleteModule,
  onChangeOfferings,onChangeAssessments,onOpenOccurrence,onClearException
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
  const [exceptionEditor,setExceptionEditor]=useState(false)
  const [exceptionOfferingId,setExceptionOfferingId]=useState('')
  const [exceptionOrigin,setExceptionOrigin]=useState(()=>today())
  const [exceptionKind,setExceptionKind]=useState<'move'|'cancel'>('move')
  const [exceptionDate,setExceptionDate]=useState(()=>today())
  const [exceptionFrom,setExceptionFrom]=useState('10:00')
  const [exceptionTo,setExceptionTo]=useState('12:00')
  const [editingSlotId,setEditingSlotId]=useState<string|null>(null)
  const [groupEditorId,setGroupEditorId]=useState('')
  const [eventDraft,setEventDraft]=useState<EventDraft|null>(null)
  const [deleted,setDeleted]=useState<Offering[]>([])
  const [warning,setWarning]=useState('')
  const [thinking,setThinking]=useState(false)
  const [quickError,setQuickError]=useState('')
  useEffect(()=>{
    if(!advanced&&!editingSlotId&&!groupEditorId&&!exceptionsOpen&&!exceptionEditor&&!preview&&!eventDraft)return
    const onBack=(event:Event)=>{
      const detail=(event as CustomEvent<{handled:boolean}>).detail
      if(detail?.handled)return
      detail.handled=true
      if(eventDraft)setEventDraft(null)
      else if(editingSlotId)setEditingSlotId(null)
      else if(groupEditorId)setGroupEditorId('')
      else if(exceptionEditor)setExceptionEditor(false)
      else if(exceptionsOpen)setExceptionsOpen(false)
      else if(preview)setPreview(null)
      else if(advanced)setAdvanced(false)
    }
    window.addEventListener('uniflow-back',onBack)
    return()=>window.removeEventListener('uniflow-back',onBack)
  },[advanced,editingSlotId,groupEditorId,exceptionsOpen,exceptionEditor,preview,eventDraft])
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
  const newOffering=(contentId:string,label:string,category:string,slot:Slot,selected=false,importance:OfferingImportance='normal'):Offering=>{
    const date=slot.date||initialDate(semester,slot.day)
    const recurrence=slot.recurrence||'weekly'
    const id=uid()
    return {
      id,semesterId:semester.id,moduleId:module.id,name:module.name,category,
      contentId,contentLabel:label,date,
      endDate:recurrence==='once'?date:slot.endDate||(semester.lectureEnd>=date?semester.lectureEnd:date),
      from:slot.from,to:timeString(minutes(slot.from)+slot.duration),
      recurrence,overrides:{},scheduleChanges:[],
      room:slot.room,onlineLink:slot.onlineLink||'',organizer:slot.organizer||'',selected,importance
    }
  }
  const collides=(candidate:Offering,others:Offering[])=>{
    for(let date=candidate.date,i=0;i<150&&date<=candidate.endDate;i++,date=addDays(date,7)){
      if(!candidateOccurrencesOn([candidate],date,true).length)continue
      if(candidateOccurrencesOn(others,date).some(x=>x.offering.semesterId===semester.id&&intersects(x,candidate)))return true
    }
    return false
  }
  const openEventCreator=()=>setEventDraft({name:'',linkedGroupId:'',day:0,from:'10:00',to:'12:00',room:'',importance:'normal',recurrence:'weekly',date:initialDate(semester,0),endDate:semester.lectureEnd,organizer:'',onlineLink:'',advanced:false})
  const eventNameSuggestions=eventDraft&&!eventDraft.linkedGroupId&&norm(eventDraft.name).length>=2
    ?groups.filter(group=>norm(group.offerings[0]?.contentLabel||group.offerings[0]?.category||'').includes(norm(eventDraft.name))).slice(0,3):[]
  const linkEventGroup=(groupId:string)=>{
    const group=groups.find(item=>item.id===groupId),source=group?.offerings[0]
    if(!source)return
    setEventDraft(current=>current?{...current,name:source.contentLabel||source.category,linkedGroupId:groupId,day:weekday(source.date),from:source.from,to:source.to,importance:source.importance||'normal',recurrence:source.recurrence,date:source.date,endDate:source.endDate}:current)
  }
  const changeEventName=(name:string)=>{
    const exact=groups.find(group=>norm(group.offerings[0]?.contentLabel||group.offerings[0]?.category||'')===norm(name))
    if(exact){linkEventGroup(exact.id);return}
    setEventDraft(current=>current?{...current,name,linkedGroupId:''}:current)
  }
  const changeEventDay=(day:number)=>setEventDraft(current=>{
    if(!current)return current
    let date=addDays(weekStart(current.date),day)
    if(date<semester.start)date=initialDate(semester,day)
    if(date>semester.end)date=initialDate(semester,day)
    return {...current,day,date,endDate:current.recurrence==='once'?date:current.endDate<date?semester.lectureEnd:current.endDate}
  })
  const saveEventDraft=()=>{
    if(!eventDraft?.name.trim()){setWarning('Gib der Veranstaltung einen Namen.');return}
    if(minutes(eventDraft.to)<=minutes(eventDraft.from)){setWarning('Das Ende muss nach dem Beginn liegen.');return}
    if(eventDraft.date<semester.start||eventDraft.date>semester.end){setWarning('Der Beginn liegt außerhalb des Semesters.');return}
    if(eventDraft.recurrence!=='once'&&(eventDraft.endDate<eventDraft.date||eventDraft.endDate>semester.end)){setWarning('Prüfe den Zeitraum der Veranstaltung.');return}
    const group=groups.find(item=>item.id===eventDraft.linkedGroupId),source=group?.offerings[0]
    const contentId=source?.contentId||source?.familyId||source?.id||uid()
    const slot:Slot={day:eventDraft.day,from:eventDraft.from,duration:minutes(eventDraft.to)-minutes(eventDraft.from),room:eventDraft.room,date:eventDraft.date,endDate:eventDraft.endDate,recurrence:eventDraft.recurrence,organizer:eventDraft.organizer,onlineLink:eventDraft.onlineLink}
    const fresh=newOffering(contentId,eventDraft.name.trim(),source?.category||inferOfferingCategory(eventDraft.name),slot,false,eventDraft.importance)
    fresh.selected=source?false:!collides(fresh,offerings)
    const nextOwn=source?own.map(item=>(item.contentId||item.familyId||item.id)===contentId?{...item,importance:eventDraft.importance}:item):own
    commit([...nextOwn,fresh]);setEventDraft(null)
  }
  const remove=(items:Offering[])=>{
    const ids=new Set(items.map(o=>o.id))
    setDeleted(items)
    if(items.some(item=>item.id===editingSlotId))setEditingSlotId(null)
    commit(own.filter(o=>!ids.has(o.id)))
  }
  const undoDelete=()=>{
    if(!deleted.length)return
    const ids=new Set(own.map(o=>o.id))
    commit([...own,...deleted.filter(o=>!ids.has(o.id))])
    setDeleted([])
  }
  const setSeriesStart=(o:Offering,next:string)=>{
    if(next<semester.start||next>semester.end){setWarning('Der Beginn liegt außerhalb des Semesters.');return}
    const shift=Math.round((fromDate(next).getTime()-fromDate(o.date).getTime())/86400000)
    const overrides=Object.fromEntries(Object.entries(o.overrides||{}).map(([key,value])=>[addDays(key,shift),value]))
    const scheduleChanges=o.scheduleChanges?.map(change=>({...change,fromOrigin:addDays(change.fromOrigin,shift)}))
    update(o.id,{date:next,endDate:o.recurrence==='once'?next:next>o.endDate?next:o.endDate,overrides,scheduleChanges})
  }
  const setDay=(o:Offering,day:number)=>{
    let next=addDays(weekStart(o.date),day)
    if(next<semester.start)next=initialDate(semester,day)
    if(next>semester.end){setWarning('Dieser Wochentag liegt außerhalb des Semesters.');return}
    setSeriesStart(o,next)
  }
  const setClock=(o:Offering,from:string)=>{
    if(!from||minutes(from)+durationOf(o)>1440){setWarning('Die Veranstaltung muss am selben Tag enden.');return}
    update(o.id,{from,to:timeString(minutes(from)+durationOf(o))})
  }
  const setEnd=(o:Offering,to:string)=>{
    if(!to||minutes(to)<=minutes(o.from)){setWarning('Das Ende muss nach dem Beginn liegen.');return}
    update(o.id,{to})
  }
  const renameTopic=(items:Offering[],label:string)=>
    commit(own.map(o=>items.some(x=>x.id===o.id)?{...o,contentLabel:label,category:inferOfferingCategory(label)}:o))
  const setTopicImportance=(items:Offering[],importance:OfferingImportance)=>
    commit(own.map(o=>items.some(x=>x.id===o.id)?{...o,importance}:o))
  const openExceptionEditor=()=>{
    const first=own.find(item=>item.selected)||own[0]
    if(!first){setWarning('Lege zuerst eine Veranstaltung an.');return}
    let origin=first.date
    const step=first.recurrence==='biweekly'?14:first.recurrence==='weekly'?7:0
    while(step&&origin<today()&&origin<=first.endDate)origin=addDays(origin,step)
    if(origin<today()||origin>first.endDate){setWarning('Für diese Veranstaltung gibt es keinen zukünftigen Termin.');return}
    setExceptionOfferingId(first.id);setExceptionOrigin(origin);setExceptionDate(origin)
    setExceptionFrom(first.from);setExceptionTo(first.to);setExceptionKind('move');setExceptionEditor(true);setExceptionsOpen(true)
  }
  const saveException=()=>{
    const offering=own.find(item=>item.id===exceptionOfferingId)
    if(!offering){setWarning('Bitte wähle eine Veranstaltung.');return}
    if(!occurrenceAtOrigin(offering,exceptionOrigin,true,true)){setWarning('Am gewählten Datum findet diese Veranstaltung nicht statt.');return}
    if(exceptionKind==='move'&&minutes(exceptionTo)<=minutes(exceptionFrom)){setWarning('Das Ende muss nach dem Beginn liegen.');return}
    commit(own.map(item=>item.id===offering.id?{...item,overrides:{...(item.overrides||{}),[exceptionOrigin]:exceptionKind==='cancel'
      ?{date:exceptionOrigin,from:item.from,to:item.to,cancelled:true,scope:'single',reason:'removal'}
      :{date:exceptionDate,from:exceptionFrom,to:exceptionTo,scope:'single',reason:'move'}}}:item))
    setExceptionEditor(false);setExceptionsOpen(true)
  }
  const updateQuickTopic=(index:number,changes:Partial<QuickTopic>)=>
    setPreview(prev=>prev?{...prev,topics:prev.topics.map((x,i)=>i===index?{...x,...changes}:x)}:null)
  const updateQuickSlot=(topicIndex:number,slotIndex:number,changes:Partial<Slot>)=>
    setPreview(prev=>prev?{...prev,topics:prev.topics.map((topic,i)=>i===topicIndex?
      {...topic,slots:topic.slots.map((slot,j)=>j===slotIndex?{...slot,...changes}:slot)}:topic)}:null)
  const generatePreview=async()=>{
    if(!premium||!quickText.trim()||thinking)return
    setPreview(null)
    setQuickError('')
    if(!supabase){setQuickError('unicloud ist nicht eingerichtet.');return}
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
    if(!validated.topics.length&&!validated.assessments.length&&!validated.exceptions.length)return
    for(const topic of validated.topics){
      for(const slot of topic.slots){
        const date=slot.date||initialDate(semester,slot.day)
        const endDate=slot.recurrence==='once'?date:slot.endDate||(semester.lectureEnd>=date?semester.lectureEnd:date)
        if(date<semester.start||date>semester.end||endDate<date||endDate>semester.end){
          setQuickError('Der Termin "'+topic.label+'" liegt außerhalb des Semesters oder endet vor seinem Beginn. Bitte prüfe Startdatum und „Bis“.')
          return
        }
      }
    }
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
          o.date===fresh.date&&o.endDate===fresh.endDate&&
          o.recurrence===fresh.recurrence&&o.from===fresh.from&&o.to===fresh.to&&
          o.room.trim().toLocaleLowerCase('de-DE')===fresh.room.trim().toLocaleLowerCase('de-DE')&&
          (o.organizer||'')===fresh.organizer&&(o.onlineLink||'')===fresh.onlineLink
        )
        if(duplicate)continue
        fresh.selected=current.length===0&&![...own,...added].some(o=>
          (o.contentId||o.familyId||o.id)===contentId)&&!collides(fresh,[...offerings,...added])
        added.push(fresh)
      }
    }
    let changed=false
    if(added.length){commit([...own,...added]);changed=true}
    if(validated.assessments.length){
      let next=assessments
      for(const item of validated.assessments)next=upsertAssessment(next,{id:uid(),semesterId:semester.id,moduleId:module.id,...item})
      onChangeAssessments(next);changed=true
    }
    if(validated.exceptions.length){
      const baseOfferings=[...own,...added]
      const changedOwn=baseOfferings.map(offering=>{
        const matching=validated.exceptions.filter(item=>norm(item.topicLabel)===norm(offering.contentLabel||offering.category)&&occurrenceAtOrigin(offering,item.date,true,true))
        if(!matching.length)return offering
        const overrides={...(offering.overrides||{})}
        for(const item of matching)overrides[item.date]=item.action==='cancel'
          ?{date:item.date,from:offering.from,to:offering.to,cancelled:true,scope:'single',reason:'removal'}
          :{date:item.targetDate,from:item.from,to:item.to,scope:'single',reason:'move'}
        return {...offering,overrides}
      })
      if(changedOwn.some((item,index)=>item!==baseOfferings[index])){commit(changedOwn);changed=true}
    }
    if(!changed)setWarning('Alle erkannten Angaben sind bereits vorhanden oder konnten keiner Veranstaltung zugeordnet werden.')
    setPreview(null);setQuickText('');setQuickError('')
    imported.current=false
  }
  const futureExceptions=own.flatMap(o=>Object.entries(o.overrides||{})
    .filter(([date,value])=>date>=today()&&(value.scope==='single'||(!value.scope&&(!!value.cancelled||!!value.date||!!value.from))))
    .map(([origin,value])=>({o,origin,value}))).sort((a,b)=>a.origin.localeCompare(b.origin))
  const editingGroup=groups.find(group=>group.id===groupEditorId)
  const editingOffering=editingGroup?.offerings.find(item=>item.id===editingSlotId)
  return <div className="screen secondary-screen module-detail-screen module-fast" style={{'--module-accent':module.color,'--mlh-accent':module.color} as CSSProperties}>
    <button className="text-back module-editor-back" onClick={onBack} aria-label="Zurück"><ArrowLeft size={20}/></button>
    <div className="module-detail-heading">
      <div><h1>{module.name}</h1></div>
    </div>
    <button type="button" className="module-meta-open" onClick={()=>setAdvanced(true)}><PenLine size={17}/><span><strong>Modulangaben bearbeiten</strong><small>Name, Status, Leistungspunkte und Farbe</small></span><ChevronDown size={17}/></button>
    {advanced&&<ModuleOverlay title="Modulangaben bearbeiten" accent={module.color} onClose={()=>setAdvanced(false)}><div className="module-meta-popup"><div className="module-fast-meta-grid">
        <label>Name<input value={module.name} onChange={e=>onUpdateModule({...module,name:e.target.value})}/></label>
        <label>Kurzname<input value={module.shortName} maxLength={10} onChange={e=>onUpdateModule({...module,shortName:e.target.value})}/></label>
        <label>Leistungspunkte<input type="number" min="0" step="0.5" value={module.credits} onChange={e=>onUpdateModule({...module,credits:Math.max(0,Number(e.target.value)||0)})}/></label>
        <label>Emoji<input value={module.emoji||''} maxLength={8} onChange={e=>onUpdateModule({...module,emoji:e.target.value})}/></label>
        <label>Status<UniflowPicker label="Modulstatus" value={module.status} onChange={value=>onUpdateModule({...module,status:value as StudyModule['status']})} options={([['current','Aktuell'],['planned','Geplant'],['open','Offen'],['passed','Bestanden'],['failed','Nicht bestanden'],['recognized','Anerkannt']] as const).map(([value,label])=>({value,label}))}/></label>
        {moduleSemesterControl}<label>Note<input value={module.grade} onChange={e=>onUpdateModule({...module,grade:e.target.value})}/></label>
      </div>
      <div className="module-fast-colors">{colors.map(c=><button key={c} title={c} aria-label={'Modulfarbe '+c} className={module.color===c?'picked':''} style={{background:c}} onClick={()=>onUpdateModule({...module,color:c})}>{module.color===c&&<Check size={15}/>}</button>)}</div>
      <button className="module-fast-remove" onClick={onDeleteModule}><Trash2 size={16}/> Modul löschen</button>
    </div></ModuleOverlay>}

    {premium?
      <details className="module-fast-quick module-fast-quick-premium"
        onToggle={e=>{if(e.currentTarget.open)requestAnimationFrame(resizeQuickInput)}}>
        <summary><Sparkles size={17}/> Schnelleingabe <span className="module-quick-premium-label">uniflow+</span><ChevronDown size={16}/></summary>
        <div className="module-fast-quick-body">
          <textarea ref={quickInputRef} rows={1} aria-label="Moduldaten per Schnelleingabe erfassen" value={quickText}
            placeholder="Was möchtest du für dieses Modul eintragen?"
            maxLength={3500}
            onChange={e=>{previewRequest.current?.abort();previewRequest.current=null;setThinking(false);setQuickText(e.target.value);setPreview(null);setQuickError('')}}/>
          <button className="module-fast-preview-button" disabled={!quickText.trim()||thinking}
            onClick={()=>void generatePreview()}>{thinking?<><Sparkles size={16}/> Wird analysiert …</>:<><Sparkles size={16}/> Angaben erkennen</>}</button>
          {thinking&&<div className="module-quick-thinking" aria-live="polite" role="status">
            <span className="module-quick-thinking-symbol"><Sparkles size={23}/></span>
            <div><strong>Eingabe wird analysiert</strong><span>Termine, Prüfungen und Ausnahmen werden zugeordnet.</span></div>
            <span className="module-quick-thinking-track" aria-hidden="true"><i/></span>
          </div>}
          {quickError&&<p className="module-fast-warning" role="alert">{quickError}</p>}
          {!thinking&&preview&&<div className="module-fast-preview" role="region" aria-label="Vorschau Schnelleingabe">
            <h3>Vorschau</h3>
            {preview.topics.map((t,ti)=><div className="module-fast-ai-topic" key={ti}>
              <div className="module-fast-ai-topic-head">
                <label>Veranstaltung<input aria-label={'Veranstaltung '+(ti+1)} value={t.label}
                  maxLength={90} onChange={e=>updateQuickTopic(ti,{label:e.target.value,category:inferOfferingCategory(e.target.value)})}/></label>
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
                <div className="module-fast-ai-extras">
                  <div className="module-fast-ai-extra-fields">
                    <label>Lehrperson<input aria-label={t.label+' Lehrperson '+(si+1)} maxLength={120}
                      value={s.organizer||''} placeholder="Optional"
                      onChange={e=>updateQuickSlot(ti,si,{organizer:e.target.value})}/></label>
                    <label>Online-Link<input aria-label={t.label+' Online-Link '+(si+1)} maxLength={500}
                      type="url" placeholder="https://…" value={s.onlineLink||''}
                      onChange={e=>updateQuickSlot(ti,si,{onlineLink:e.target.value})}/></label>
                    <label>Wiederholung<select aria-label={t.label+' Wiederholung '+(si+1)}
                      value={s.recurrence||'weekly'} onChange={e=>updateQuickSlot(ti,si,{
                        recurrence:e.target.value as Repeat,
                        endDate:e.target.value==='once'?'':s.endDate
                      })}>
                      <option value="weekly">Wöchentlich</option>
                      <option value="biweekly">Alle 2 Wochen</option>
                      <option value="once">Einmalig</option>
                    </select></label>
                    <label>{s.recurrence==='once'?'Datum *':'Ab (optional)'}
                      <input aria-label={t.label+' Datum '+(si+1)} type="date"
                        min={semester.start} max={semester.end} value={s.date||''}
                        onChange={e=>updateQuickSlot(ti,si,{
                          date:e.target.value,
                          day:e.target.value?weekday(e.target.value):s.day
                        })}/></label>
                    {s.recurrence!=='once'&&<label>Bis (optional)<input type="date"
                      aria-label={t.label+' Bis '+(si+1)} min={s.date||semester.start} max={semester.end}
                      value={s.endDate||''} onChange={e=>updateQuickSlot(ti,si,{endDate:e.target.value})}/></label>}
                  </div>
                </div>
              </div>)}
            </div>)}
            {preview.assessments.length>0&&<div className="module-fast-ai-summary"><strong>Prüfungsbestandteile</strong>{preview.assessments.map((item,index)=><span key={index}>{item.type==='exam'?'Prüfung':'Hausaufgabe'} · {item.title}<small>{formatDate(item.date,{day:'numeric',month:'short',year:'numeric'})}</small></span>)}</div>}
            {preview.exceptions.length>0&&<div className="module-fast-ai-summary"><strong>Ausnahmen</strong>{preview.exceptions.map((item,index)=><span key={index}>{item.topicLabel}<small>{formatDate(item.date,{day:'numeric',month:'short'})} · {item.action==='cancel'?'Fällt aus':'Verschoben'}</small></span>)}</div>}
            {preview.errors.map((message,i)=><p className="module-fast-warning" key={i}>{message}</p>)}
            <div className="module-fast-preview-actions"><button onClick={()=>setPreview(null)}>Zurück</button>
              <button className="module-fast-preview-button" disabled={!preview.topics.length&&!preview.assessments.length&&!preview.exceptions.length}
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

    <div className="module-fast-section-head"><div><h2>Veranstaltungen <small>{groups.length}</small></h2></div><button type="button" className="module-event-add mlh-next-add" aria-label="Veranstaltung hinzufügen" onClick={openEventCreator}><Plus size={19}/></button></div>
    <div className="module-event-list">{groups.map(group=>{
      const first=group.offerings[0],planned=group.offerings.find(item=>item.selected)||first
      const active=!!occurrenceAtOrigin(planned,planned.date,false)
      return <button type="button" className="module-event-row" key={group.id} onClick={()=>{setEditingSlotId(null);setGroupEditorId(group.id)}}>
        <span className={'module-fast-dot '+(active?'active':'')}/><span className="module-event-row-copy"><strong>{first.contentLabel||first.category}</strong><small>{dayNames[weekday(planned.date)]} · {planned.from}–{planned.to}{planned.room?' · '+planned.room:''}{planned.organizer?' · '+planned.organizer:''}</small></span>
        {(first.importance||'normal')==='high'&&<i className="module-event-priority" role="img" aria-label="Hohe Wichtigkeit"/>}<span className="module-event-count">{group.offerings.length} {group.offerings.length===1?'Termin':'Termine'}</span>
      </button>
    })}</div>
    {!groups.length&&<div className="module-topic-empty">Noch keine Veranstaltungen. Du kannst eine Veranstaltung anlegen oder die Schnelleingabe verwenden.</div>}
    {deleted.length>0&&<div className="module-fast-undo">Gelöscht: {deleted.length} {deleted.length===1?'Gruppe':'Gruppen'} <button onClick={undoDelete}><RotateCcw size={15}/> Rückgängig</button></div>}
    <button type="button" className="module-event-row module-exception-row" onClick={()=>setExceptionsOpen(true)}><span className="module-exception-symbol" aria-hidden="true">↗</span><span className="module-event-row-copy"><strong>Zukünftige Ausnahmen</strong><small>Verschobene oder ausfallende Termine</small></span><span className="module-event-count">{futureExceptions.length}</span></button>

    {eventDraft&&<ModuleOverlay title={eventDraft.linkedGroupId?'Alternativtermin':'Neue Veranstaltung'} accent={module.color} onClose={()=>{setEventDraft(null);setWarning('')}}><div className="module-event-create-form">
      <div className="editor-field module-event-name-field"><span className="field-label">Name</span>{eventDraft.linkedGroupId?<div className="module-event-name-lock"><span><strong>{eventDraft.name}</strong><small>Alternative zur bestehenden Veranstaltung</small></span><button type="button" aria-label="Verknüpfung entfernen" onClick={()=>setEventDraft(current=>current?{...current,name:'',linkedGroupId:'',importance:'normal'}:current)}><X size={16}/></button></div>:<><input autoFocus className="line-input" value={eventDraft.name} placeholder="z. B. Vorlesung 1" onChange={event=>changeEventName(event.target.value)}/>{eventNameSuggestions.length>0&&<div className="module-event-name-suggestions" role="listbox" aria-label="Passende Veranstaltungen">{eventNameSuggestions.map(group=>{const item=group.offerings[0];return <button type="button" role="option" aria-selected="false" key={group.id} onClick={()=>linkEventGroup(group.id)}><strong>{item.contentLabel||item.category}</strong><span>Alternative hinzufügen</span></button>})}</div>}</>}</div>
      <div className="uf-entry-grid"><div className="uf-entry-field"><span className="field-label">Wochentag</span><UniflowPicker label="Wochentag" value={String(eventDraft.day)} options={dayNames.map((label,index)=>({value:String(index),label}))} onChange={value=>changeEventDay(Number(value))}/></div><div className="uf-entry-field"><span className="field-label">Beginn</span><UniflowPicker kind="time" label="Beginn" value={eventDraft.from} onChange={from=>setEventDraft(current=>current?{...current,from}:current)}/></div><div className="uf-entry-field"><span className="field-label">Ende</span><UniflowPicker kind="time" label="Ende" value={eventDraft.to} onChange={to=>setEventDraft(current=>current?{...current,to}:current)}/></div></div>
      <div className="editor-field"><span className="field-label">Raum <span className="optional">optional</span></span><input className="line-input" placeholder="z. B. MA 041" value={eventDraft.room} onChange={event=>setEventDraft(current=>current?{...current,room:event.target.value}:current)}/></div>
      <details className="module-event-advanced" open={eventDraft.advanced} onToggle={event=>setEventDraft(current=>current?{...current,advanced:event.currentTarget.open}:current)}><summary><span>Weitere Angaben</span><ChevronDown size={17}/></summary><div className="module-event-advanced-body">
        <div className="editor-field"><span className="field-label">Wichtigkeit für den Lernplan</span><div className="module-event-importance" role="group" aria-label="Wichtigkeit">{([{value:'low',label:'Niedrig'},{value:'normal',label:'Normal'},{value:'high',label:'Hoch'}] as const).map(option=><button type="button" className={eventDraft.importance===option.value?'selected':''} aria-pressed={eventDraft.importance===option.value} key={option.value} onClick={()=>setEventDraft(current=>current?{...current,importance:option.value}:current)}>{option.label}</button>)}</div></div>
        <div className="editor-field"><span className="field-label">Wiederholung</span><UniflowPicker label="Wiederholung" value={eventDraft.recurrence} options={[{value:'weekly',label:'Wöchentlich'},{value:'biweekly',label:'Alle 2 Wochen'},{value:'once',label:'Einmalig'}]} onChange={value=>setEventDraft(current=>current?{...current,recurrence:value as Repeat,endDate:value==='once'?current.date:current.endDate<current.date?semester.lectureEnd:current.endDate}:current)}/></div>
        {eventDraft.recurrence==='once'?<div className="editor-field"><span className="field-label">Datum</span><UniflowPicker kind="date" label="Datum" min={semester.start} max={semester.end} value={eventDraft.date} onChange={date=>setEventDraft(current=>current?{...current,date,endDate:date,day:weekday(date)}:current)}/></div>:<div className="uf-entry-grid"><div className="uf-entry-field"><span className="field-label">Ab</span><UniflowPicker kind="date" label="Ab" min={semester.start} max={eventDraft.endDate} value={eventDraft.date} onChange={date=>setEventDraft(current=>current?{...current,date,day:weekday(date)}:current)}/></div><div className="uf-entry-field"><span className="field-label">Bis</span><UniflowPicker kind="date" label="Bis" min={eventDraft.date} max={semester.end} value={eventDraft.endDate} onChange={endDate=>setEventDraft(current=>current?{...current,endDate}:current)}/></div></div>}
        <div className="editor-field"><span className="field-label">Lehrperson <span className="optional">optional</span></span><input className="line-input" value={eventDraft.organizer} onChange={event=>setEventDraft(current=>current?{...current,organizer:event.target.value}:current)}/></div><div className="editor-field"><span className="field-label">Online-Link <span className="optional">optional</span></span><input className="line-input" type="url" inputMode="url" placeholder="https://…" value={eventDraft.onlineLink} onChange={event=>setEventDraft(current=>current?{...current,onlineLink:event.target.value}:current)}/></div>
      </div></details>{warning&&<p className="module-fast-warning" role="alert">{warning}</p>}<button type="button" className="primary-action module-event-save" onClick={saveEventDraft}>{eventDraft.linkedGroupId?'Alternative speichern':'Veranstaltung speichern'}<Check size={17}/></button>
    </div></ModuleOverlay>}

    {editingGroup&&<ModuleOverlay title={editingOffering?'Termin bearbeiten':editingGroup.offerings[0].contentLabel||editingGroup.offerings[0].category} accent={module.color} onClose={()=>{setEditingSlotId(null);setGroupEditorId('');setWarning('')}}>{editingOffering?<div className="module-event-edit-form uf-entry-form">
      <button type="button" className="module-event-sheet-back" onClick={()=>setEditingSlotId(null)}><ArrowLeft size={16}/> Alle Termine</button>
      <div className="editor-field"><span className="field-label">{editingOffering.recurrence==='once'?'Datum':'Wochentag'}</span>{editingOffering.recurrence==='once'?<UniflowPicker kind="date" label="Datum" min={semester.start} max={semester.end} value={editingOffering.date} onChange={value=>{if(value>=semester.start&&value<=semester.end)update(editingOffering.id,{date:value,endDate:value})}}/>:<UniflowPicker label="Wochentag" value={String(weekday(editingOffering.date))} onChange={value=>setDay(editingOffering,Number(value))} options={dayNames.map((label,index)=>({value:String(index),label:label+'s'}))}/>}</div>
      <div className="uf-entry-grid"><div className="uf-entry-field"><span className="field-label">Beginn</span><UniflowPicker kind="time" label="Beginn" value={editingOffering.from} maxMinutes={1440-durationOf(editingOffering)} onChange={value=>setClock(editingOffering,value)}/></div><div className="uf-entry-field"><span className="field-label">Ende</span><UniflowPicker kind="time" label="Ende" value={editingOffering.to} onChange={value=>setEnd(editingOffering,value)}/></div></div>
      <details className="module-event-advanced"><summary><span>Weitere Angaben</span><ChevronDown size={17}/></summary><div className="module-event-advanced-body"><div className="uf-entry-grid"><div className="uf-entry-field"><span className="field-label">Wiederholung</span><UniflowPicker label="Wiederholung" value={editingOffering.recurrence} options={[{value:'weekly',label:'Wöchentlich'},{value:'biweekly',label:'Alle 2 Wochen'},{value:'once',label:'Einmalig'}]} onChange={value=>update(editingOffering.id,{recurrence:value as Repeat,endDate:value==='once'?editingOffering.date:editingOffering.recurrence==='once'?semester.lectureEnd:editingOffering.endDate<editingOffering.date?semester.lectureEnd:editingOffering.endDate})}/></div>{editingOffering.recurrence!=='once'&&<div className="uf-entry-field"><span className="field-label">Ab</span><UniflowPicker kind="date" label="Ab" min={semester.start} max={editingOffering.endDate} value={editingOffering.date} onChange={value=>setSeriesStart(editingOffering,value)}/></div>}</div>{editingOffering.recurrence!=='once'&&<div className="editor-field"><span className="field-label">Bis</span><UniflowPicker kind="date" label="Bis" min={editingOffering.date} max={semester.end} value={editingOffering.endDate} onChange={value=>{if(value>=editingOffering.date&&value<=semester.end)update(editingOffering.id,{endDate:value})}}/></div>}<div className="editor-field"><span className="field-label">Raum <span className="optional">optional</span></span><input className="line-input" value={editingOffering.room} onChange={event=>update(editingOffering.id,{room:event.target.value})}/></div><div className="editor-field"><span className="field-label">Online-Link <span className="optional">optional</span></span><input className="line-input" type="url" inputMode="url" value={editingOffering.onlineLink||''} onChange={event=>update(editingOffering.id,{onlineLink:event.target.value})}/></div><div className="editor-field"><span className="field-label">Lehrperson <span className="optional">optional</span></span><input className="line-input" value={editingOffering.organizer||''} onChange={event=>update(editingOffering.id,{organizer:event.target.value})}/></div></div></details>
      <button type="button" className="danger-simple" onClick={()=>{const last=editingGroup.offerings.length===1;remove([editingOffering]);setEditingSlotId(null);if(last)setGroupEditorId('')}}><Trash2 size={17}/> Termin löschen</button>{warning&&<p className="module-fast-warning" role="alert">{warning}</p>}<button type="button" className="primary-action module-event-save" onClick={()=>setEditingSlotId(null)}>Fertig <Check size={17}/></button>
    </div>:<div className="module-event-group-form"><div className="editor-field"><span className="field-label">Name</span><input autoFocus className="line-input" value={editingGroup.offerings[0].contentLabel||editingGroup.offerings[0].category} onChange={event=>renameTopic(editingGroup.offerings,event.target.value)}/></div><div className="module-event-term-list">{editingGroup.offerings.map(item=>{const active=!!occurrenceAtOrigin(item,item.date,false);return <button type="button" key={item.id} onClick={()=>setEditingSlotId(item.id)}><span className={'module-fast-dot '+(active?'active':'')}/><span><strong>{dayNames[weekday(item.date)]} · {item.from}–{item.to}</strong><small>{item.room||offeringSentence(item)}{item.organizer?' · '+item.organizer:''}</small></span>{editingGroup.offerings.length>1&&<em>{active?'Im Plan':'Nicht im Plan'}</em>}</button>})}</div>
      <details className="module-event-advanced"><summary><span>Weitere Angaben</span><ChevronDown size={17}/></summary><div className="module-event-advanced-body"><div className="editor-field"><span className="field-label">Wichtigkeit für den Lernplan</span><div className="module-event-importance" role="group" aria-label="Wichtigkeit für den Lernplan">{([{value:'low',label:'Niedrig'},{value:'normal',label:'Normal'},{value:'high',label:'Hoch'}] as const).map(option=><button type="button" className={(editingGroup.offerings[0].importance||'normal')===option.value?'selected':''} aria-pressed={(editingGroup.offerings[0].importance||'normal')===option.value} key={option.value} onClick={()=>setTopicImportance(editingGroup.offerings,option.value)}>{option.label}</button>)}</div></div></div></details>
      <button type="button" className="danger-simple" onClick={()=>{remove(editingGroup.offerings);setGroupEditorId('')}}><Trash2 size={17}/> Veranstaltung löschen</button><button type="button" className="primary-action module-event-save" onClick={()=>setGroupEditorId('')}>Fertig <Check size={17}/></button></div>}</ModuleOverlay>}

    {exceptionsOpen&&<ModuleOverlay title="Zukünftige Ausnahmen" accent={module.color} onClose={()=>{setExceptionsOpen(false);setExceptionEditor(false);setWarning('')}}><div className="module-exception-popup"><button type="button" className="module-fast-add-exception" onClick={openExceptionEditor}><Plus size={16}/> Ausnahme hinzufügen</button>{exceptionEditor&&<div className="module-exception-editor"><label>Veranstaltung<UniflowPicker label="Veranstaltung" value={exceptionOfferingId} options={own.map(item=>({value:item.id,label:`${item.contentLabel||item.category} · ${dayNames[weekday(item.date)]} ${item.from}`}))} onChange={value=>{setExceptionOfferingId(value);const item=own.find(entry=>entry.id===value);if(item){setExceptionOrigin(item.date);setExceptionDate(item.date);setExceptionFrom(item.from);setExceptionTo(item.to)}}}/></label><label>Ursprüngliches Datum<UniflowPicker kind="date" label="Ursprüngliches Datum" min={semester.start} max={semester.end} value={exceptionOrigin} onChange={setExceptionOrigin}/></label><label>Änderung<UniflowPicker label="Änderung" value={exceptionKind} options={[{value:'move',label:'Verschieben'},{value:'cancel',label:'Fällt ohne Ersatz aus'}]} onChange={value=>setExceptionKind(value as 'move'|'cancel')}/></label>{exceptionKind==='move'&&<><label>Neues Datum<UniflowPicker kind="date" label="Neues Datum" min={semester.start} max={semester.end} value={exceptionDate} onChange={setExceptionDate}/></label><label>Beginn<UniflowPicker kind="time" label="Beginn" value={exceptionFrom} onChange={setExceptionFrom}/></label><label>Ende<UniflowPicker kind="time" label="Ende" value={exceptionTo} onChange={setExceptionTo}/></label></>}<div className="module-exception-actions"><button type="button" onClick={()=>setExceptionEditor(false)}>Abbrechen</button><button type="button" className="primary" onClick={saveException}>Übernehmen</button></div></div>}{futureExceptions.length===0&&!exceptionEditor?<p className="module-popup-empty">Keine zukünftigen Ausnahmen.</p>:futureExceptions.map(({o,origin,value})=><div className="module-fast-exception" key={o.id+origin}><span>{formatDate(origin)} · {o.contentLabel||o.category}<small>{value.cancelled?'Fällt aus':value.reason==='move'?'Verschoben':value.selected?'Einmalig besuchen':'Einmalig nicht besuchen'}</small></span>{!value.cancelled&&<button type="button" onClick={()=>{const occ=occurrenceAtOrigin(o,origin,true,true);if(occ){setExceptionsOpen(false);onOpenOccurrence(occ)}}}>Ansehen</button>}<button type="button" onClick={()=>onClearException(o.id,origin)}>Zurücksetzen</button></div>)}{warning&&<p className="module-fast-warning" role="alert">{warning}</p>}</div></ModuleOverlay>}
  </div>
}
