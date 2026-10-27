import {useState} from 'react'
import {BookOpenCheck,CalendarDays,Check} from 'lucide-react'
import {formatDate,selectedAssessment,type AppData,type StudyModule} from './model'
import UniflowPicker from './UniflowPicker'
import type {StudyDayBundle,StudyPlan,StudySchedulePreferences} from './adaptive-study-plan'
export default function ModuleStudyPlan({data,module,plan,onChange,onStudy}:{data:AppData;module:StudyModule;plan:StudyPlan;onChange:(preferences:StudySchedulePreferences)=>void;onStudy:(keys:string[],duration:number)=>void}){
  const [examId,setExamId]=useState('')
  const exams=data.assessments.filter(exam=>exam.moduleId===module.id&&exam.type==='exam'&&!exam.completed&&(!exam.date||exam.date>=plan.reference)&&selectedAssessment(exam,data.assessments)).sort((a,b)=>(a.date||'9999').localeCompare(b.date||'9999'))
  const exam=exams.find(exam=>exam.id===examId)||exams[0],preferences=plan.preferences
  const bundles=plan.bundles.filter(bundle=>bundle.moduleId===module.id)
  const pending=bundles.filter(bundle=>!bundle.completed).sort((a,b)=>a.date.localeCompare(b.date))
  const completed=bundles.filter(bundle=>bundle.completed).sort((a,b)=>b.date.localeCompare(a.date))
  const notices=plan.notices.filter(notice=>!notice.moduleId||notice.moduleId===module.id)
  const lessons=plan.lessons.filter(lesson=>lesson.moduleId===module.id&&(!exam?.date||lesson.occurrence.date<exam.date))
  const excluded=preferences.excludedByExam[exam?.id||'']||[]
  const render=(bundle:StudyDayBundle)=><article key={bundle.id} className={'study-plan-bundle'+(bundle.completed?' is-completed':'')}>
    <time dateTime={bundle.date}>{bundle.date===plan.reference?'Heute':formatDate(bundle.date,{weekday:'short',day:'numeric',month:'short'})}</time>
    <div><strong>{bundle.items.map(item=>item.label).join(', ')}</strong><small>{bundle.completed?'Gelernt':bundle.items.every(item=>item.target===1)?'Grundlage lernen':bundle.items.every(item=>item.target>=4)?'Wiederholen & festigen':'Lernen & vertiefen'} · ca. {Math.round(bundle.minutes)} Min.</small></div>
    {bundle.completed?<Check size={17}/>:<button type="button" aria-label={'Lernpaket für '+formatDate(bundle.date)+' öffnen'} onClick={()=>onStudy(bundle.items.map(item=>item.key),bundle.minutes)}><BookOpenCheck size={16}/><span>Lernen</span></button>}
  </article>
  return <section className="module-study-plan" aria-label="Dein adaptiver Lernplan">
    <header><CalendarDays size={17}/><h2>Dein Lernplan</h2></header><p className="study-plan-caption">Tage statt fester Uhrzeiten · wird mit deinem Fortschritt neu verteilt</p>
    {!preferences.enabled?<p className="quiet-copy">Aktiviere deinen Lernplan unter Profil → Einstellungen → Lernplan.</p>:<>
      {notices.map((notice,index)=><p key={index} className={notice.severity==='warning'?'study-plan-warning':'quiet-copy'} role={notice.severity==='warning'?'status':undefined}>{notice.message}</p>)}
      {pending.slice(0,7).map(render)}
      {pending.length>7&&<details className="study-plan-more"><summary>Weitere {pending.length-7} Tagespakete</summary>{pending.slice(7).map(render)}</details>}
      {!pending.length&&exams.length>0&&<p className="quiet-copy">Aktuell kein offenes Tagespaket. Dein Plan berücksichtigt Lerntage, verfügbaren Stoff und das tägliche Budget.</p>}
      {completed.length>0&&<details className="study-plan-more"><summary>Bereits gelernt</summary>{completed.map(render)}</details>}
      {exam&&lessons.length>0&&<details className="study-plan-scope"><summary>Prüfungsstoff & Aufwand</summary>
        {exams.length>1&&<UniflowPicker label="Prüfung für den Stoffumfang" value={exam.id} onChange={setExamId} options={exams.map(exam=>({value:exam.id,label:exam.title+(exam.date?' · '+formatDate(exam.date,{day:'numeric',month:'short'}):'') }))}/>}
        <p className="quiet-copy">Nicht relevanten Stoff abwählen. Zeitaufwand pro Einheit optional anpassen; sonst zählt deine bisherige Lerndauer.</p>
        {lessons.map(lesson=><div key={lesson.key} className="study-plan-scope-row"><label><input type="checkbox" checked={!excluded.includes(lesson.key)} onChange={event=>onChange({...preferences,excludedByExam:{...preferences.excludedByExam,[exam.id]:event.target.checked?excluded.filter(key=>key!==lesson.key):[...excluded,lesson.key]}})}/><span>{lesson.label}</span></label><label><input key={lesson.key+':'+(preferences.lessonMinutes[lesson.key]||'auto')} aria-label={'Minuten für '+lesson.label} type="number" min="15" max="120" step="15" placeholder="Auto" defaultValue={preferences.lessonMinutes[lesson.key]||''} onBlur={event=>{const value=event.target.value,parsed=Number(value);const next={...preferences.lessonMinutes};if(!value)delete next[lesson.key];else if(Number.isFinite(parsed)&&parsed>0)next[lesson.key]=Math.max(15,Math.min(120,Math.round(parsed/15)*15));onChange({...preferences,lessonMinutes:next})}}/><span>Min.</span></label></div>)}
      </details>}
    </>}
  </section>
}
