import { useEffect, useMemo, useState, type CSSProperties } from 'react'
import { createPortal } from 'react-dom'
import { ArrowRight, CalendarClock, Check, ChevronRight, Clock3, GraduationCap, Plus, Sparkles, X } from 'lucide-react'
import {
  formatDate, fromDate, isAssessment, minutes, occurrencesOn, selectedAssessment, today,
  type AppData, type Semester, type StudyModule
} from './model'
import {
  pastLessons, pastFreeStudy, rankedJourneys,
  type LearningLesson, type LearningRating, type LearningSession, type LearningPlanTask
} from './learning'
import UniflowPicker from './UniflowPicker'
import LessonFeedback from './LessonFeedback'
import { localAdvice, type AdviceContext, type StudyAdvice } from './study-advice'
import { greetingForHour } from './dashboard-greeting'
import './learning-dashboard.css'

type Props = {
  data: AppData
  semester?: Semester
  modules: StudyModule[]
  aiAdvice:StudyAdvice|null
  context:AdviceContext
  onTopic: (lesson:LearningLesson,title:string)=>void
  onCheckin: (lesson:LearningLesson,rating:LearningRating)=>void
  onSession: (session:Omit<LearningSession,'id'|'updatedAt'>)=>void
  onPlan: (task:LearningPlanTask)=>void
  onRemovePlan: (id:string)=>void
}
const ratingLabels:{value:LearningRating;label:string}[]=[
  {value:'understood',label:'Verstanden'},
  {value:'partial',label:'Teilweise'},
  {value:'struggling',label:'Nicht verstanden'},
  {value:'absent',label:'Nicht besucht'}
]
const shortDate=(iso:string)=>formatDate(iso,{day:'numeric',month:'short'})

export default function LearningDashboard({data,semester,modules,aiAdvice,context,onTopic,onCheckin,onSession,onPlan,onRemovePlan}:Props){
  const [studyOpen,setStudyOpen]=useState(false)
  const [moduleId,setModuleId]=useState('')
  const [lessonKey,setLessonKey]=useState('')
  const [kind,setKind]=useState<'review'|'exam'>('review')
  const [duration,setDuration]=useState(45)
  const [result,setResult]=useState<Exclude<LearningRating,'absent'>>('understood')
  const [showAll,setShowAll]=useState(false)
  const [activePlan,setActivePlan]=useState<string|undefined>()
  const [clockTick,setClockTick]=useState(0)
  useEffect(()=>{
    if(!studyOpen)return
    const onBack=(event:Event)=>{
      const detail=(event as CustomEvent<{handled:boolean}>).detail
      if(detail?.handled)return
      detail.handled=true
      setStudyOpen(false)
    }
    window.addEventListener('uniflow-back',onBack)
    return()=>window.removeEventListener('uniflow-back',onBack)
  },[studyOpen])
  useEffect(()=>{
    const timer=window.setInterval(()=>setClockTick(t=>t+1),5*60_000)
    const onVisible=()=>{if(document.visibilityState==='visible')setClockTick(t=>t+1)}
    document.addEventListener('visibilitychange',onVisible)
    return()=>{window.clearInterval(timer);document.removeEventListener('visibilitychange',onVisible)}
  },[])
  const localTip=useMemo(()=>localAdvice(context),[context])
  const suggestion=aiAdvice||localTip
  const isAiRecommendation=aiAdvice?.source==='deepseek'
  const allLessons=useMemo(()=>pastLessons(data,semester),[data.offerings,data.lessonTopics,semester])
  const journeys=useMemo(()=>rankedJourneys(data,modules,semester),[data,modules,semester])
  const active=modules.filter(m=>m.status==='current'||m.status==='failed'||m.status==='open')
  const checkins=new Map((data.learningCheckins||[]).map(c=>[c.key,c]))
  const pending=allLessons.filter(l=>!checkins.has(l.key))
  const planned=(data.learningPlans||[]).filter(t=>t.date===today())
  const completedPlans=new Set((data.learningSessions||[]).map(s=>s.planId).filter(Boolean))
  const freePending=pastFreeStudy(data,semester).filter(l=>!(data.learningSessions||[]).some(s=>s.scheduledKey===l.key))
  const nextCheckin=pending[0]
  const rankedModules=journeys.map(j=>({j,module:modules.find(m=>m.id===j.moduleId)!})).filter(x=>x.module)
  const focus=rankedModules[0]
  const chosenModule=active.find(m=>m.id===(moduleId||focus?.module.id)) || active[0]
  const options=allLessons.filter(l=>l.moduleId===chosenModule?.id)
  const completed=(data.learningSessions||[]).filter(s=>s.date===today()).length
  const firstName=data.profile.trim().split(/\s+/)[0]||''
  const next=useMemo<{date:string;from:string;to:string;name:string;room:string;moduleId:string}|null>(()=>{
    const now=new Date()
    let result:{date:string;from:string;to:string;name:string;room:string;moduleId:string}|null=null
    for(let date=today(),d=0;d<21;d++,date=addDaysLocal(date,1)){
      for(const item of occurrencesOn(data.offerings,date)){
        if(item.offering.semesterId!==semester?.id||isAssessment(item.offering.category)||item.offering.category==='Freies Lernen')continue
        if(date===today()&&minutes(item.from)<=now.getHours()*60+now.getMinutes())continue
        const candidate={date,from:item.from,to:item.to,name:item.offering.contentLabel||item.offering.name,room:item.offering.room,moduleId:item.offering.moduleId}
        if(!result||candidate.date<result.date||(candidate.date===result.date&&candidate.from<result.from))result=candidate
      }
      if(result)break
    }
    return result
  },[data.offerings,semester?.id,clockTick])
  const submitStudy=()=>{
    if(!chosenModule||!Number.isInteger(duration)||duration<5||duration>360)return
    onSession({moduleId:chosenModule.id,date:today(),duration,kind,rating:result,
      lessonKey:kind==='review'&&lessonKey?lessonKey:undefined,planId:activePlan})
    setStudyOpen(false)
    setActivePlan(undefined)
    setLessonKey('')
  }
  const beginStudy=(id?:string,key?:string,exam=false,planId?:string)=>{
    setActivePlan(planId)
    setModuleId(id||focus?.module.id||active[0]?.id||'')
    setLessonKey(key||'')
    setResult('understood')
    setKind(exam?'exam':'review')
    setDuration(45)
    setStudyOpen(true)
  }
  const recentExam=data.assessments.filter(a=>a.type==='exam'&&!a.completed&&a.date>=today()&&active.some(m=>m.id===a.moduleId)&&selectedAssessment(a,data.assessments))
    .sort((a,b)=>a.date.localeCompare(b.date))[0]
  const nextModule=modules.find(m=>m.id===next?.moduleId)
  const examModule=modules.find(m=>m.id===recentExam?.moduleId)
  const accent=(color?:string)=>({'--module-accent':color||'#9f9fa5'} as CSSProperties)
  return <div className="screen secondary-screen learn-dashboard">
    <div className="learn-heading">
      <span className="learn-heading-date">{formatDate(today(),{weekday:'long',day:'numeric',month:'long'}).toLocaleUpperCase('de-DE')}</span>
      <h1>{greetingForHour(new Date().getHours())}{firstName?', '+firstName:''}<span className="learn-heading-dot">.</span></h1>
    </div>
    <div className="learn-hero-grid">
      <section className={'learn-hero '+(nextModule?'learn-hero-subject':'')} style={accent(nextModule?.color)}>
        <span className="learn-eyebrow"><CalendarClock size={15}/> ALS NÄCHSTES</span>
        {next?<><strong>{nextModule?.name||next.name}</strong><p>{next.name!==nextModule?.name?next.name+' · ':''}{formatDate(next.date,{weekday:'short',day:'numeric',month:'short'})} · {next.from}–{next.to}{next.room?' · '+next.room:''}</p></>:
          <><strong>Alles im Blick.</strong><p>Aktuell keine weitere Veranstaltung gefunden.</p></>}
      </section>
      <section className={'learn-hero '+(examModule?'learn-hero-subject':'')} style={accent(examModule?.color)}>
        <span className="learn-eyebrow"><GraduationCap size={15}/> NÄCHSTE KLAUSUR</span>
        {recentExam?<><strong>{examModule?.name||recentExam.title}</strong><p>{shortDate(recentExam.date)} · in {Math.max(0,Math.round((fromDate(recentExam.date).getTime()-fromDate(today()).getTime())/86400000))} Tagen</p></>:
          <><strong>Keine Prüfung geplant</strong><p>Neue Prüfungen erscheinen automatisch hier.</p></>}
      </section>
    </div>
    <section className="learn-section learn-advice-section" aria-label="Aktuelle Empfehlung">
      <div className="learn-title"><h2>Dein nächster Schritt</h2><span className="learn-counter">Für dich</span></div>
      <div className={'learn-recommendation learn-recommendation-dynamic'+(isAiRecommendation?' learn-recommendation-ai':'')} style={accent(modules.find(m=>m.id===suggestion.moduleId)?.color)}>
        <span className="learn-eyebrow">{isAiRecommendation?<><Sparkles size={15}/> uniflow+</>:'PASSEND ZU DEINEM STUNDENPLAN'}</span>
        <h3>{suggestion.title}</h3>
        <p>{suggestion.message}</p>
        <div className="learn-recommendation-footer">
          <span>Aktuell anhand deiner Termine und Check-ins</span>
          {suggestion.moduleId&&suggestion.kind!=='checkin'&&
            <button onClick={()=>beginStudy(suggestion.moduleId,suggestion.kind==='review'?suggestion.lessonKey:undefined,suggestion.kind==='exam')}>
              Lernen erfassen <ArrowRight size={15}/>
            </button>}
          {suggestion.kind==='checkin'&&
            <button onClick={()=>document.querySelector('.learn-checkins')?.scrollIntoView({behavior:'smooth',block:'center'})}>
              Zum Check-in <ArrowRight size={15}/>
            </button>}
        </div>
      </div>

    </section><section className="learn-section">
      <div className="learn-title"><h2>Kurzer Check-in</h2><span className="learn-counter">{pending.length} offen</span></div>
      {!pending.length?<p className="learn-muted">Alle vergangenen Veranstaltungen sind bewertet. Sehr schön!</p>:
      <>
        <div className={'learn-checkins learn-checkins-stack'+(pending.length>1?' has-next':'')}
          aria-live="polite" aria-label="Nächster offener Check-in">
          {nextCheckin&&<div className="learn-checkin" key={nextCheckin.key}
            style={accent(modules.find(m=>m.id===nextCheckin.moduleId)?.color)}>
            <div className="learn-checkin-heading"><div>
              <strong>{modules.find(m=>m.id===nextCheckin.moduleId)?.name||'Modul'}</strong>
              <span>{nextCheckin.label} · {shortDate(nextCheckin.date)}</span>
            </div><span className="learn-eyebrow">Wie lief's?</span></div>
            <LessonFeedback lesson={nextCheckin} topic={(data.lessonTopics||[]).find(t=>t.key===nextCheckin.key)?.title||''}
              canRate rating={checkins.get(nextCheckin.key)?.rating} onTopic={onTopic} onRating={onCheckin} compact/>
          </div>}
        </div>
      </>}
    </section>
    {freePending.length>0&&<section className="learn-section">
      <div className="learn-title"><h2>Wie lief dein Lernen?</h2><span className="learn-counter">{freePending.length} offen</span></div>
      <div className="learn-checkins">{freePending.slice(0,showAll?freePending.length:3).map(l=><div className="learn-checkin" key={l.key} style={accent(modules.find(m=>m.id===l.moduleId)?.color)}>
        <div className="learn-checkin-heading"><div><strong>{modules.find(m=>m.id===l.moduleId)?.name||'Modul'}</strong><span>{l.label} · {shortDate(l.date)} · {l.from}–{l.to}</span></div><span className="learn-eyebrow">Wie lief's?</span></div>
        <div className="learn-rating-options">{ratingLabels.filter(r=>r.value!=='absent').map(r=><button className={'learn-rating learn-rating-'+r.value} key={r.value}
          onClick={()=>onSession({moduleId:l.moduleId,date:l.date,duration:Math.max(5,minutes(l.to)-minutes(l.from)),kind:'review',rating:r.value as Exclude<LearningRating,'absent'>,scheduledKey:l.key})}>{r.label}</button>)}</div>
      </div>)}</div>
      {freePending.length>3&&<button className="learn-text-action" onClick={()=>setShowAll(v=>!v)}>{showAll?'Weniger':'Weitere Lerneinheiten'} <ChevronRight size={15}/></button>}
    </section>}
    <section className="learn-section">
      <div className="learn-title"><h2>Lernplan</h2><button className="learn-primary" onClick={()=>beginStudy()} disabled={!active.length}><Plus size={16}/> Freies Lernen</button></div>
      {planned.length>0&&<div className="learn-planned">
        <div className="learn-planned-title">Für heute übernommen · {planned.filter(t=>completedPlans.has(t.id)).length} von {planned.length} erledigt</div>
        {planned.map(t=><div className="learn-planned-item" key={t.id} style={accent(modules.find(m=>m.id===t.moduleId)?.color)}>
          <span className="learn-planned-indicator">{completedPlans.has(t.id)?<Check size={17}/>:<Clock3 size={17}/>}</span>
          <div className="learn-planned-content"><strong>{t.title}</strong><small>{modules.find(m=>m.id===t.moduleId)?.name} · {t.duration} Minuten</small></div>
          {completedPlans.has(t.id)?<span className="learn-planned-done">Erledigt</span>:<>
            <button className="learn-planned-finish" onClick={()=>{beginStudy(t.moduleId,t.lessonKey,t.kind==='exam',t.id);setDuration(t.duration)}}>Fertig?</button>
            <button className="learn-planned-delete" aria-label="Lernziel entfernen" onClick={()=>onRemovePlan(t.id)}><X size={15}/></button>
          </>}
        </div>)}
      </div>}
      {rankedModules.length>0&&<div className="learn-suggestions">
        {rankedModules.slice(0,3).map(({module,j},index)=>{
          const target=j.weakLessons[0]
          const examFocus=j.daysUntilExam!==undefined&&j.daysUntilExam<=7&&!target
          return <div className="learn-suggestion" key={module.id} style={accent(module.color)}>
            <span className="learn-suggestion-num">{String(index+1).padStart(2,'0')}</span>
            <div><strong>{module.name}</strong><small>{target?'Wiederholen: '+target.label:examFocus?'Prüfungsaufgaben üben':'Wissen festigen'} · Vorschlag 45 Min.</small></div>
            <button aria-label={'Lernziel für '+module.name+' übernehmen'} title="Für heute einplanen" onClick={()=>onPlan({id:module.id+'-'+Date.now(),moduleId:module.id,date:today(),title:target?'Wiederholen: '+target.label:examFocus?'Prüfungsaufgaben üben':'Wissen festigen',kind:examFocus?'exam':'review',duration:45,lessonKey:target?.key})}><Plus size={17}/></button>
          </div>
        })}
      </div>}
      <div className="learn-today"><Clock3 size={17}/><span>Heute erfasste Lerneinheiten</span><strong>{completed}</strong></div>
    </section>
    {studyOpen&&createPortal(<div className="learn-backdrop" onClick={e=>{if(e.target===e.currentTarget)setStudyOpen(false)}}>
      <div className="learn-sheet" role="dialog" aria-modal="true" aria-label="Lerneinheit erfassen">
        <div className="learn-sheet-head"><div><h2>Freies Lernen</h2></div><button aria-label="Schließen" onClick={()=>setStudyOpen(false)}><X size={20}/></button></div>
        <label>Modul<UniflowPicker label="Modul" value={chosenModule?.id||''} onChange={value=>{setModuleId(value);setLessonKey('')}} options={active.map(m=>({value:m.id,label:m.name}))}/></label>
        <label>Was hast du gemacht?<UniflowPicker label="Lernart" value={kind} onChange={value=>setKind(value as 'review'|'exam')} options={[{value:'review',label:'Stoff wiederholt / gelernt'},{value:'exam',label:'Prüfungsaufgaben geübt'}]}/></label>
        {kind==='review'&&<label>Welche Veranstaltung? (optional)<UniflowPicker label="Veranstaltung" value={lessonKey} onChange={setLessonKey} options={[{value:'',label:'Allgemeines Lernen'},...options.map(l=>({value:l.key,label:l.label+' · '+shortDate(l.date)}))]}/></label>}
        <label>Dauer<UniflowPicker kind="duration" label="Lerndauer" value={String(duration)} maxMinutes={360} onChange={value=>setDuration(Number(value))}/></label>
        <span className="learn-field-title">Wie lief es?</span>
        <div className="learn-result-options">{ratingLabels.filter(r=>r.value!=='absent').map(r=><button key={r.value} className={result===r.value?'active':''} onClick={()=>setResult(r.value as typeof result)}>{r.label}</button>)}</div>
        <p className="learn-muted">Lernzeit allein bedeutet nicht, dass du den Stoff beherrschst. Deine Bewertung fließt in die Empfehlungen ein.</p>
        <button className="learn-submit" disabled={!chosenModule} onClick={submitStudy}>Lerneinheit speichern <Check size={17}/></button>
      </div>
    </div>,document.body)}
  </div>
}
function addDaysLocal(iso:string,n:number){
  const date=fromDate(iso);date.setDate(date.getDate()+n)
  return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`
}
