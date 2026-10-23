import { useEffect, useMemo, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from 'react'
import { createPortal } from 'react-dom'
import { ArrowLeft, ArrowRight, BookOpenCheck, Check, PenLine, Plus, RotateCcw, Sparkles, Timer, Trash2, X } from 'lucide-react'
import { formatDate, today, type AppData, type Semester, type StudyModule } from './model'
import { numberedLessons, scoreTotal, type NumberedLesson } from './score'
import type { LearningRating, LearningSession, ScoreEvent, StudyTask } from './learning'
import './module-learning-home.css'

type Props = {
  data: AppData
  semester?: Semester
  modules: StudyModule[]
  onAddTask: (moduleId: string, title: string, dueDate?: string) => void
  onToggleTask: (task: StudyTask) => void
  onDeleteTask: (task: StudyTask) => void
  onDeleteActivity: (events: ScoreEvent[]) => void
  storageKey: string
  onSession: (session: Omit<LearningSession, 'id' | 'updatedAt'>) => void
  onLearnContent: (moduleId: string, lessons: NumberedLesson[], duration: number, rating: Exclude<LearningRating, 'absent'>) => void
  onEditModule: (moduleId: string) => void
  onCreateModule: () => void
}

type Modal = 'session' | 'content' | 'history' | 'tasks' | 'task' | null
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
  useEffect(() => {
    const escape = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose() }
    window.addEventListener('keydown', escape)
    return () => window.removeEventListener('keydown', escape)
  }, [onClose])
  return createPortal(<div className="mlh-overlay" onPointerDown={event => { if (event.target === event.currentTarget) onClose() }}>
    <section className="mlh-sheet" role="dialog" aria-modal="true" aria-label={title}>
      <i className="mlh-sheet-handle" aria-hidden="true" />
      <header><h2>{title}</h2><button onClick={onClose} aria-label="Schließen"><X size={20} /></button></header>
      {children}
    </section>
  </div>, document.body)
}

function ActivityHistory({ events, tasks, onToggleTask, onDeleteTask, onDeleteActivity }: { events: ScoreEvent[]; tasks: StudyTask[]; onToggleTask: Props['onToggleTask']; onDeleteTask: Props['onDeleteTask']; onDeleteActivity: Props['onDeleteActivity'] }) {
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
      {group.items[0]?.type === 'todo-completed' && tasks.find(task=>task.id===group.items[0].sourceId) && <button aria-label="Aufgabe wieder öffnen" title="Rückgängig" onClick={()=>onToggleTask(tasks.find(task=>task.id===group.items[0].sourceId)!)}><RotateCcw size={17}/></button>}
      <button aria-label={`${group.title} löschen`} title="Löschen" onClick={()=>{const task=group.items[0]?.type==='todo-completed'?tasks.find(task=>task.id===group.items[0].sourceId):undefined;if(task)onDeleteTask(task);else onDeleteActivity(group.items)}}><Trash2 size={17}/></button>
    </div>
  </article>)}</div>
}

export default function ModuleLearningHome({ data, semester, modules, onAddTask, onToggleTask, onDeleteTask, onDeleteActivity, storageKey, onSession, onLearnContent, onEditModule, onCreateModule }: Props) {
  const visible = modules.filter(module => !module.hidden && module.status !== 'passed')
  const [selectedModule, setSelectedModule] = useState<string>(()=>{try{return localStorage.getItem(storageKey)||''}catch{return ''}})
  const [modal, setModal] = useState<Modal>(null)
  const [duration, setDuration] = useState(45)
  const [rating, setRating] = useState<Exclude<LearningRating, 'absent'>>('understood')
  const [selectedLessons, setSelectedLessons] = useState<string[]>([])
  const [taskTitle, setTaskTitle] = useState('')
  const [taskDate, setTaskDate] = useState('')
  const drag = useRef<{ x: number; y: number } | null>(null)
  const suppressScoreClick = useRef(false)
  const safeIndex = Math.max(0, visible.findIndex(module=>module.id===selectedModule))
  const active = visible[safeIndex]
  useEffect(()=>{if(active)try{localStorage.setItem(storageKey,active.id)}catch{/* Storage is optional. */}},[active?.id,storageKey])
  const allLessons = useMemo(() => numberedLessons(data, semester, active?.id), [data.offerings, semester, active?.id])
  const checkins = useMemo(() => new Map((data.learningCheckins || []).map(item => [item.key, item])), [data.learningCheckins])
  const learned = useMemo(() => new Set((data.scoreEvents || []).filter(event => event.type === 'content-learned' && !event.reversedAt).map(event => event.sourceId)), [data.scoreEvents])
  const tasks = (data.studyTasks || []).filter(task => task.moduleId === active?.id)
  const pending = tasks.filter(task => !task.completedAt).sort((a, b) => (a.dueDate || '9999').localeCompare(b.dueDate || '9999') || a.createdAt.localeCompare(b.createdAt))
  const completed = tasks.filter(task => !!task.completedAt).sort((a, b) => (b.completedAt || '').localeCompare(a.completedAt || ''))
  const events = (data.scoreEvents || []).filter(event => event.moduleId === active?.id)
  const switchTo = (next: number) => { setSelectedModule(visible[Math.max(0, Math.min(visible.length - 1, next))]?.id||''); setModal(null); setSelectedLessons([]) }
  const onPointerDown = (event: ReactPointerEvent) => { if(modal)return;const target=event.target as HTMLElement;if(target.closest('button,input')&&!target.closest('.mlh-score'))return;suppressScoreClick.current=false;drag.current = { x: event.clientX, y: event.clientY } }
  const onPointerUp = (event: ReactPointerEvent) => {
    if (!drag.current) return
    const dx = event.clientX - drag.current.x, dy = event.clientY - drag.current.y
    drag.current = null
    if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.2) { suppressScoreClick.current=true;switchTo(safeIndex + (dx < 0 ? 1 : -1)) }
  }
  const open = (next: Modal) => { setModal(next); setDuration(45); setRating('understood'); if (next === 'content') setSelectedLessons([]) }
  if (!visible.length) return <main className="screen mlh-empty"><Sparkles size={32} /><h1>Dein Lernbereich</h1><p>Erstelle dein erstes Modul und starte direkt mit 100 Punkten.</p><button onClick={onCreateModule}><Plus size={18} /> Modul erstellen</button></main>
  const accent = { '--mlh-accent': '#c8cbd1' } as CSSProperties
  return <main className="screen mlh-home" style={accent} onPointerDown={onPointerDown} onPointerUp={onPointerUp}>
    <div className="mlh-glow" aria-hidden="true" />
    <header className="mlh-module-head">
      <button disabled={safeIndex === 0} onClick={() => switchTo(safeIndex - 1)} aria-label="Vorheriges Modul"><ArrowLeft size={21} /></button>
      <div><h1 key={active.id}>{active.name}</h1><i aria-hidden="true" /></div>
      <button disabled={safeIndex === visible.length - 1} onClick={() => switchTo(safeIndex + 1)} aria-label="Nächstes Modul"><ArrowRight size={21} /></button>
    </header>
    <div className="mlh-dots" aria-label={`Modul ${safeIndex + 1} von ${visible.length}`}>{visible.map((module, position) => <button key={module.id} onClick={() => switchTo(position)} className={position === safeIndex ? 'active' : ''} aria-label={module.name} />)}<button className="mlh-add-module" onClick={onCreateModule} aria-label="Modul hinzufügen"><Plus size={13} /></button></div>

    <button className="mlh-score" onClick={() => {if(suppressScoreClick.current){suppressScoreClick.current=false;return}open('history')}} aria-label={`${scoreTotal(data.scoreEvents, active.id)} Punkte, Aktivitäten öffnen`}>
      <span>DEIN SCORE</span><strong>{scoreTotal(data.scoreEvents, active.id).toLocaleString('de-DE')}</strong>
    </button>

    <section className="mlh-actions" aria-label="Modulaktionen">
      <button aria-label="Lernsession starten" onClick={() => open('session')}><Timer size={20} /><strong>Lernsession</strong></button>
      <button aria-label="Stoff gelernt" onClick={() => open('content')}><BookOpenCheck size={20} /><strong>Stoff gelernt</strong></button>
      <button aria-label="Modul bearbeiten" onClick={() => onEditModule(active.id)}><PenLine size={20} /><strong>Bearbeiten</strong></button>
    </section>

    <section className="mlh-tasks">
      <header><div><span>TO-DOS</span></div><button onClick={() => open('task')}><Plus size={18} /> Aufgabe</button></header>
      <div className="mlh-task-stack">
        {pending.map((task, position) => <div key={task.id} className="mlh-task-row"><button className="mlh-task" onClick={() => onToggleTask(task)} style={{ animationDelay: `${position * 45}ms` }}>
          <i aria-hidden="true" /><span><strong>{task.title}</strong><small>{task.dueDate ? formatDate(task.dueDate, { weekday: 'short', day: 'numeric', month: 'short' }) : 'Ohne Termin'}</small></span><b>+{task.points}</b>
        </button><button className="mlh-task-delete" aria-label={`${task.title} löschen`} onClick={()=>onDeleteTask(task)}><Trash2 size={17}/></button></div>)}
      </div>
      {completed.length>0 && <button className="mlh-completed-preview" aria-label="Erledigte Aufgaben im Verlauf öffnen" onClick={()=>open('tasks')}>{completed.slice(0,3).map(task=><span key={task.id}><Check size={16}/><s>{task.title}</s></span>)}</button>}
    </section>

    {modal === 'task' && <Overlay title="Neue Aufgabe" onClose={() => setModal(null)}><form className="mlh-form" onSubmit={event => { event.preventDefault(); if (!taskTitle.trim()) return; onAddTask(active.id, taskTitle.trim(), taskDate || undefined); setTaskTitle(''); setTaskDate(''); setModal(null) }}>
      <label><span>Aufgabe</span><input autoFocus value={taskTitle} onChange={event => setTaskTitle(event.target.value)} placeholder="Was möchtest du erledigen?" /></label>
      <label><span>Termin <em>optional</em></span><input type="date" min={today()} value={taskDate} onChange={event => setTaskDate(event.target.value)} /></label>
      <p><Sparkles size={15} /> Erledigen bringt automatisch +20 Punkte.</p><button className="mlh-primary" type="submit">Aufgabe hinzufügen <ArrowRight size={18} /></button>
    </form></Overlay>}

    {modal === 'session' && <Overlay title="Lernsession" onClose={() => setModal(null)}><div className="mlh-form">
      <label><span>Dauer in Minuten</span><input type="number" min="5" max="360" step="5" value={duration} onChange={event => setDuration(Math.max(5, Math.min(360, Number(event.target.value) || 5)))} /></label>
      <div className="mlh-rating"><span>Wie lief es?</span>{ratings.map(option => <button key={option.value} className={rating === option.value ? 'active' : ''} onClick={() => setRating(option.value)}>{option.label}</button>)}</div>
      <p><Sparkles size={15} /> Diese Session bringt +{duration * 2} Punkte.</p>
      <button className="mlh-primary" onClick={() => { onSession({ moduleId: active.id, date: today(), duration, kind: 'review', rating }); setModal(null) }}>Session speichern <ArrowRight size={18} /></button>
    </div></Overlay>}

    {modal === 'content' && <Overlay title="Stoff gelernt" onClose={() => setModal(null)}><div className="mlh-form mlh-content-form">
      <p className="mlh-content-intro">Wähle Vorlesungen oder Übungen – unabhängig davon, ob du sie besucht hast.</p>
      <div className="mlh-lesson-list">{allLessons.map(lesson => {
        const checkin = checkins.get(lesson.key)
        const attended = !!checkin && (checkin.attended ?? checkin.rating !== 'absent')
        const done = learned.has(lesson.key), selected = selectedLessons.includes(lesson.key)
        return <button key={lesson.key} className={selected ? 'selected' : ''} onClick={() => setSelectedLessons(current => current.includes(lesson.key) ? current.filter(key => key !== lesson.key) : [...current, lesson.key])}>
          <i>{selected ? <Check size={15} /> : null}</i><span><strong>{lesson.label}</strong><small>{formatDate(lesson.occurrence.date, { day: 'numeric', month: 'short' })} · {attended ? 'Besucht' : 'Nicht als besucht markiert'}{done ? ' · Bonus schon erhalten' : ''}</small></span>
        </button>
      })}{!allLessons.length && <p className="mlh-empty-copy">Für dieses Modul sind noch keine Vorlesungen oder Übungen im Stundenplan.</p>}</div>
      <label><span>Lernzeit in Minuten</span><input type="number" min="5" max="360" step="5" value={duration} onChange={event => setDuration(Math.max(5, Math.min(360, Number(event.target.value) || 5)))} /></label>
      <div className="mlh-rating"><span>Wie sicher fühlst du dich?</span>{ratings.map(option => <button key={option.value} className={rating === option.value ? 'active' : ''} onClick={() => setRating(option.value)}>{option.label}</button>)}</div>
      <button className="mlh-primary" disabled={!selectedLessons.length} onClick={() => { onLearnContent(active.id, allLessons.filter(lesson => selectedLessons.includes(lesson.key)), duration, rating); setModal(null) }}>Lernen speichern <ArrowRight size={18} /></button>
    </div></Overlay>}

    {modal === 'history' && <Overlay title="Letzte Aktivitäten" onClose={() => setModal(null)}><ActivityHistory events={events} tasks={tasks} onToggleTask={onToggleTask} onDeleteTask={onDeleteTask} onDeleteActivity={onDeleteActivity}/></Overlay>}
    {modal === 'tasks' && <Overlay title="Erledigte Aufgaben" onClose={() => setModal(null)}><div className="mlh-history-list">{completed.map(task=><article key={task.id}><span><s>{task.title}</s><small>{task.completedAt?new Date(task.completedAt).toLocaleDateString('de-DE'):''}</small></span><div className="mlh-history-actions"><button aria-label={`${task.title} wieder öffnen`} title="Rückgängig" onClick={()=>onToggleTask(task)}><RotateCcw size={17}/></button><button aria-label={`${task.title} löschen`} title="Löschen" onClick={()=>onDeleteTask(task)}><Trash2 size={17}/></button></div></article>)}</div></Overlay>}
  </main>
}
