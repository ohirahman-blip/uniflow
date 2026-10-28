import {useMemo,useState} from 'react'
import {BookOpenCheck,CalendarDays,Check,ChevronDown,RotateCcw} from 'lucide-react'
import {addDays,formatDate,selectedAssessment,type AppData,type Assessment,type StudyModule} from './model'
import UniflowPicker from './UniflowPicker'
import StudyPlanTimeline from './StudyPlanTimeline'
import {lessonProgressMap} from './lesson-progress'
import {lessonDifficultyFor,pendingReviewKeys,type LessonDifficulty} from './adaptive-study-plan'
import type {StudyDayBundle,StudyPlan,StudySchedulePreferences} from './adaptive-study-plan'
export default function ModuleStudyPlan({timeline=false,onExamOpen,data,module,plan,onChange,onStudy}:{timeline?:boolean;onExamOpen?:(exam:Assessment)=>void;data:AppData;module:StudyModule;plan:StudyPlan;onChange:(preferences:StudySchedulePreferences)=>void;onStudy:(keys:string[],duration:number)=>void}){
  const [examId,setExamId]=useState('')
  const exams=data.assessments.filter(exam=>exam.moduleId===module.id&&exam.type==='exam'&&!exam.completed&&(!exam.date||exam.date>=plan.reference)&&selectedAssessment(exam,data.assessments)).sort((a,b)=>(a.date||'9999').localeCompare(b.date||'9999'))
  const exam=exams.find(exam=>exam.id===examId)||exams[0],preferences=plan.preferences
  const bundles=plan.bundles.filter(bundle=>bundle.moduleId===module.id)
  const pending=bundles.filter(bundle=>!bundle.completed).sort((a,b)=>a.date.localeCompare(b.date))
  const completed=bundles.filter(bundle=>bundle.completed).sort((a,b)=>b.date.localeCompare(a.date))
  const notices=plan.notices.filter(notice=>!notice.moduleId||notice.moduleId===module.id)
  const lessons=plan.lessons.filter(lesson=>lesson.moduleId===module.id&&(!exam?.date||lesson.occurrence.date<exam.date))
  const progress=useMemo(()=>lessonProgressMap(data),[data.learningSessions,data.learningCheckins,data.scoreEvents])
  const reviews=useMemo(()=>pendingReviewKeys(data,preferences),[data.learningSessions,data.scoreEvents,preferences.reviewAfter])
  const openLessons=lessons.filter(lesson=>(progress.get(lesson.key)?.green||0)<4||reviews.has(lesson.key))
  const masteredLessons=lessons.filter(lesson=>(progress.get(lesson.key)?.green||0)>=4&&!reviews.has(lesson.key))
  const excluded=preferences.excludedByExam[exam?.id||'']||[]
  const render=(bundle:StudyDayBundle)=><article key={bundle.id} className={'study-plan-bundle'+(bundle.completed?' is-completed':'')}>
    <time dateTime={bundle.date}>{bundle.date===plan.reference?'Heute':formatDate(bundle.date,{weekday:'short',day:'numeric',month:'short'})}</time>
    <div><strong>{bundle.items.map(item=>item.label).join(', ')}</strong><small>{bundle.completed?'Gelernt':bundle.items.every(item=>item.target<=2)?'Grundlage lernen':bundle.items.every(item=>item.target>=4)?'Wiederholen & festigen':'Lernen & vertiefen'} · ca. {Math.round(bundle.minutes)} Min.</small></div>
    {bundle.completed?<Check size={17}/>:<button type="button" aria-label={'Lernpaket für '+formatDate(bundle.date)+' öffnen'} onClick={()=>onStudy(bundle.items.map(item=>item.key),bundle.minutes)}><BookOpenCheck size={16}/><span>Lernen</span></button>}
  </article>
  const timelineExams=data.assessments.filter(exam=>exam.moduleId===module.id&&exam.type==='exam'&&exam.date&&exam.date>=addDays(plan.reference,-14)&&selectedAssessment(exam,data.assessments))
  const renderLesson=(lesson:typeof lessons[number],mastered=false)=><li key={lesson.key} className={'study-scope-list-row'+(excluded.includes(lesson.key)?' is-excluded':'')}>
    <label><input type="checkbox" checked={!excluded.includes(lesson.key)} onChange={event=>onChange({...preferences,excludedByExam:{...preferences.excludedByExam,[exam!.id]:event.target.checked?excluded.filter(key=>key!==lesson.key):[...excluded,lesson.key]}})}/><span><strong>{lesson.label}</strong><small>{mastered?'Gefestigt':reviews.has(lesson.key)?'Wiederholung eingeplant':progress.get(lesson.key)?.label||'Noch nicht gelernt'}</small></span></label>
    {mastered?<button className="study-review-again" type="button" aria-label={lesson.label+' wieder einplanen'} onClick={()=>onChange({...preferences,reviewAfter:{...preferences.reviewAfter,[lesson.key]:new Date().toISOString()}})}><RotateCcw size={14}/><span>Wieder einplanen</span></button>:<UniflowPicker label={'Lernaufwand für '+lesson.label} value={lessonDifficultyFor(preferences,lesson.key)} onChange={value=>onChange({...preferences,lessonDifficulty:{...preferences.lessonDifficulty,[lesson.key]:value as LessonDifficulty}})} options={[{value:'easy',label:'Leicht',detail:'30 Min. Planungsschätzung'},{value:'medium',label:'Mittel',detail:'60 Min. Planungsschätzung'},{value:'hard',label:'Schwer',detail:'120 Min. Planungsschätzung'}]}/>}
  </li>
  return <section className={'module-study-plan'+(timeline?' is-timeline':'')} aria-label="Dein adaptiver Lernplan">
    {!timeline&&<header><CalendarDays size={17}/><h2>Dein Lernplan</h2></header>}<p className="study-plan-caption">Tage statt fester Uhrzeiten · wird mit deinem Fortschritt neu verteilt</p>
    {!preferences.enabled?<p className="quiet-copy">Aktiviere deinen Lernplan unter Profil → Einstellungen → Lernplan.</p>:<>
      {notices.map((notice,index)=><p key={index} className={notice.severity==='warning'?'study-plan-warning':'quiet-copy'} role={notice.severity==='warning'?'status':undefined}>{notice.message}</p>)}
      {timeline?<StudyPlanTimeline data={data} module={module} plan={plan} exams={timelineExams} onStudy={onStudy} onExamOpen={onExamOpen}/>:pending.slice(0,7).map(render)}
      {!timeline&&pending.length>7&&<details className="study-plan-more"><summary>Weitere {pending.length-7} Tagespakete</summary>{pending.slice(7).map(render)}</details>}
      {!pending.length&&exams.length>0&&<p className="quiet-copy">Aktuell kein offenes Tagespaket. Dein Plan berücksichtigt Lerntage, verfügbaren Stoff und vollständige Lernblöcke.</p>}
      {!timeline&&completed.length>0&&<details className="study-plan-more"><summary>Bereits gelernt</summary>{completed.map(render)}</details>}
      {exam&&lessons.length>0&&<details className="study-plan-scope"><summary><span>Prüfungsstoff</span><ChevronDown size={16}/></summary><div className="study-scope-content">
        {exams.length>1&&<UniflowPicker label="Prüfung für den Stoffumfang" value={exam.id} onChange={setExamId} options={exams.map(exam=>({value:exam.id,label:exam.title+(exam.date?' · '+formatDate(exam.date,{day:'numeric',month:'short'}):'') }))}/>}
        <ul className="study-scope-list">{openLessons.map(lesson=>renderLesson(lesson))}</ul>
        {!openLessons.length&&<p className="quiet-copy">Kein offener Stoff in dieser Auswahl.</p>}
        {masteredLessons.length>0&&<details className="study-mastered"><summary><span>Gefestigter Stoff · {masteredLessons.length}</span><ChevronDown size={15}/></summary><ul className="study-scope-list">{masteredLessons.map(lesson=>renderLesson(lesson,true))}</ul></details>}
        </div>
      </details>}
    </>}
  </section>
}
