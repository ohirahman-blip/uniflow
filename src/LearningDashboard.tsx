import { useMemo, useState } from 'react'
import { ArrowRight, CalendarClock, Check, ChevronRight, Clock3, GraduationCap, Plus, Sparkles, X } from 'lucide-react'
import {
  formatDate, fromDate, isAssessment, minutes, occurrencesOn, today,
  type AppData, type Semester, type StudyModule
} from './model'
import {
  pastLessons, rankedJourneys,
  type LearningLesson, type LearningRating, type LearningSession
} from './learning'
import './learning-dashboard.css'

type Props = {
  data: AppData
  semester?: Semester
  modules: StudyModule[]
  onCheckin: (lesson:LearningLesson,rating:LearningRating)=>void
  onSession: (session:Omit<LearningSession,'id'|'updatedAt'>)=>void
  onOpenModule: (id:string)=>void
}
const ratingLabels:{value:LearningRating;label:string}[]=[
  {value:'understood',label:'Verstanden'},
  {value:'partial',label:'Teilweise'},
  {value:'struggling',label:'Nicht verstanden'},
  {value:'absent',label:'Nicht besucht'}
]
const shortDate=(iso:string)=>formatDate(iso,{day:'numeric',month:'short'})
const percent=(n:number|null)=>n===null?'—':n+' %'

export default function LearningDashboard({data,semester,modules,onCheckin,onSession,onOpenModule}:Props){
  const [studyOpen,setStudyOpen]=useState(false)
  const [moduleId,setModuleId]=useState('')
  const [lessonKey,setLessonKey]=useState('')
  const [kind,setKind]=useState<'review'|'exam'>('review')
  const [duration,setDuration]=useState(45)
  const [result,setResult]=useState<Exclude<LearningRating,'absent'>>('understood')
  const [showAll,setShowAll]=useState(false)
  const allLessons=useMemo(()=>pastLessons(data,semester),[data.offerings,semester])
  const journeys=useMemo(()=>rankedJourneys(data,modules,semester),[data,modules,semester])
  const active=modules.filter(m=>m.status==='current'||m.status==='failed'||m.status==='open')
  const checkins=new Map((data.learningCheckins||[]).map(c=>[c.key,c]))
  const pending=allLessons.filter(l=>!checkins.has(l.key))
  const recent=showAll?pending:pending.slice(0,3)
  const rankedModules=journeys.map(j=>({j,module:modules.find(m=>m.id===j.moduleId)!})).filter(x=>x.module)
  const focus=rankedModules[0]
  const chosenModule=active.find(m=>m.id===(moduleId||focus?.module.id)) || active[0]
  const options=allLessons.filter(l=>l.moduleId===chosenModule?.id)
  const completed=(data.learningSessions||[]).filter(s=>s.date===today()).length
  const next=useMemo(()=>{
    const now=new Date()
    let result:{date:string;from:string;to:string;name:string;room:string}|null=null
    for(let date=today(),d=0;d<21;d++,date=addDaysLocal(date,1)){
      for(const item of occurrencesOn(data.offerings,date)){
        if(item.offering.semesterId!==semester?.id||isAssessment(item.offering.category)||item.offering.category==='Freies Lernen')continue
        if(date===today()&&minutes(item.from)<=now.getHours()*60+now.getMinutes())continue
        const candidate={date,from:item.from,to:item.to,name:item.offering.contentLabel||item.offering.name,room:item.offering.room}
        if(!result||candidate.date<result.date||(candidate.date===result.date&&candidate.from<result.from))result=candidate
      }
      if(result)break
    }
    return result
  },[data.offerings,semester?.id])
  const submitStudy=()=>{
    if(!chosenModule||!Number.isInteger(duration)||duration<5||duration>360)return
    onSession({moduleId:chosenModule.id,date:today(),duration,kind,rating:result,
      lessonKey:kind==='review'&&lessonKey?lessonKey:undefined})
    setStudyOpen(false)
    setLessonKey('')
  }
  const beginStudy=(id?:string,key?:string)=>{
    setModuleId(id||focus?.module.id||active[0]?.id||'')
    setLessonKey(key||'')
    setResult('understood')
    setKind('review')
    setDuration(45)
    setStudyOpen(true)
  }
  const recentExam=data.assessments.filter(a=>a.type==='exam'&&!a.completed&&a.date>=today()&&active.some(m=>m.id===a.moduleId))
    .sort((a,b)=>a.date.localeCompare(b.date))[0]
  return <div className="screen secondary-screen learn-dashboard">
    <div className="learn-heading">
      <span className="overline">DEIN STUDIUM · {formatDate(today(),{weekday:'long',day:'numeric',month:'long'})}</span>
      <h1>Dein Tag<span className="learn-heading-dot">.</span></h1>
      <p>Alles Wichtige. Ohne zehn verschiedene Menüs.</p>
    </div>
    <div className="learn-hero-grid">
      <section className="learn-hero">
        <span className="learn-eyebrow"><CalendarClock size={15}/> ALS NÄCHSTES</span>
        {next?<><strong>{next.name}</strong><p>{formatDate(next.date,{weekday:'short',day:'numeric',month:'short'})} · {next.from}–{next.to}{next.room?' · '+next.room:''}</p></>:
          <><strong>Alles im Blick.</strong><p>Aktuell keine weitere Veranstaltung gefunden.</p></>}
      </section>
      <section className="learn-hero">
        <span className="learn-eyebrow"><GraduationCap size={15}/> NÄCHSTE KLAUSUR</span>
        {recentExam?<><strong>{modules.find(m=>m.id===recentExam.moduleId)?.name||recentExam.title}</strong><p>{shortDate(recentExam.date)} · in {Math.max(0,Math.round((fromDate(recentExam.date).getTime()-fromDate(today()).getTime())/86400000))} Tagen</p></>:
          <><strong>Keine Klausur geplant</strong><p>Neue Prüfungen erscheinen automatisch hier.</p></>}
      </section>
    </div>
    <section className="learn-section">
      <div className="learn-title"><div><span className="overline">NACH DEINEN VERANSTALTUNGEN</span><h2>Kurzer Check-in</h2></div><span className="learn-counter">{pending.length} offen</span></div>
      {!pending.length?<p className="learn-muted">Alle vergangenen Veranstaltungen sind bewertet. Sehr schön!</p>:
      <>
        <p className="learn-muted">Ein Tipp genügt. Alternative Vorlesungstermine zählen nicht doppelt.</p>
        <div className="learn-checkins">
          {recent.map(l=><div className="learn-checkin" key={l.key}>
            <div className="learn-checkin-heading"><div><strong>{modules.find(m=>m.id===l.moduleId)?.name||'Modul'}</strong><span>{l.label} · {shortDate(l.date)}</span></div><span className="learn-eyebrow">Wie lief's?</span></div>
            <div className="learn-rating-options">
              {ratingLabels.map((rating)=><button key={rating.value} className={'learn-rating learn-rating-'+rating.value} onClick={()=>onCheckin(l,rating.value)}>{rating.label}</button>)}
            </div>
          </div>)}
        </div>
        {pending.length>3&&<button className="learn-text-action" onClick={()=>setShowAll(v=>!v)}>{showAll?'Weniger anzeigen':`Alle ${pending.length} Check-ins anzeigen`} <ChevronRight size={15}/></button>}
      </>}
    </section>
    <section className="learn-section">
      <div className="learn-title"><div><span className="overline">DEINE EMPFEHLUNGEN</span><h2>Lernplan</h2></div><button className="learn-primary" onClick={()=>beginStudy()} disabled={!active.length}><Plus size={16}/> Freies Lernen</button></div>
      <p className="learn-muted">Nach Klausurtermin, Wissenslücken und Wiederholungsbedarf priorisiert. Vorschläge, keine automatisch eingetragenen Kalendertermine.</p>
      {focus?<div className="learn-recommendation">
        <span className="learn-eyebrow"><Sparkles size={15}/> HEUTE IM FOKUS</span>
        <h3>{focus.module.name}</h3>
        <p>{focus.j.daysUntilExam!==undefined&&focus.j.daysUntilExam<=7?
          'Die Klausur ist nah. Prüfe offene Inhalte und übe klausurähnliche Aufgaben.':
          focus.j.weakLessons.length?'Einige Inhalte benötigen noch eine Wiederholung.':'Halte dein Wissen mit kurzen Wiederholungen frisch.'}</p>
        <div className="learn-recommendation-footer"><span>{focus.j.daysUntilExam!==undefined?`Klausur in ${focus.j.daysUntilExam} Tagen`:focus.j.status}</span><button onClick={()=>beginStudy(focus.module.id,focus.j.weakLessons[0]?.key)}>Lernen erfassen <ArrowRight size={15}/></button></div>
      </div>:<p className="learn-muted">Füge ein aktuelles Modul hinzu, um Empfehlungen zu erhalten.</p>}
      <div className="learn-today"><Clock3 size={17}/><span>Heute erfasste Lerneinheiten</span><strong>{completed}</strong></div>
    </section>
    <section className="learn-section">
      <div className="learn-title"><div><span className="overline">DEIN FORTSCHRITT</span><h2>Deine Lernreise</h2></div></div>
      {rankedModules.length===0?<p className="learn-muted">Hier erscheinen deine aktiven Module.</p>:<div className="learn-journeys">
        {rankedModules.map(({module,j})=><div className="learn-journey" key={module.id}>
          <button className="learn-journey-head" onClick={()=>onOpenModule(module.id)}>
            <span className="learn-journey-color" style={{background:module.color}}/>
            <span className="learn-journey-name"><strong>{module.name}</strong><small>{j.status}</small></span><ChevronRight size={19}/>
          </button>
          <p>{j.message}</p>
          <div className="learn-metrics">
            <div><span>Verständnis</span><strong>{percent(j.understanding)}</strong></div>
            <div><span>Wiederholung</span><strong>{j.repetition} %</strong></div>
            <div><span>Klausurtraining</span><strong>{j.training} %</strong></div>
          </div>
          {j.preparation!==null?<div className="learn-meter"><div style={{width:j.preparation+'%',background:module.color}}/></div>:<div className="learn-meter learn-meter-empty"/>}
          <div className="learn-foot"><span>{j.rated} von {j.total} bisherigen Terminen bewertet</span><span>{j.preparation===null?'Noch kein Schätzwert':j.preparation+' % Vorbereitungsindex'}</span></div>
        </div>)}
      </div>}
    </section>
    {studyOpen&&<div className="learn-backdrop" onClick={e=>{if(e.target===e.currentTarget)setStudyOpen(false)}}>
      <div className="learn-sheet" role="dialog" aria-modal="true" aria-label="Lerneinheit erfassen">
        <div className="learn-sheet-head"><div><span className="overline">DEINE LERNREISE</span><h2>Freies Lernen</h2></div><button aria-label="Schließen" onClick={()=>setStudyOpen(false)}><X size={20}/></button></div>
        <label>Modul<select value={chosenModule?.id||''} onChange={e=>{setModuleId(e.target.value);setLessonKey('')}}>{active.map(m=><option value={m.id} key={m.id}>{m.name}</option>)}</select></label>
        <label>Was hast du gemacht?<select value={kind} onChange={e=>setKind(e.target.value as 'review'|'exam')}><option value="review">Stoff wiederholt / gelernt</option><option value="exam">Klausuraufgaben geübt</option></select></label>
        {kind==='review'&&<label>Welche Veranstaltung? (optional)<select value={lessonKey} onChange={e=>setLessonKey(e.target.value)}><option value="">Allgemeines Lernen</option>{options.map(l=><option key={l.key} value={l.key}>{l.label} · {shortDate(l.date)}</option>)}</select></label>}
        <label>Dauer<select value={duration} onChange={e=>setDuration(Number(e.target.value))}>{[15,30,45,60,90,120,180].map(n=><option value={n} key={n}>{n} Minuten</option>)}</select></label>
        <span className="learn-field-title">Wie lief es?</span>
        <div className="learn-result-options">{ratingLabels.filter(r=>r.value!=='absent').map(r=><button key={r.value} className={result===r.value?'active':''} onClick={()=>setResult(r.value as typeof result)}>{r.label}</button>)}</div>
        <p className="learn-muted">Lernzeit allein bedeutet nicht, dass du den Stoff beherrschst. Deine Bewertung fließt in die Empfehlungen ein.</p>
        <button className="learn-submit" disabled={!chosenModule} onClick={submitStudy}>Lerneinheit speichern <Check size={17}/></button>
      </div>
    </div>}
  </div>
}
function addDaysLocal(iso:string,n:number){
  const date=fromDate(iso);date.setDate(date.getDate()+n)
  return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`
}
