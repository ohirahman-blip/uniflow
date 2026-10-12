import { useMemo, useState } from 'react'
import { ArrowRight, BookOpen, CalendarClock, Check, CheckCircle2, ChevronRight, Clock3, GraduationCap, Plus, Sparkles, Target, X } from 'lucide-react'
import { addDays, formatDate, isAssessment, minutes, occurrencesOn, today, uid, type AppData, type Semester, type StudyModule } from './model'
import { deriveLearningJourneys, pastLearningUnits, type LearningCheckin, type LearningKind, type LearningRating, type LearningSession } from './learning'
import './learning-dashboard.css'

type Props = {
  data: AppData
  semester: Semester
  modules: StudyModule[]
  onCheckin: (checkin: LearningCheckin) => void
  onSession: (session: LearningSession) => void
  onModules: () => void
  onOpenModule: (id: string) => void
}
const ratingOptions: { value: LearningRating; text: string; icon: string }[] = [
  { value: 'good', text: 'Verstanden', icon: '✓' },
  { value: 'partial', text: 'Teilweise', icon: '≈' },
  { value: 'unclear', text: 'Nicht verstanden', icon: '×' }
]
const formatMinutes = (duration: number) => duration >= 60 ? `${duration / 60} Std.` : `${duration} Min.`

export default function LearningDashboard({ data, semester, modules, onCheckin, onSession, onModules, onOpenModule }: Props) {
  const journeys = useMemo(() => deriveLearningJourneys(data, semester, modules), [data, semester, modules])
  const units = useMemo(() => pastLearningUnits(data, semester), [data, semester])
  const rated = useMemo(() => new Set((data.learning?.checkins || []).map(c => c.key)), [data.learning])
  const pending = units.filter(u => !rated.has(u.key))
  const freeStudy = useMemo(() => pastLearningUnits(data, semester, today(), true), [data, semester])
  const doneStudy = useMemo(() => new Set((data.learning?.sessions || []).map(s => s.id)), [data.learning])
  const freeStudyPending = freeStudy.filter(u => !doneStudy.has('scheduled-study:' + u.key))
  const [showMore, setShowMore] = useState(false)
  const [addOpen, setAddOpen] = useState(false)
  const [selectedModule, setSelectedModule] = useState('')
  const [target, setTarget] = useState('')
  const [kind, setKind] = useState<LearningKind>('review')
  const [duration, setDuration] = useState(45)
  const [step, setStep] = useState<'details'|'feedback'>('details')
  const [feedback, setFeedback] = useState<LearningRating>('good')

  const next = useMemo(() => {
    const now = new Date()
    for (let i = 0; i < 15; i++) {
      const date = addDays(today(), i)
      const upcoming = occurrencesOn(data.offerings, date)
        .filter(o => o.offering.semesterId === semester.id && !isAssessment(o.offering.category) && o.offering.category !== 'Freies Lernen')
        .filter(o => i > 0 || new Date(now.getFullYear(), now.getMonth(), now.getDate(), Number(o.to.slice(0,2)), Number(o.to.slice(3,5))) > now)
      if (upcoming.length) return upcoming[0]
    }
    return undefined
  }, [data.offerings, semester.id])

  const examJourneys = journeys.filter(j => j.examDate)
  const urgent = examJourneys[0]
  const startSession = () => {
    setSelectedModule(urgent?.module.id || modules[0]?.id || '')
    setTarget('')
    setDuration(45)
    setKind('review')
    setFeedback('good')
    setStep('details')
    setAddOpen(true)
  }
  const picked = journeys.find(j => j.module.id === selectedModule)
  const saveSession = () => {
    if (!selectedModule || !Number.isFinite(duration) || duration < 5 || duration > 480) return
    onSession({ id: uid(), moduleId: selectedModule, semesterId: semester.id, date: today(),
      duration, kind, targetKey: kind === 'review' ? target || undefined : undefined,
      outcome: feedback, createdAt: Date.now() })
    setAddOpen(false)
    setStep('details')
  }
  return <main className="screen secondary-screen learning-dashboard">
    <div className="learning-heading">
      <div><span className="overline">DEIN STUDIUM IM BLICK</span><h1>Dein Tag<span className="learning-period">.</span></h1><p>{formatDate(today(), { weekday:'long', day:'numeric', month:'long' })} · {semester.name}</p></div>
      <button className="learning-quick-button" onClick={startSession}><Plus size={17}/> Freies Lernen</button>
    </div>

    <div className="learning-overview">
      <section className="learning-next">
        <div className="learning-card-eyebrow"><Clock3 size={14}/> ALS NÄCHSTES</div>
        {next ? <><strong>{modules.find(m=>m.id===next.offering.moduleId)?.name || next.offering.name}</strong>
          <p>{formatDate(next.date, {weekday:'short',day:'numeric',month:'short'})} · {next.from}–{next.to}{next.offering.room ? ` · ${next.offering.room}` : ''}</p></>
          : <><strong>Alles erledigt für heute.</strong><p>Gerade ist keine nächste Veranstaltung eingeplant.</p></>}
      </section>
      <section className="learning-next learning-focus">
        <div className="learning-card-eyebrow"><Target size={14}/> LERNFOKUS</div>
        {urgent ? <><strong>{urgent.module.name}</strong><p>Klausur in {urgent.daysToExam} Tagen · Priorität vor späteren Prüfungen</p></>
          : <><strong>In deinem Tempo.</strong><p>Kein anstehender Klausurtermin – wiederhole offene Themen.</p></>}
      </section>
    </div>

    <div className="learning-section-head"><div><span className="overline">NACH DEN VORLESUNGEN</span><h2>Kurzer Check-in</h2></div>{pending.length+freeStudyPending.length>3&&<button onClick={()=>setShowMore(v=>!v)}>{showMore?'Weniger':'Alle '+(pending.length+freeStudyPending.length)} <ChevronRight size={15}/></button>}</div>
    {(pending.length || freeStudyPending.length) ? <div className="learning-checkins">{pending.slice(0,showMore?12:3).map(u => <article className="learning-checkin" key={u.key}>
      <div className="learning-checkin-top"><span>{modules.find(m=>m.id===u.moduleId)?.name || 'Modul'}</span><small>{formatDate(u.date,{day:'numeric',month:'short'})} · {u.label}</small></div>
      <h3>Wie gut hast du diese Einheit verstanden?</h3>
      <div className="learning-rating-row">{ratingOptions.map(option => <button key={option.value}
        className={'learning-rating '+option.value} onClick={()=>onCheckin({key:u.key,moduleId:u.moduleId,semesterId:semester.id,date:u.date,rating:option.value,updatedAt:Date.now()})}>
        <span>{option.icon}</span>{option.text}</button>)}</div>
    </article>)}
    {freeStudyPending.slice(0,showMore?12:3).map(u=><article className="learning-checkin learning-study-checkin" key={u.key}>
      <div className="learning-checkin-top"><span>Freies Lernen · {modules.find(m=>m.id===u.moduleId)?.name||'Modul'}</span><small>{formatDate(u.date,{day:'numeric',month:'short'})} · {u.from}–{u.to}</small></div>
      <h3>Wie gut lief deine Lerneinheit?</h3>
      <div className="learning-rating-row">{ratingOptions.map(option=><button className={'learning-rating '+option.value} key={option.value}
        onClick={()=>onSession({id:'scheduled-study:'+u.key,moduleId:u.moduleId,semesterId:semester.id,date:u.date,duration:Math.max(5,minutes(u.to)-minutes(u.from)),kind:'review',outcome:option.value,createdAt:Date.now()})}>
        <span>{option.icon}</span>{option.text}</button>)}</div>
    </article>)}</div> : <div className="learning-all-clear"><CheckCircle2 size={19}/> Keine offenen Check-ins. Sehr gut!</div>}

    <div className="learning-section-head"><div><span className="overline">DEINE LERNREISE</span><h2>Deine Module</h2></div><button onClick={onModules}>Alle Module <ArrowRight size={15}/></button></div>
    {journeys.length ? <div className="learning-module-grid">{journeys.map(j => <button key={j.module.id} className="learning-module-card" onClick={()=>onOpenModule(j.module.id)}>
      <div className="learning-module-head"><span className="learning-module-dot" style={{background:j.module.color}}/><strong>{j.module.name}</strong>{j.examDate&&<span className="learning-exam-tag"><CalendarClock size={12}/> {j.daysToExam} T.</span>}</div>
      <p>{j.status}</p>
      <div className="learning-track"><span style={{width:`${j.preparation??0}%`,background:j.module.color}}/></div>
      <div className="learning-module-foot"><small>{j.rated ? `${j.rated} Einschätzungen · ${j.evidence}% erfasst`:'Noch keine Einschätzungen'}</small><span>{j.preparation===null?'–':j.preparation+'%'} <ChevronRight size={14}/></span></div>
    </button>)}</div> : <div className="learning-all-clear"><BookOpen size={18}/> Füge zuerst ein Modul hinzu, um deine Lernreise zu beginnen.</div>}

    {journeys.length>0&&<section className="learning-recommendation">
      <div className="learning-recommendation-title"><Sparkles size={17}/> Dein nächster Schritt</div>
      <strong>{journeys[0].module.name}</strong>
      <p>{journeys[0].advice}</p>
      <button onClick={startSession}>Lerneinheit erfassen <ArrowRight size={15}/></button>
    </section>}

    {addOpen&&<div className="learning-modal-backdrop" onMouseDown={e=>{if(e.target===e.currentTarget)setAddOpen(false)}}>
      <section className="learning-modal" role="dialog" aria-modal="true" aria-label="Freies Lernen erfassen">
        <div className="learning-modal-head"><div><span className="overline">DEINE LERNREISE</span><h2>Freies Lernen</h2></div><button aria-label="Schließen" onClick={()=>setAddOpen(false)}><X size={20}/></button></div>
        {step==='details' ? <>
          <label>Modul<select value={selectedModule} onChange={e=>{setSelectedModule(e.target.value);setTarget('')}}>{modules.map(m=><option key={m.id} value={m.id}>{m.name}</option>)}</select></label>
          <label>Was hast du gelernt?<select value={kind} onChange={e=>{setKind(e.target.value as LearningKind);setTarget('')}}><option value="review">Stoff wiederholt / verstanden</option><option value="exam">Klausuraufgaben / Selbsttest</option></select></label>
          {kind==='review'&&<label>Thema (optional)<select value={target} onChange={e=>setTarget(e.target.value)}><option value="">Allgemeines Lernen</option>{picked?.units.map(u=><option key={u.key} value={u.key}>{u.label} · {formatDate(u.date,{day:'numeric',month:'short'})}</option>)}</select><small>Ein zugeordnetes Thema kann eine frühere Verständnislücke ausgleichen.</small></label>}
          <label>Dauer<select value={duration} onChange={e=>setDuration(Number(e.target.value))}>{[15,30,45,60,90,120,180,240].map(m=><option value={m} key={m}>{formatMinutes(m)}</option>)}</select></label>
          <button className="learning-modal-primary" disabled={!selectedModule} onClick={()=>setStep('feedback')}>Weiter <ArrowRight size={17}/></button>
        </>:<>
          <p className="learning-modal-copy">Wie gut hat das Lernen funktioniert? Die Dauer allein erhöht nicht deinen Verständniswert.</p>
          <div className="learning-modal-ratings">{ratingOptions.map(option=><button className={feedback===option.value?'active':''} key={option.value} onClick={()=>setFeedback(option.value)}><span>{option.icon}</span>{option.text}</button>)}</div>
          <div className="learning-modal-footer"><button onClick={()=>setStep('details')}>Zurück</button><button className="learning-modal-primary" onClick={saveSession}><Check size={16}/> Speichern</button></div>
        </>}
        <p className="learning-modal-note"><GraduationCap size={15}/> Dein Lernstand ist eine Orientierung, keine Notenprognose.</p>
      </section>
    </div>}
  </main>
}
