import {useSwipeToDismiss} from './useSwipeToDismiss'
import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { createPortal } from 'react-dom'
import { ArrowLeft, ArrowRight, BookOpenCheck, Check, ChevronRight, GraduationCap, PenLine, Play, Plus, RotateCcw, Sparkles, Timer, Trash2, X } from 'lucide-react'
import { dateString, formatDate, selectedAssessment, today, uid, weekStart, type AppData, type Assessment, type Semester, type StudyModule } from './model'
import AnimatedScore from './AnimatedScore'
import {lessonProgressMap} from './lesson-progress'
import SemesterOverview from './SemesterOverview'
import type {StudyDayBundle,StudyPlan,StudySchedulePreferences} from './adaptive-study-plan'
import UniflowPicker from './UniflowPicker'
import LearningSessionForm,{type SessionValues} from './LearningSessionForm'
import StudyTimerCard from './StudyTimerCard'
import {timerElapsed,type StudyTimerState} from './study-timer'
import { numberedLessons, scoreTotal, type NumberedLesson } from './score'
import type { LearningRating, LearningSession, ScoreEvent, StudyTask } from './learning'
import './module-learning-home.css'

type Props = {
  studyPlan:StudyPlan
  requestedStudyBundle?:StudyDayBundle|null
  onStudyBundleOpened:()=>void
  onStudyScheduleChange:(preferences:StudySchedulePreferences)=>void
  data: AppData
  semester?: Semester
  modules: StudyModule[]
  onAddTask: (moduleId: string, title: string, dueDate?: string) => void
  onToggleTask: (task: StudyTask) => void
  onDeleteTask: (task: StudyTask) => void
  onDeleteActivity: (events: ScoreEvent[]) => void
  storageKey: string
  currentModuleId?:string
  onPreviewAssessment:(exam:Assessment)=>void
  onAddAssessment:(type:'exam'|'homework',moduleId:string)=>void
  onToggleHomework:(homework:Assessment)=>void
  onActiveModuleChange:(moduleId:string)=>void
  onSession: (session: Omit<LearningSession, 'id' | 'updatedAt'>) => void
  onTimerChange:(timer:StudyTimerState|undefined)=>void
  onUpdateSession:(session:LearningSession)=>void
  onLearnContent: (moduleId: string, lessons: NumberedLesson[], duration: number, rating: Exclude<LearningRating, 'absent'>) => void
  onEditModule: (moduleId: string) => void
  onCreateModule: () => void
}

type Modal = 'session' | 'content' | 'history' | 'tasks' | 'task' | 'create' | 'modules' | null
const ratings: { value: Exclude<LearningRating, 'absent'>; label: string }[] = [
  { value: 'understood', label: 'Gut verstanden' },
  { value: 'partial', label: 'Teilweise verstanden' },
  { value: 'struggling', label: 'Noch nicht verstanden' }
]
const eventLabels: Record<ScoreEvent['type'], string> = {
  'module-created': 'Startbonus', 'todo-completed': 'Aufgabe erledigt', attendance: 'Veranstaltung besucht',
  checkin: 'Verständnis eingetragen', 'study-minutes': 'Lernsession', 'content-learned': 'Stoff gelernt'
}

function Overlay({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  const sheet=useRef<HTMLElement>(null)
  useSwipeToDismiss(sheet,onClose)
  useEffect(() => {
    const escape = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose() }
    window.addEventListener('keydown', escape)
    return () => window.removeEventListener('keydown', escape)
  }, [onClose])
  return createPortal(<div className="mlh-overlay" onPointerDown={event => { if (event.target === event.currentTarget) onClose() }}>
    <section ref={sheet} className="mlh-sheet" role="dialog" aria-modal="true" aria-label={title}>
      <i className="mlh-sheet-handle" aria-hidden="true" />
      <header><h2>{title}</h2><button onClick={onClose} aria-label="Schließen"><X size={20} /></button></header>
      {children}
    </section>
  </div>, document.body)
}

function ActivityHistory({ events, tasks, sessions, onEditSession, onToggleTask, onDeleteTask, onDeleteActivity }: { events: ScoreEvent[]; tasks: StudyTask[]; sessions:LearningSession[];onEditSession:(session:LearningSession)=>void;onToggleTask: Props['onToggleTask']; onDeleteTask: Props['onDeleteTask']; onDeleteActivity: Props['onDeleteActivity'] }) {
  const grouped = useMemo(() => {
    const groups = new Map<string, { key: string; occurredAt: string; points: number; title: string; items: ScoreEvent[] }>()
    for (const event of events.filter(item => !item.reversedAt).sort((a, b) => b.occurredAt.localeCompare(a.occurredAt))) {
      const key = event.groupId || event.id
      const group = groups.get(key) || { key, occurredAt: event.occurredAt, points: 0, title: event.label || eventLabels[event.type], items: [] }
      group.points += event.points
      group.items.push(event)
      groups.set(key, group)
    }
    return [...groups.values()]
  }, [events])
  if (!grouped.length) return <p className="mlh-empty-copy">Sobald du lernst oder etwas erledigst, erscheint es hier.</p>
  return <div className="mlh-history-list">{grouped.map(group => <article key={group.key}>
    <span><strong>{group.title}</strong><small>{new Date(group.occurredAt).toLocaleDateString('de-DE', { day: 'numeric', month: 'short', year: 'numeric' })}</small></span>
    <b>+{group.points}</b><div className="mlh-history-actions">
      {group.items.some(event=>event.type==='study-minutes'&&sessions.some(session=>session.id===event.sourceId))&&<button aria-label="Lernzeit bearbeiten" title="Lernzeit bearbeiten" onClick={()=>{const event=group.items.find(item=>item.type==='study-minutes'),session=sessions.find(item=>item.id===event?.sourceId);if(session)onEditSession(session)}}><PenLine size={17}/></button>}
      {group.items[0]?.type === 'todo-completed' && tasks.find(task=>task.id===group.items[0].sourceId) && <button aria-label="Aufgabe wieder öffnen" title="Rückgängig" onClick={()=>onToggleTask(tasks.find(task=>task.id===group.items[0].sourceId)!)}><RotateCcw size={17}/></button>}
      {!group.items.some(event=>event.type==='module-created')&&<button aria-label={`${group.title} löschen`} title="Löschen" onClick={()=>{const task=group.items[0]?.type==='todo-completed'?tasks.find(task=>task.id===group.items[0].sourceId):undefined;if(task)onDeleteTask(task);else onDeleteActivity(group.items)}}><Trash2 size={17}/></button>}
    </div>
  </article>)}</div>
}


export default function ModuleLearningHome({ studyPlan,requestedStudyBundle,onStudyBundleOpened,onStudyScheduleChange,data, semester, modules, onAddTask, onToggleTask, onDeleteTask, onDeleteActivity, storageKey, currentModuleId, onPreviewAssessment, onAddAssessment, onToggleHomework, onActiveModuleChange, onSession, onTimerChange, onUpdateSession, onLearnContent, onEditModule, onCreateModule }: Props) {
  const visible = modules.filter(module => !module.hidden && !['passed','planned','recognized'].includes(module.status))
  const [selectedModule, setSelectedModule] = useState(()=>{if(currentModuleId)return currentModuleId;try{return localStorage.getItem(storageKey)||''}catch{return ''}})
  const [directoryOpen,setDirectoryOpen]=useState(()=>{if(currentModuleId)return false;try{return !localStorage.getItem(storageKey)}catch{return true}}),[openingModule,setOpeningModule]=useState('')
  const [detailMotion,setDetailMotion]=useState<'out'|'in'|''>('')
  const [switchDirection,setSwitchDirection]=useState<'up'|'down'>('down')
  const moduleScroll=useRef(0)
  const externalModuleId=useRef(currentModuleId)
  const directoryScroll=useRef<HTMLDivElement|null>(null)
  const railScroll=useRef<HTMLElement|null>(null)
  const scrollSyncFrame=useRef(0)
  const scrollSyncing=useRef(false)
  const [modal, setModal] = useState<Modal>(null)
  const [finishingTimer,setFinishingTimer]=useState<StudyTimerState|null>(null)
  const [editingSession,setEditingSession]=useState<LearningSession|null>(null)
  const [duration, setDuration] = useState(45)
  const [rating, setRating] = useState<Exclude<LearningRating, 'absent'>>('understood')
  const [selectedLessons, setSelectedLessons] = useState<string[]>([])
  const [taskTitle, setTaskTitle] = useState('')
  const [taskDate, setTaskDate] = useState('')
  const safeIndex = Math.max(0, visible.findIndex(module=>module.id===selectedModule))
  const active = visible[safeIndex]
  useEffect(()=>{if(active)onActiveModuleChange(active.id)},[active?.id,onActiveModuleChange])
  useEffect(()=>{
    if(!currentModuleId||currentModuleId===externalModuleId.current)return
    externalModuleId.current=currentModuleId
    setSelectedModule(current=>current===currentModuleId?current:currentModuleId)
    setDirectoryOpen(false)
    try{localStorage.setItem(storageKey,currentModuleId)}catch{/* Keep navigation usable when storage is unavailable. */}
  },[currentModuleId,storageKey])
  const allLessons = useMemo(() => {
    if(!active)return []
    const lessons=new Map(numberedLessons(data,semester,active.id).map(lesson=>[lesson.key,lesson]))
    for(const lesson of studyPlan.lessons)if(lesson.moduleId===active.id)lessons.set(lesson.key,lesson)
    return [...lessons.values()].sort((a,b)=>a.occurrence.date.localeCompare(b.occurrence.date)||a.occurrence.from.localeCompare(b.occurrence.from)||a.key.localeCompare(b.key))
  }, [data.offerings,semester,active?.id,studyPlan.lessons])
  useEffect(()=>{
    if(!requestedStudyBundle)return
    setSelectedModule(requestedStudyBundle.moduleId)
    try{localStorage.setItem(storageKey,requestedStudyBundle.moduleId)}catch{/* Keep navigation usable when storage is unavailable. */}
    setDirectoryOpen(false)
    setSelectedLessons(requestedStudyBundle.items.map(item=>item.key))
    setDuration(Math.max(5,Math.min(360,requestedStudyBundle.minutes)))
    setRating('understood');setModal('content')
    onStudyBundleOpened()
  },[requestedStudyBundle,onStudyBundleOpened])
  const progressByLesson=useMemo(()=>lessonProgressMap(data),[data.learningCheckins,data.learningSessions,data.scoreEvents])
  const tasks = (data.studyTasks || []).filter(task => task.moduleId === active?.id)
  const pending = tasks.filter(task => !task.completedAt).sort((a, b) => (a.dueDate || '9999').localeCompare(b.dueDate || '9999') || a.createdAt.localeCompare(b.createdAt))
  const completed = tasks.filter(task => !!task.completedAt).sort((a, b) => (b.completedAt || '').localeCompare(a.completedAt || ''))
  const events = (data.scoreEvents || []).filter(event => event.moduleId === active?.id)
  const homework=data.assessments.filter(item=>item.moduleId===active?.id&&item.semesterId===semester?.id&&item.type==='homework')
  const exams=data.assessments.filter(item=>item.moduleId===active?.id&&item.semesterId===semester?.id&&item.type==='exam'&&selectedAssessment(item,data.assessments))
  const completedAssessments=[...homework,...exams].filter(item=>item.completed).sort((a,b)=>(b.date||'').localeCompare(a.date||'')||a.title.localeCompare(b.title,'de'))
  const completedCount=completed.length+completedAssessments.length
  const pointsThisWeek=events.filter(event=>!event.reversedAt&&event.occurredAt.slice(0,10)>=weekStart(today())).reduce((sum,event)=>sum+event.points,0)
  const nextStudyBundle=studyPlan.bundles.filter(bundle=>bundle.moduleId===active?.id&&!bundle.completed&&bundle.date>=today()).sort((a,b)=>a.date.localeCompare(b.date))[0]
  const nextLesson=allLessons.find(lesson=>{const progress=progressByLesson.get(lesson.key);return !progress||progress.green+progress.yellow<4})||allLessons[0]
  const focusKeys=nextStudyBundle?.items.map(item=>item.key).filter(key=>allLessons.some(lesson=>lesson.key===key))||(nextLesson?[nextLesson.key]:[])
  const focusMinutes=nextStudyBundle?.minutes||45
  const focusTitle=nextStudyBundle?.items.map(item=>item.label).slice(0,2).join(' · ')||nextLesson?.label||'Freie Lernsession'
  type TimelineItem={key:string;kind:'task';date?:string;title:string;task:StudyTask}|{key:string;kind:'homework'|'exam';date?:string;title:string;assessment:Assessment}
  const timelineItems:TimelineItem[]=[
    ...pending.map(task=>({key:`task-${task.id}`,kind:'task' as const,date:task.dueDate,title:task.title,task})),
    ...homework.filter(item=>!item.completed).map(assessment=>({key:`homework-${assessment.id}`,kind:'homework' as const,date:assessment.date,title:assessment.title,assessment})),
    ...exams.filter(item=>!item.completed).map(assessment=>({key:`exam-${assessment.id}`,kind:'exam' as const,date:assessment.date,title:assessment.title,assessment}))
  ].sort((a,b)=>(a.date||'9999').localeCompare(b.date||'9999')||a.title.localeCompare(b.title,'de'))
  const setModuleScroller=(node:HTMLElement|null,kind:'directory'|'rail')=>{if(kind==='directory')directoryScroll.current=node as HTMLDivElement|null;else railScroll.current=node;if(node){const maximum=Math.max(0,node.scrollHeight-node.clientHeight);node.scrollTop=moduleScroll.current*maximum}}
  const syncModuleScroll=(source:HTMLElement,target:HTMLElement|null)=>{if(scrollSyncing.current)return;const maximum=Math.max(0,source.scrollHeight-source.clientHeight);moduleScroll.current=maximum?source.scrollTop/maximum:0;if(!target)return;scrollSyncing.current=true;const targetMaximum=Math.max(0,target.scrollHeight-target.clientHeight);target.scrollTop=moduleScroll.current*targetMaximum;cancelAnimationFrame(scrollSyncFrame.current);scrollSyncFrame.current=requestAnimationFrame(()=>{scrollSyncing.current=false})}
  const rememberModule=(id:string)=>{try{localStorage.setItem(storageKey,id)}catch{/* Keep navigation usable when storage is unavailable. */}}
  const enterModule=(id:string)=>{if(openingModule)return;rememberModule(id);setSelectedModule(id);setSelectedLessons([]);setModal(null);setOpeningModule(id);setDirectoryOpen(false);window.setTimeout(()=>setOpeningModule(''),520)}
  const switchRail=(id:string)=>{if(id===active?.id||detailMotion)return;const nextIndex=visible.findIndex(module=>module.id===id);setSwitchDirection(nextIndex<safeIndex?'up':'down');rememberModule(id);setSelectedModule(id);setSelectedLessons([]);setModal(null);setDetailMotion('in');window.setTimeout(()=>setDetailMotion(''),380)}
  const open = (next: Modal) => { setModal(next); setDuration(45); setRating('understood'); if(next==='session'){setFinishingTimer(null);setEditingSession(null)} if (next === 'content') setSelectedLessons([]) }
  const openStudyFocus=()=>{if(!focusKeys.length){open('session');return}open('content');setSelectedLessons(focusKeys);setDuration(Math.max(5,Math.min(360,focusMinutes)))}
  const startTimer=(minutes:number)=>{
    if(data.studyTimer||!active)return
    const now=Date.now()
    onTimerChange({id:uid(),moduleId:active.id,startedAt:new Date(now).toISOString(),runningSince:now,elapsedMs:0,targetMinutes:minutes})
    setModal(null)
  }
  const saveSessionValues=(values:SessionValues)=>{
    if(editingSession)onUpdateSession({...editingSession,...values})
    else if(finishingTimer)onSession({...values,moduleId:finishingTimer.moduleId,kind:'review',timerId:finishingTimer.id,startedAt:finishingTimer.startedAt,endedAt:new Date().toISOString(),elapsedSeconds:Math.round(timerElapsed(finishingTimer)/1000)})
    else onSession({...values,moduleId:active.id,kind:'review'})
    setModal(null);setFinishingTimer(null);setEditingSession(null)
  }

  if (!visible.length) return <main className="screen mlh-empty"><Sparkles size={32} /><h1>Dein Lernbereich</h1><p>Erstelle dein erstes Modul und starte direkt mit 100 Punkten.</p><button onClick={onCreateModule}><Plus size={18} /> Modul erstellen</button></main>
  const accent = { '--mlh-accent': active.color || '#7aa2ff' } as CSSProperties
  return <main className={'screen mlh-slider-window '+(directoryOpen?'is-directory':'is-module')} style={accent}>
    <div className="mlh-slider-track">
      <section className="mlh-directory mlh-slider-pane" aria-hidden={!directoryOpen}>
        <div ref={node=>setModuleScroller(node,'directory')} onScroll={event=>syncModuleScroll(event.currentTarget,railScroll.current)} className="mlh-directory-list"><span className="mlh-directory-rail-spacer" aria-hidden="true"/>{visible.map(module=><button key={module.id} className={openingModule===module.id?'is-selected':''} style={{'--module-color':module.color} as CSSProperties} onClick={()=>enterModule(module.id)}><span className="mlh-directory-name">{module.name}</span></button>)}</div>
        <button className="mlh-directory-add" onClick={onCreateModule}><Plus size={16}/>Modul hinzufügen</button>
      </section>
      <section className="mlh-module-pane mlh-slider-pane" aria-hidden={directoryOpen}>
        <aside ref={node=>setModuleScroller(node,'rail')} onScroll={event=>syncModuleScroll(event.currentTarget,directoryScroll.current)} className="mlh-module-rail mlh-module-rail-fixed" aria-label="Module"><button className="mlh-rail-home" onClick={()=>{setModal(null);setDirectoryOpen(true)}} aria-label="Zurück zur Modulübersicht"><ArrowLeft size={17}/></button>{visible.map(module=><button key={module.id} className={module.id===active.id?'active':''} style={{'--module-color':module.color} as CSSProperties} onClick={()=>switchRail(module.id)} aria-label={module.name} title={module.name}>{module.shortName||module.name.slice(0,3).toUpperCase()}</button>)}</aside>
        <div className={'mlh-home mlh-module-open motion-'+switchDirection+(detailMotion?` is-switching-${detailMotion}`:'')} style={accent}>
    <header className="mlh-module-head mlh-module-head-simple">
      <h1 id="learning-module-title" key={active.id}>{active.name}</h1><button id="learning-module-score" className="mlh-score clean-score" onClick={() => open('history')} aria-label={`${scoreTotal(data.scoreEvents, active.id)} Punkte, davon ${pointsThisWeek} diese Woche, Aktivitäten öffnen`}>
      <span className="clean-score-value" style={{'--score-digits':scoreTotal(data.scoreEvents,active.id).toLocaleString('de-DE').length} as CSSProperties}><AnimatedScore key={active.id} value={scoreTotal(data.scoreEvents,active.id)} storageKey={`${storageKey}:score:${active.id}`}/></span>
      <small>+{pointsThisWeek} diese Woche</small>
    </button>
    </header>

    <section className="mlh-focus-card" aria-label="Weiterlernen">
      <div className="mlh-focus-copy"><span>Weiterlernen</span><h2>{focusTitle}</h2><p>{nextStudyBundle?`${focusMinutes} Min. · ${formatDate(nextStudyBundle.date,{weekday:'short',day:'numeric',month:'short'})}`:`${focusMinutes} Min. · direkt einsteigen`}</p></div>
      <button onClick={openStudyFocus}><Play size={17} fill="currentColor"/><span>Starten</span></button>
    </section>

    <section className="mlh-actions mlh-compact-actions" aria-label="Modulaktionen">
      <button aria-label="Lernsession starten" onClick={() => open('session')}><Timer size={17} /><strong>Lernsession</strong></button>
      <button aria-label="Gelernten Stoff eintragen" onClick={() => open('content')}><BookOpenCheck size={17} /><strong>Stoff eintragen</strong></button>
      <button className="mlh-action-secondary" aria-label="Modul bearbeiten" onClick={() => onEditModule(active.id)}><PenLine size={17} /><strong>Bearbeiten</strong></button>
    </section>

    {data.studyTimer&&<StudyTimerCard timer={data.studyTimer} moduleName={data.modules.find(module=>module.id===data.studyTimer?.moduleId)?.name||'Lernsession'} color={data.modules.find(module=>module.id===data.studyTimer?.moduleId)?.color||active.color} onChange={onTimerChange} onDiscard={()=>onTimerChange(undefined)} onFinish={timer=>{onTimerChange(timer);setFinishingTimer(timer);setEditingSession(null);setModal('session')}}/>}
    <section className="mlh-next" aria-label="Als Nächstes">
      <header><div><span>Dein Modul</span><h2>Als Nächstes</h2></div><button className="mlh-next-add" aria-label="Aufgabe, Hausaufgabe oder Klausur hinzufügen" title="Hinzufügen" onClick={() => open('create')}><Plus size={19}/></button></header>
      <div className="mlh-next-list">
        {timelineItems.map((item,position)=><article key={item.key} className={`mlh-next-row is-${item.kind}`} style={{animationDelay:`${position*35}ms`}}>
          {item.kind==='exam'?<span className="mlh-next-kind" aria-hidden="true"><GraduationCap size={17}/></span>:<button className="mlh-next-check" aria-label={`${item.title} als erledigt markieren`} onClick={()=>item.kind==='task'?onToggleTask(item.task):onToggleHomework(item.assessment)}><i/></button>}
          <button className="mlh-next-open" onClick={()=>item.kind==='task'?onToggleTask(item.task):onPreviewAssessment(item.assessment)}>
            <span>{item.kind==='task'?'Aufgabe':item.kind==='homework'?'Hausaufgabe':'Klausur'}</span><strong>{item.title}</strong><small>{item.date?formatDate(item.date,{weekday:'short',day:'numeric',month:'short'}):'Ohne Termin'}{item.kind!=='task'&&item.assessment.from?` · ${item.assessment.from}`:''}</small>
          </button>
          {item.kind==='task'?<div className="mlh-next-trailing"><b>+{item.task.points}</b><button aria-label={`${item.title} löschen`} onClick={()=>onDeleteTask(item.task)}><Trash2 size={16}/></button></div>:<ChevronRight className="mlh-next-arrow" size={18}/>} 
        </article>)}
        {!timelineItems.length&&<div className="mlh-next-empty"><Check size={18}/><span><strong>Alles im Blick</strong><small>Für dieses Modul ist gerade nichts offen.</small></span></div>}
      </div>
      {completedCount>0&&<button className="mlh-next-completed" onClick={()=>open('tasks')}><Check size={15}/>{completedCount} abgeschlossen<ChevronRight size={15}/></button>}
    </section>
    <SemesterOverview key={active.id} data={data} semester={semester} module={active} plan={studyPlan} onOpen={onPreviewAssessment} onToggle={onToggleHomework} onChange={onStudyScheduleChange} onStudy={(keys,minutes)=>{open('content');setSelectedLessons(keys.filter(key=>allLessons.some(lesson=>lesson.key===key)));setDuration(Math.max(5,Math.min(360,minutes)))}}/>

    {modal === 'create' && <Overlay title="Neu hinzufügen" onClose={() => setModal(null)}><div className="mlh-create-menu">
      <button onClick={()=>setModal('task')}><span><Check size={18}/></span><strong>Aufgabe</strong><small>Ein persönliches To-do für dieses Modul</small></button>
      <button onClick={()=>{setModal(null);onAddAssessment('homework',active.id)}}><span><BookOpenCheck size={18}/></span><strong>Hausaufgabe</strong><small>Eine Abgabe mit optionalem Termin</small></button>
      <button onClick={()=>{setModal(null);onAddAssessment('exam',active.id)}}><span><GraduationCap size={18}/></span><strong>Klausur</strong><small>Prüfung oder weiteren Alternativtermin anlegen</small></button>
    </div></Overlay>}

    {modal === 'task' && <Overlay title="Neue Aufgabe" onClose={() => setModal(null)}><form className="mlh-form" onSubmit={event => { event.preventDefault(); if (!taskTitle.trim()) return; onAddTask(active.id, taskTitle.trim(), taskDate || undefined); setTaskTitle(''); setTaskDate(''); setModal(null) }}>
      <label><span>Aufgabe</span><input autoFocus value={taskTitle} onChange={event => setTaskTitle(event.target.value)} placeholder="Was möchtest du erledigen?" /></label>
      <label><span>Termin <em>optional</em></span><UniflowPicker kind="date" label="Termin" value={taskDate} min={today()} onChange={setTaskDate}/></label>
      <p><Sparkles size={15} /> Erledigen bringt automatisch +20 Punkte.</p><button className="mlh-primary" type="submit">Aufgabe hinzufügen <ArrowRight size={18} /></button>
    </form></Overlay>}

    {modal === 'session' && <Overlay title={editingSession?'Lernsession bearbeiten':finishingTimer?'Lernsession beenden':'Lernsession'} onClose={() => setModal(null)}><LearningSessionForm key={editingSession?.id||finishingTimer?.id||'new'} initialMinutes={editingSession?.duration??(finishingTimer?Math.max(.01,Math.round(timerElapsed(finishingTimer)/600)/100):45)} initialRating={editingSession?.rating} initialDate={editingSession?.date||(finishingTimer?dateString(new Date(finishingTimer.startedAt)):today())} onSave={saveSessionValues} onStart={!editingSession&&!finishingTimer?startTimer:undefined} timerExists={!!data.studyTimer} finishing={!!finishingTimer} onDiscard={finishingTimer?()=>{onTimerChange(undefined);setFinishingTimer(null);setModal(null)}:undefined}/></Overlay>}

    {modal === 'content' && <Overlay title="Stoff gelernt" onClose={() => setModal(null)}><div className="mlh-form mlh-content-form">
      <p className="mlh-content-intro">Wähle Vorlesungen oder Übungen – unabhängig davon, ob du sie besucht hast.</p>
      <div className="mlh-lesson-list">{allLessons.map(lesson => {
        const progress=progressByLesson.get(lesson.key)||{green:0,yellow:0,label:'Noch nicht gelernt'}
        const selected = selectedLessons.includes(lesson.key)
        return <button key={lesson.key} className={selected ? 'selected' : ''} onClick={() => setSelectedLessons(current => current.includes(lesson.key) ? current.filter(key => key !== lesson.key) : [...current, lesson.key])}>
          <i>{selected ? <Check size={15} /> : null}</i><span><strong>{lesson.label}</strong><small>{formatDate(lesson.occurrence.date, { day: 'numeric', month: 'short' })}</small><span className="mlh-progress-bars" role="img" aria-label={progress.label} title={progress.label}>{[1,2,3,4].map(level=><i key={level} className={progress.green>=level?'is-green':progress.yellow>=level?'is-yellow':''}/>)}</span></span>
        </button>
      })}{!allLessons.length && <p className="mlh-empty-copy">Für dieses Modul sind noch keine Vorlesungen oder Übungen im Stundenplan.</p>}</div>
      <label><span>Lernzeit in Minuten</span><input type="number" min="5" max="360" step="5" value={duration} onChange={event => setDuration(Math.max(5, Math.min(360, Number(event.target.value) || 5)))} /></label>
      <div className="mlh-rating"><span>Wie sicher fühlst du dich?</span>{ratings.map(option => <button key={option.value} className={rating === option.value ? 'active' : ''} onClick={() => setRating(option.value)}>{option.label}</button>)}</div>
      <button className="mlh-primary" disabled={!selectedLessons.length} onClick={() => { onLearnContent(active.id, allLessons.filter(lesson => selectedLessons.includes(lesson.key)), duration, rating); setModal(null) }}>Lernen speichern <ArrowRight size={18} /></button>
    </div></Overlay>}

    {modal === 'history' && <Overlay title="Letzte Aktivitäten" onClose={() => setModal(null)}><ActivityHistory events={events} tasks={tasks} sessions={data.learningSessions||[]} onEditSession={session=>{setEditingSession(session);setFinishingTimer(null);setModal('session')}} onToggleTask={onToggleTask} onDeleteTask={onDeleteTask} onDeleteActivity={onDeleteActivity}/></Overlay>}
    {modal === 'tasks' && <Overlay title="Abgeschlossen" onClose={() => setModal(null)}><div className="mlh-history-list">{completed.map(task=><article key={'task-'+task.id}><span><small>Aufgabe</small><s>{task.title}</s><small>{task.completedAt?new Date(task.completedAt).toLocaleDateString('de-DE'):''}</small></span><div className="mlh-history-actions"><button aria-label={`${task.title} wieder öffnen`} title="Rückgängig" onClick={()=>onToggleTask(task)}><RotateCcw size={17}/></button><button aria-label={`${task.title} löschen`} title="Löschen" onClick={()=>onDeleteTask(task)}><Trash2 size={17}/></button></div></article>)}{completedAssessments.map(item=><article key={'assessment-'+item.id}><button className="mlh-completed-open" onClick={()=>{setModal(null);onPreviewAssessment(item)}}><small>{item.type==='exam'?'Klausur':'Hausaufgabe'}</small><s>{item.title}</s><small>{item.date?formatDate(item.date,{day:'numeric',month:'short',year:'numeric'}):'Ohne Termin'}</small></button><div className="mlh-history-actions"><button aria-label={`${item.title} wieder öffnen`} title="Rückgängig" onClick={()=>onToggleHomework(item)}><RotateCcw size={17}/></button></div></article>)}</div></Overlay>}
        </div>
      </section>
    </div>
  </main>
}
