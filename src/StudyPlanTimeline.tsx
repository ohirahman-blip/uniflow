import type {CSSProperties} from 'react'
import {BookOpenCheck,Check} from 'lucide-react'
import {formatDate,type AppData,type Assessment,type StudyModule} from './model'
import type {StudyPlan} from './adaptive-study-plan'
import {learningTimelineRows} from './study-plan-timeline'
export default function StudyPlanTimeline({data,module,plan,exams,onStudy,onExamOpen}:{data:AppData;module:StudyModule;plan:StudyPlan;exams:Assessment[];onStudy:(keys:string[],minutes:number)=>void;onExamOpen?:(exam:Assessment)=>void}){
  const semester=data.semesters.find(item=>item.id===exams.find(exam=>!exam.completed&&exam.date>=plan.reference)?.semesterId)||data.semesters.find(item=>item.id===data.activeSemesterId)
  const rows=learningTimelineRows(plan,module.id,exams,semester?.start||plan.reference)
  return <div className="mlh-timeline study-learning-timeline" aria-label="Lernzeitstrahl mit zusammengefassten freien Zeiträumen">
    <div className="mlh-timeline-axis" aria-hidden="true"/>
    {rows.map(row=><div key={(row.gap?'gap:':'day:')+row.date} className={'mlh-timeline-month study-plan-timeline-row'+(row.gap?' is-gap':'')+(row.today?' is-today':'')} data-intensity={row.intensity} style={{'--study-line-color':row.intensity===2?'var(--mlh-accent)':row.intensity===1?'color-mix(in srgb,var(--mlh-accent) 38%,var(--muted))':'var(--muted)'} as CSSProperties}>
      <time dateTime={row.date}>{formatDate(row.date,{day:'numeric',month:'short'})}{row.to&&<><br/>– {formatDate(row.to,{day:'numeric',month:'short'})}</>}{row.today&&<small>Heute</small>}</time><i aria-hidden="true"/>
      <div className="study-plan-timeline-content">
        {row.gap?<span className="mlh-timeline-break" aria-label="Zeitraum ohne Lernpakete zusammengefasst">···</span>:<>
          {row.today&&<div className="study-plan-axis-now" aria-hidden="true"><i/></div>}
          {row.start&&!row.bundles.length&&!row.exams.length&&<small className="study-plan-start">Semesterbeginn</small>}
          {row.bundles.map(bundle=><article key={bundle.id} className={'study-plan-timeline-item'+(bundle.completed?' is-completed':'')}><div><strong>{bundle.items.map(item=>item.label).join(', ')}</strong><small>{bundle.completed?'Gelernt':bundle.items.every(item=>item.target<=2)?'Grundlage lernen':bundle.items.every(item=>item.target>=4)?'Wiederholen & festigen':'Lernen & vertiefen'} · ca. {Math.round(bundle.minutes)} Min.</small></div>{bundle.completed?<Check size={15}/>:<button type="button" aria-label={'Lernpaket für '+formatDate(bundle.date)+' öffnen'} onClick={()=>onStudy(bundle.items.map(item=>item.key),bundle.minutes)}><BookOpenCheck size={16}/></button>}</article>)}
          {row.exams.map(exam=><button key={exam.id} className={'is-own study-plan-timeline-exam'+(exam.completed?' is-completed':'')} onClick={()=>onExamOpen?.(exam)} aria-label={exam.title+(exam.completed?', erledigt':'')}><strong>{exam.title}</strong><small>{formatDate(exam.date,{day:'numeric',month:'short'})}{exam.from?' · '+exam.from:''}</small></button>)}
        </>}
      </div>
    </div>)}
  </div>
}
