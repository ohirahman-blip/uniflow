import { useEffect, useMemo, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from 'react'
import { ArrowLeft, ArrowRight, BookOpenCheck, Check, ChevronRight, History, PenLine, Plus, Sparkles, Timer, X } from 'lucide-react'
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
  onSession: (session: Omit<LearningSession, 'id' | 'updatedAt'>) => void
  onLearnContent: (moduleId: string, lessons: NumberedLesson[], duration: number, rating: Exclude<LearningRating, 'absent'>) => void
  onEditModule: (moduleId: string) => void
  onCreateModule: () => void
}

type Modal = 'session' | 'content' | 'history' | 'task' | null
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
  return <div className="mlh-overlay" onPointerDown={event => { if (event.target === event.currentTarget) onClose() }}>
    <section className="mlh-sheet" role="dialog" aria-modal="true" aria-label={title}>
      <i className="mlh-sheet-handle" aria-hidden="true" />
      <header><h2>{title}</h2><button onClick={onClose} aria-label="Schließen"><X size={20} /></button></header>
      {children}
    </section>
  </div>
}

function ActivityHistory({ events }: { events: ScoreEvent[] }) {
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
    <b>+{group.points}</b>
  </article>)}</div>
}

export default function ModuleLearningHome({ data, semester, modules, onAddTask, onToggleTask, onSession, onLearnContent, onEditModule, onCreateModule }: Props) {
  const visible = modules.filter(module => !module.hidden && module.status !== 'passed')
  const [index, setIndex] = useState(0)
  const [modal, setModal] = useState<Modal>(null)
  const [duration, setDuration] = useState(45)
  const [rating, setRating] = useState<Exclude<LearningRating, 'absent'>>('understood')
  const [selectedLessons, setSelectedLessons] = useState<string[]>([])
  const [taskTitle, setTaskTitle] = useState('')
  const [taskDate, setTaskDate] = useState('')
  const drag = useRef<{ x: number; y: number } | null>(null)
  const safeIndex = Math.min(index, Math.max(0, visible.length - 1))
  const active = visible[safeIndex]
  const allLessons = useMemo(() => numberedLessons(data, semester, active?.id), [data.offerings, semester, active?.id])
  const checkins = useMemo(() => new Map((data.learningCheckins || []).map(item => [item.key, item])), [data.learningCheckins])
  const learned = useMemo(() => new Set((data.scoreEvents || []).filter(event => event.type === 'content-learned' && !event.reversedAt).map(event => event.sourceId)), [data.scoreEvents])
  const tasks = (data.studyTasks || []).filter(task => task.moduleId === active?.id)
  const pending = tasks.filter(task => !task.completedAt).sort((a, b) => (a.dueDate || '9999').localeCompare(b.dueDate || '9999') || a.createdAt.localeCompare(b.createdAt))
  const lastCompleted = tasks.filter(task => !!task.completedAt).sort((a, b) => (b.completedAt || '').localeCompare(a.completedAt || ''))[0]
  const events = (data.scoreEvents || []).filter(event => event.moduleId === active?.id)
  const switchTo = (next: number) => { setIndex(Math.max(0, Math.min(visible.length - 1, next))); setModal(null); setSelectedLessons([]) }
  const onPointerDown = (event: ReactPointerEvent) => { drag.current = { x: event.clientX, y: event.clientY } }
  const onPointerUp = (event: ReactPointerEvent) => {
    if (!drag.current) return
    const dx = event.clientX - drag.current.x, dy = event.clientY - drag.current.y
    drag.current = null
    if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.2) switchTo(safeIndex + (dx < 0 ? 1 : -1))
  }
  const open = (next: Modal) => { setModal(next); setDuration(45); setRating('understood'); if (next === 'content') setSelectedLessons([]) }
  if (!visible.length) return <main className="screen mlh-empty"><Sparkles size={32} /><h1>Dein Lernbereich</h1><p>Erstelle dein erstes Modul und starte direkt mit 100 Punkten.</p><button onClick={onCreateModule}><Plus size={18} /> Modul erstellen</button></main>
  const accent = { '--mlh-accent': active.color || '#7aa2ff' } as CSSProperties
  return <main className="screen mlh-home" style={accent} onPointerDown={onPointerDown} onPointerUp={onPointerUp}>
    <div className="mlh-glow" aria-hidden="true" />
    <header className="mlh-module-head">
      <button disabled={safeIndex === 0} onClick={() => switchTo(safeIndex - 1)} aria-label="Vorheriges Modul"><ArrowLeft size={21} /></button>
      <div><h1 key={active.id}>{active.name}</h1><i aria-hidden="true" /><span>{active.credits} LP · {semester?.name || 'Aktuelles Semester'}</span></div>
      <button disabled={safeIndex === visible.length - 1} onClick={() => switchTo(safeIndex + 1)} aria-label="Nächstes Modul"><ArrowRight size={21} /></button>
    </header>
    <div className="mlh-dots" aria-label={`Modul ${safeIndex + 1} von ${visible.length}`}>{visible.map((module, position) => <button key={module.id} onClick={() => switchTo(position)} className={position === safeIndex ? 'active' : ''} aria-label={module.name} />)}<button className="mlh-add-module" onClick={onCreateModule} aria-label="Modul hinzufügen"><Plus size={13} /></button></div>

    <button className="mlh-score" onClick={() => open('history')} aria-label={`${scoreTotal(data.scoreEvents, active.id)} Punkte, Aktivitäten öffnen`}>
      <span>DEIN SCORE</span><strong key={`${active.id}-${scoreTotal(data.scoreEvents, active.id)}`}>{scoreTotal(data.scoreEvents, active.id).toLocaleString('de-DE')}</strong><small><History size={14} /> Alle Aktivitäten</small>
    </button>

    <section className="mlh-actions" aria-label="Modulaktionen">
      <button onClick={() => open('session')}><span><Timer size={20} /></span><strong>Lernsession</strong><small>+2 pro Minute</small></button>
      <button onClick={() => open('content')}><span><BookOpenCheck size={20} /></span><strong>Stoff gelernt</strong><small>Einheiten wählen</small></button>
      <button onClick={() => onEditModule(active.id)}><span><PenLine size={20} /></span><strong>Bearbeiten</strong><small>Termine & Prüfungen</small></button>
    </section>

    <section className="mlh-tasks">
      <header><div><span>TO-DOS</span><h2>Als Nächstes</h2></div><button onClick={() => open('task')}><Plus size={18} /> Aufgabe</button></header>
      <div className="mlh-task-stack">
        {pending.length ? pending.map((task, position) => <button key={task.id} className="mlh-task" onClick={() => onToggleTask(task)} style={{ animationDelay: `${position * 45}ms` }}>
          <i aria-hidden="true" /><span><strong>{task.title}</strong><small>{task.dueDate ? formatDate(task.dueDate, { weekday: 'short', day: 'numeric', month: 'short' }) : 'Ohne Termin'}</small></span><b>+{task.points}</b>
        </button>) : <div className="mlh-no-tasks"><Check size={20} /><span><strong>Alles erledigt.</strong><small>Neue Aufgabe hinzufügen oder eine Lernsession starten.</small></span></div>}
      </div>
      {lastCompleted && <button className="mlh-last-done" onClick={() => open('history')}><Check size={15} /><span><small>Zuletzt erledigt</small><strong>{lastCompleted.title}</strong></span><ChevronRight size={17} /></button>}
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

    {modal === 'history' && <Overlay title="Letzte Aktivitäten" onClose={() => setModal(null)}><ActivityHistory events={events} /></Overlay>}
  </main>
}
