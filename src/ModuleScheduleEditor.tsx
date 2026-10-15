import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { ArrowLeft, BookOpen, Check, ChevronDown, ClipboardList, Copy, GraduationCap, Lock, Pencil, Plus, RotateCcw, Sparkles, Trash2 } from 'lucide-react'
import {
  addDays, assessmentComponentKey, candidateOccurrencesOn, colors, contentGroups, formatDate, fromDate,
  intersects, isAssessment, minutes, occurrenceAtOrigin, timeString, today, uid,
  rebalanceAssessmentWeights, selectedAssessment, upsertAssessment, weekday, weekStart,
  type Assessment, type Offering, type Repeat, type Semester, type StudyModule, type Occurrence
} from './model'
import type { Journey, LearningCheckin, LearningRating, LearningSession, LessonTopic } from './learning'
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
const ratingLabels:Record<LearningRating,string>={
  understood:'Verstanden',partial:'Teilweise',struggling:'Nicht verstanden',absent:'Nicht besucht'
}
const offeringSentence=(offering:Offering)=>{
  const date=formatDate(offering.date,{day:'numeric',month:'short',year:'numeric'})
  if(offering.recurrence==='once')return `Einmalig am ${date} · ${offering.from}–${offering.to}`
  const rhythm=offering.recurrence==='biweekly'?'Alle 2 Wochen':'Wöchentlich'
  return `${rhythm} ab ${date} · jeden ${dayNames[weekday(offering.date)]} um ${offering.from}–${offering.to}`
}
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
  return {topics,assessments:[],exceptions:[],errors}
}
type Props = {
  module:StudyModule;semester?:Semester;offerings:Offering[];assessments:Assessment[];journey?:Journey;premium:boolean;
  onBack:()=>void;onUpdateModule:(next:StudyModule)=>void;onDeleteModule:()=>void;
  onChangeOfferings:(next:Offering[])=>void;
  onChangeAssessments:(next:Assessment[])=>void;
  onEditAssessment:(item:Assessment)=>void;
  onAddAssessment:(type:'exam'|'homework')=>void;
  onOpenOccurrence:(occ:Occurrence)=>void;
  onClearException:(offeringId:string,origin:string)=>void;
  learningSessions:LearningSession[];learningCheckins:LearningCheckin[];lessonTopics:LessonTopic[];
  onChangeLearningSessions:(next:LearningSession[])=>void;
  onChangeLearningCheckins:(next:LearningCheckin[])=>void;
  onChangeLessonTopics:(next:LessonTopic[])=>void;
  cloudStatus:'loading'|'saving'|'synced'|'error';cloudError:string;onRetrySync:()=>void;
}
export default function ModuleScheduleEditor({
  module,semester,offerings,assessments,journey,premium,onBack,onUpdateModule,onDeleteModule,
  onChangeOfferings,onChangeAssessments,onEditAssessment,onAddAssessment,onOpenOccurrence,onClearException,
  learningSessions,learningCheckins,lessonTopics,onChangeLearningSessions,onChangeLearningCheckins,onChangeLessonTopics,
  cloudStatus,cloudError,onRetrySync
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
  const [expandedTopics,setExpandedTopics]=useState<Record<string,boolean>>({})
  const [editingSlotId,setEditingSlotId]=useState<string|null>(null)
  const [editingLearningId,setEditingLearningId]=useState<string|null>(null)
  const [deleted,setDeleted]=useState<Offering[]>([])
  const [warning,setWarning]=useState('')
  const [thinking,setThinking]=useState(false)
  const [quickError,setQuickError]=useState('')
  useEffect(()=>{
    if(!editingSlotId&&!editingLearningId&&!exceptionEditor&&!preview)return
    const onBack=(event:Event)=>{
      const detail=(event as CustomEvent<{handled:boolean}>).detail
      if(detail?.handled)return
      detail.handled=true
      if(preview)setPreview(null)
      else if(exceptionEditor)setExceptionEditor(false)
      else if(editingLearningId)setEditingLearningId(null)
      else setEditingSlotId(null)
    }
    window.addEventListener('uniflow-back',onBack)
    return()=>window.removeEventListener('uniflow-back',onBack)
  },[editingLearningId,editingSlotId,exceptionEditor,preview])
  const previewRequest=useRef<AbortController|null>(null)
  useEffect(()=>()=>{previewRequest.current?.abort()},[])
  const imported=useRef(false)
  const own=useMemo(()=>offerings.filter(o=>
    o.moduleId===module.id&&o.semesterId===semester?.id&&!isAssessment(o.category)
  ),[offerings,module.id,semester?.id])
  const groups=useMemo(()=>contentGroups(own,module.id,semester?.id||''),[own,module.id,semester?.id])
  const ownAssessments=useMemo(()=>assessments.filter(item=>item.moduleId===module.id&&item.semesterId===semester?.id),[assessments,module.id,semester?.id])
  const assessmentGroups=useMemo(()=>{
    const result=new Map<string,Assessment[]>()
    for(const item of ownAssessments){const key=assessmentComponentKey(item);result.set(key,[...(result.get(key)||[]),item])}
    return [...result.entries()].map(([key,items])=>({key,items:items.sort((a,b)=>a.date.localeCompare(b.date)||a.id.localeCompare(b.id))}))
  },[ownAssessments])
  const learningHistory=useMemo(()=>{
    const lessons=new Map((journey?.lessons||[]).map(lesson=>[lesson.key,lesson]))
    const topics=new Map(lessonTopics.filter(topic=>topic.moduleId===module.id).map(topic=>[topic.key,topic.title]))
    const sessions=learningSessions.filter(item=>item.moduleId===module.id).map(item=>({
      id:'session:'+item.id,date:item.date,kind:'session' as const,item,
      title:item.kind==='exam'?'Klausurvorbereitung':item.lessonKey?'Veranstaltung wiederholt':'Freies Lernen',
      subtitle:`${item.duration} Min. · ${ratingLabels[item.rating]}`
    }))
    const checkins=learningCheckins.filter(item=>item.moduleId===module.id&&item.rating!=='absent').map(item=>{
      const lesson=lessons.get(item.key)
      return {id:'checkin:'+item.key,date:item.date,kind:'checkin' as const,item,
        title:topics.get(item.key)||lesson?.label||'Besuchte Veranstaltung',
        subtitle:`${lesson?lesson.from+'–'+lesson.to+' · ':''}${ratingLabels[item.rating]}`}
    })
    return [...sessions,...checkins].sort((a,b)=>b.date.localeCompare(a.date)||b.id.localeCompare(a.id))
  },[journey?.lessons,learningCheckins,learningSessions,lessonTopics,module.id])
  if(!semester)return <div className="screen secondary-screen"><button className="text-back" onClick={onBack}>← Module</button><p>Bitte zuerst ein Semester auswählen.</p></div>

  const commit=(next:Offering[])=>{setWarning('');onChangeOfferings(next)}
  const update=(id:string,changes:Partial<Offering>)=>
    commit(own.map(o=>o.id===id?{...o,...changes}:o))
  const newOffering=(contentId:string,label:string,category:string,slot:Slot,selected=false):Offering=>{
    const date=slot.date||initialDate(semester,slot.day)
    const recurrence=slot.recurrence||'weekly'
    const id=uid()
    return {
      id,semesterId:semester.id,moduleId:module.id,name:module.name,category,
      contentId,contentLabel:label,date,
      endDate:recurrence==='once'?date:slot.endDate||(semester.lectureEnd>=date?semester.lectureEnd:date),
      from:slot.from,to:timeString(minutes(slot.from)+slot.duration),
      recurrence,overrides:{},scheduleChanges:[],
      room:slot.room,onlineLink:slot.onlineLink||'',organizer:slot.organizer||'',selected
    }
  }
  const collides=(candidate:Offering,others:Offering[])=>{
    for(let date=candidate.date,i=0;i<150&&date<=candidate.endDate;i++,date=addDays(date,7)){
      if(!candidateOccurrencesOn([candidate],date,true).length)continue
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
    setEditingSlotId(fresh.id)
    commit([...own,fresh])
  }
  const cloneAlternative=(original:Offering)=>{
    const fresh={...original,id:uid(),overrides:{},scheduleChanges:[],selected:false}
    setEditingSlotId(fresh.id)
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
    commit(own.map(o=>items.some(x=>x.id===o.id)?{...o,contentLabel:label}:o))
  const recategorize=(items:Offering[],category:string)=>
    commit(own.map(o=>items.some(x=>x.id===o.id)?{...o,category}:o))
  const changeAssessmentWeight=(key:string,value:number)=>onChangeAssessments(rebalanceAssessmentWeights(assessments,module.id,key,value))
  const selectAttempt=(key:string,id:string)=>onChangeAssessments(assessments.map(item=>assessmentComponentKey(item)===key?{...item,selected:item.id===id}:item))
  const toggleHomework=(id:string)=>onChangeAssessments(assessments.map(item=>item.id===id?{...item,completed:!item.completed}:item))
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

  return <div className="screen secondary-screen module-detail-screen module-fast">
    <button className="text-back" onClick={onBack}><ArrowLeft size={18}/> Alle Module</button>
    <div className="module-detail-heading">
      <span className="module-emoji" style={{background:module.color}}>{module.emoji||<BookOpen size={20}/>}</span>
      <div><span className="overline">MODUL</span><h1>{module.name}</h1><p>{module.credits} LP · {module.shortName}</p></div>
    </div>
    {journey&&journey.total>0&&<div className="module-fast-journey">
      <div className="module-fast-journey-head"><strong>{journey.status}</strong><span>{journey.rated}/{journey.total} bewertet</span></div>
      <p>{journey.message}</p>
      <div className="module-fast-journey-stats"><span>Verständnis <b>{journey.understanding===null?'—':journey.understanding+' %'}</b></span><span>Wiederholung <b>{journey.repetition} %</b></span><span>Prüfungstraining <b>{journey.training} %</b></span></div>
    </div>}
    <section className="module-learning-history">
      <div className="module-fast-section-head"><div><span className="overline">DEINE LERNEINHEITEN</span><h2>Lernverlauf <small>{learningHistory.length}</small></h2></div></div>
      {!learningHistory.length&&<p className="module-learning-empty">Noch keine bewerteten Veranstaltungen oder Lerneinheiten.</p>}
      <div className="module-learning-list">{learningHistory.map(entry=>{
        const editing=editingLearningId===entry.id
        return <div className={'module-learning-row '+(editing?'is-editing':'')} key={entry.id}>
          <button type="button" className="module-learning-preview" aria-expanded={editing} onClick={()=>setEditingLearningId(editing?null:entry.id)}>
            <span><strong>{entry.title}</strong><small>{formatDate(entry.date,{day:'numeric',month:'short',year:'numeric'})} · {entry.subtitle}</small></span>
            <Pencil size={15}/>
          </button>
          {editing&&entry.kind==='session'&&<div className="module-learning-editor">
            <label>Datum<UniflowPicker kind="date" label="Datum" value={entry.item.date} onChange={value=>onChangeLearningSessions(learningSessions.map(item=>item.id===entry.item.id?{...item,date:value,updatedAt:new Date().toISOString()}:item))}/></label>
            <label>Art<UniflowPicker label="Lernart" value={entry.item.kind} options={[{value:'review',label:'Freies Lernen'},{value:'exam',label:'Klausurvorbereitung'}]} onChange={value=>onChangeLearningSessions(learningSessions.map(item=>item.id===entry.item.id?{...item,kind:value as LearningSession['kind'],updatedAt:new Date().toISOString()}:item))}/></label>
            <label>Dauer<UniflowPicker kind="duration" label="Dauer" value={String(entry.item.duration)} maxMinutes={360} onChange={value=>onChangeLearningSessions(learningSessions.map(item=>item.id===entry.item.id?{...item,duration:Number(value),updatedAt:new Date().toISOString()}:item))}/></label>
            <label>Bewertung<UniflowPicker label="Bewertung" value={entry.item.rating} options={Object.entries(ratingLabels).filter(([value])=>value!=='absent').map(([value,label])=>({value,label}))} onChange={value=>onChangeLearningSessions(learningSessions.map(item=>item.id===entry.item.id?{...item,rating:value as LearningSession['rating'],updatedAt:new Date().toISOString()}:item))}/></label>
            <button type="button" className="module-learning-delete" onClick={()=>{onChangeLearningSessions(learningSessions.filter(item=>item.id!==entry.item.id));setEditingLearningId(null)}}><Trash2 size={15}/> Lerneinheit löschen</button>
          </div>}
          {editing&&entry.kind==='checkin'&&<div className="module-learning-editor">
            <label className="module-learning-topic">Thema<input value={lessonTopics.find(topic=>topic.key===entry.item.key)?.title||entry.title} onChange={event=>onChangeLessonTopics([
              ...lessonTopics.filter(topic=>topic.key!==entry.item.key),
              {key:entry.item.key,moduleId:entry.item.moduleId,contentId:entry.item.contentId,date:entry.item.date,title:event.target.value.slice(0,100),updatedAt:new Date().toISOString()}
            ])}/></label>
            <label>Bewertung<UniflowPicker label="Bewertung" value={entry.item.rating} options={Object.entries(ratingLabels).filter(([value])=>value!=='absent').map(([value,label])=>({value,label}))} onChange={value=>onChangeLearningCheckins(learningCheckins.map(item=>item.key===entry.item.key?{...item,rating:value as LearningRating,updatedAt:new Date().toISOString()}:item))}/></label>
            <button type="button" className="module-learning-delete" onClick={()=>{onChangeLearningCheckins(learningCheckins.filter(item=>item.key!==entry.item.key));onChangeLessonTopics(lessonTopics.filter(topic=>topic.key!==entry.item.key));setEditingLearningId(null)}}><Trash2 size={15}/> Bewertung löschen</button>
          </div>}
        </div>
      })}</div>
    </section>
    <div className="module-fast-state" role="status">
      {cloudStatus==='error'?<><span>unicloud-Speicherung fehlgeschlagen · Eingaben bleiben lokal erhalten.</span><button onClick={onRetrySync}>Erneut synchronisieren</button><small>{cloudError}</small></>:
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
            {preview.assessments.length>0&&<div className="module-fast-ai-summary"><strong>Prüfungsbestandteile</strong>{preview.assessments.map((item,index)=><span key={index}>{item.type==='exam'?'Prüfung':'Hausaufgabe'} · {item.title}<small>{formatDate(item.date,{day:'numeric',month:'short',year:'numeric'})}{item.weight!==undefined?` · ${item.weight} %`:''}</small></span>)}</div>}
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

    <section className="module-assessments">
      <div className="module-fast-section-head"><div><span className="overline">DEINE PRÜFUNGSBESTANDTEILE</span><h2>Prüfungen & Hausaufgaben <small>{assessmentGroups.length}</small></h2></div><div className="module-assessment-add"><button onClick={()=>onAddAssessment('exam')}><GraduationCap size={16}/> Prüfung</button><button onClick={()=>onAddAssessment('homework')}><ClipboardList size={16}/> Aufgabe</button></div></div>
      {!assessmentGroups.length&&<div className="module-topic-empty">Noch keine Prüfungsbestandteile eingetragen.</div>}
      <div className="module-assessment-list">{assessmentGroups.map(({key,items})=>{
        const first=items[0],exam=first.type==='exam',selected=items.find(item=>selectedAssessment(item,assessments))||first
        return <article className="module-assessment-card" key={key}>
          <div className="module-assessment-head"><span className="module-assessment-icon">{exam?<GraduationCap size={17}/>:<ClipboardList size={17}/>}</span><button className="module-assessment-title" onClick={()=>onEditAssessment(selected)}><strong>{first.title}</strong><small>{exam?`${items.length} ${items.length===1?'Termin':'Alternativen'}`:first.completed?'Fertig':'Noch abzugeben'}</small></button><label className="module-assessment-weight"><span>Gewichtung</span><span><input className="plain-number-input" type="number" inputMode="decimal" min="0" max="100" step="0.1" value={first.weight??0} onChange={event=>changeAssessmentWeight(key,Number(event.target.value))}/><em>%</em></span></label></div>
          {exam?<div className="module-exam-attempts" role="radiogroup" aria-label={'Prüfungstermin für '+first.title}>{items.map((item,index)=><button type="button" role="radio" aria-checked={item.id===selected.id} className={item.id===selected.id?'selected':''} key={item.id} onClick={()=>selectAttempt(key,item.id)}><span>{index===0?'1. Termin':index===1?'2. Termin':`${index+1}. Termin`}</span><strong>{formatDate(item.date,{day:'numeric',month:'short',year:'numeric'})}</strong>{item.from&&<small>{item.from}{item.to?'–'+item.to:''} Uhr</small>}<i>{item.id===selected.id?<Check size={13}/>:null}</i></button>)}</div>
          :<button type="button" role="checkbox" aria-checked={!!first.completed} className={'module-homework-state '+(first.completed?'done':'')} onClick={()=>toggleHomework(first.id)}><span>{first.completed?<Check size={14}/>:null}</span>{first.completed?'Fertig – wieder öffnen':'Als fertig markieren'}<small>{formatDate(first.date,{day:'numeric',month:'short'})}</small></button>}
        </article>
      })}</div>
    </section>

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
            const editing=editingSlotId===o.id
            return <div className={'module-fast-slot '+(editing?'is-editing':'')} key={o.id}>
              <button type="button" className="module-fast-slot-preview" aria-expanded={editing} onClick={()=>setEditingSlotId(editing?null:o.id)}>
                <span className={'module-fast-dot '+(active?'active':'')}/>
                <span className="module-fast-slot-copy"><strong>{i===0?'Gruppe 1':'Alternative '+i}<em>{active?'Im Plan':'Alternative'}</em></strong><small>{offeringSentence(o)}</small>{(o.room||o.organizer)&&<small>{[o.room,o.organizer].filter(Boolean).join(' · ')}</small>}</span>
                <span className="module-fast-edit-label">{editing?'Schließen':'Bearbeiten'}</span>
              </button>
              {editing&&<div className="module-slot-edit-form uf-entry-form">
                <div className="editor-field"><span className="field-label">{o.recurrence==='once'?'Datum':'Wochentag'}</span>{o.recurrence==='once'
                  ?<UniflowPicker kind="date" label="Datum" min={semester.start} max={semester.end} value={o.date} onChange={value=>{if(value>=semester.start&&value<=semester.end)update(o.id,{date:value,endDate:value})}}/>
                  :<UniflowPicker label="Wochentag" value={String(weekday(o.date))} onChange={value=>setDay(o,Number(value))} options={dayNames.map((label,n)=>({value:String(n),label:label+'s'}))}/>}</div>
                <div className="uf-entry-grid"><div className="uf-entry-field"><span className="field-label">Beginn</span><UniflowPicker kind="time" label="Beginn" value={o.from} maxMinutes={1440-durationOf(o)} onChange={value=>setClock(o,value)}/></div><div className="uf-entry-field"><span className="field-label">Ende</span><UniflowPicker kind="time" label="Ende" value={o.to} onChange={value=>setEnd(o,value)}/></div></div>
                <div className="uf-entry-grid"><div className="uf-entry-field"><span className="field-label">Wiederholung</span><UniflowPicker label="Wiederholung" value={o.recurrence} options={[{value:'weekly',label:'Wöchentlich'},{value:'biweekly',label:'Alle 2 Wochen'},{value:'once',label:'Einmalig'}]} onChange={value=>update(o.id,{recurrence:value as Repeat,endDate:value==='once'?o.date:o.recurrence==='once'?semester.lectureEnd:o.endDate<o.date?semester.lectureEnd:o.endDate})}/></div>{o.recurrence!=='once'&&<div className="uf-entry-field"><span className="field-label">Ab</span><UniflowPicker kind="date" label="Ab" min={semester.start} max={o.endDate} value={o.date} onChange={value=>setSeriesStart(o,value)}/></div>}</div>
                {o.recurrence!=='once'&&<div className="editor-field"><span className="field-label">Bis</span><UniflowPicker kind="date" label="Bis" min={o.date} max={semester.end} value={o.endDate} onChange={value=>{if(value>=o.date&&value<=semester.end)update(o.id,{endDate:value})}}/></div>}
                <div className="editor-field"><span className="field-label">Raum <span className="optional">optional</span></span><input className="line-input" placeholder="z. B. MA 041" value={o.room} onChange={e=>update(o.id,{room:e.target.value})}/></div>
                <div className="editor-field"><span className="field-label">Online-Link <span className="optional">optional</span></span><input className="line-input" type="url" inputMode="url" placeholder="https://…" value={o.onlineLink||''} onChange={e=>update(o.id,{onlineLink:e.target.value})}/></div>
                <div className="editor-field"><span className="field-label">Lehrperson <span className="optional">optional</span></span><input className="line-input" value={o.organizer||''} onChange={e=>update(o.id,{organizer:e.target.value})}/></div>
                <div className="module-fast-slot-actions"><button type="button" onClick={()=>cloneAlternative(o)}><Copy size={16}/> Duplizieren</button><button type="button" className="danger" onClick={()=>remove([o])}><Trash2 size={16}/> Löschen</button></div>
              </div>}
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
      <summary><span>Zukünftige Ausnahmen · {futureExceptions.length}</span><ChevronDown size={17}/></summary>
      <button type="button" className="module-fast-add-exception" onClick={event=>{event.preventDefault();openExceptionEditor()}}><Plus size={16}/> Ausnahme hinzufügen</button>
      {exceptionEditor&&<div className="module-exception-editor">
        <label>Veranstaltung<UniflowPicker label="Veranstaltung" value={exceptionOfferingId} options={own.map(item=>({value:item.id,label:`${item.contentLabel||item.category} · ${dayNames[weekday(item.date)]} ${item.from}`}))} onChange={value=>{setExceptionOfferingId(value);const item=own.find(entry=>entry.id===value);if(item){setExceptionOrigin(item.date);setExceptionDate(item.date);setExceptionFrom(item.from);setExceptionTo(item.to)}}}/></label>
        <label>Ursprüngliches Datum<UniflowPicker kind="date" label="Ursprüngliches Datum" min={semester.start} max={semester.end} value={exceptionOrigin} onChange={setExceptionOrigin}/></label>
        <label>Änderung<UniflowPicker label="Änderung" value={exceptionKind} options={[{value:'move',label:'Verschieben'},{value:'cancel',label:'Fällt ohne Ersatz aus'}]} onChange={value=>setExceptionKind(value as 'move'|'cancel')}/></label>
        {exceptionKind==='move'&&<><label>Neues Datum<UniflowPicker kind="date" label="Neues Datum" min={semester.start} max={semester.end} value={exceptionDate} onChange={setExceptionDate}/></label><label>Beginn<UniflowPicker kind="time" label="Beginn" value={exceptionFrom} onChange={setExceptionFrom}/></label><label>Ende<UniflowPicker kind="time" label="Ende" value={exceptionTo} onChange={setExceptionTo}/></label></>}
        <div className="module-exception-actions"><button onClick={()=>setExceptionEditor(false)}>Abbrechen</button><button className="primary" onClick={saveException}>Übernehmen</button></div>
      </div>}
      {futureExceptions.length===0&&!exceptionEditor?<p>Keine zukünftigen Ausnahmen.</p>:futureExceptions.map(({o,origin,value})=>
        <div className="module-fast-exception" key={o.id+origin}><span>{formatDate(origin)} · {o.contentLabel||o.category}<small>{value.cancelled?'Fällt aus':value.reason==='move'?'Verschoben':value.selected?'Einmalig besuchen':'Einmalig nicht besuchen'}</small></span>
          {!value.cancelled&&<button onClick={()=>{const occ=occurrenceAtOrigin(o,origin,true,true);if(occ)onOpenOccurrence(occ)}}>Ansehen</button>}
          <button onClick={()=>onClearException(o.id,origin)}>Zurücksetzen</button>
        </div>)}
    </details>
  </div>
}
