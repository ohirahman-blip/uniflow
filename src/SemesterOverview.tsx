import {useId} from 'react'
import type {AppData,Assessment,Semester,StudyModule} from './model'
import type {StudyPlan,StudySchedulePreferences} from './adaptive-study-plan'
import ExamTimeline from './ExamTimeline'
import ModuleStudyPlan from './ModuleStudyPlan'
import {useSemesterTimelineMotion} from './useSemesterTimelineMotion'

export default function SemesterOverview({data,semester,module,plan,onOpen,onToggle,onChange,onStudy}:{data:AppData;semester?:Semester;module:StudyModule;plan:StudyPlan;onOpen:(exam:Assessment)=>void;onToggle:(exam:Assessment)=>void;onChange:(preferences:StudySchedulePreferences)=>void;onStudy:(keys:string[],minutes:number)=>void}){
  const {view,requested,phase,panelRef,railRef,changeView}=useSemesterTimelineMotion(data,plan)
  const id=useId()
  return <section className="semester-overview">
    <ExamTimeline display="cards" data={data} semester={semester} module={module} onOpen={onOpen} onToggle={onToggle}/>
    <header className="semester-overview-heading"><h3>Dein Semester im Blick</h3><div className="semester-overview-tabs" data-view={requested} role="tablist" aria-label="Semesteransicht">
      {([{id:'exams',label:'Prüfungen'},{id:'plan',label:'Lernplan'}] as const).map(item=><button key={item.id} id={id+'-'+item.id} role="tab" aria-selected={requested===item.id} aria-controls={id+'-panel'} tabIndex={requested===item.id?0:-1} onClick={()=>changeView(item.id)} onKeyDown={event=>{if(event.key==='ArrowLeft'||event.key==='ArrowRight'){event.preventDefault();changeView(requested==='exams'?'plan':'exams');event.currentTarget.parentElement?.querySelector<HTMLButtonElement>('[id="'+id+'-'+(requested==='exams'?'plan':'exams')+'"]')?.focus()}}}>{item.label}</button>)}
    </div></header>
    <div ref={panelRef} id={id+'-panel'} role="tabpanel" aria-labelledby={id+'-'+view} tabIndex={0} className={'semester-overview-panel phase-'+phase} data-view={view} aria-busy={phase==='exit'}>
      <div ref={railRef} className="semester-shared-axis" aria-hidden="true"><i/><i/><i/></div>
      {view==='exams'?<><p className="study-plan-caption">Prüfungen im Vergleich zu deinen anderen Modulen</p><ExamTimeline display="timeline" data={data} semester={semester} module={module} onOpen={onOpen} onToggle={onToggle}/>{!data.assessments.some(exam=>exam.moduleId===module.id&&exam.semesterId===semester?.id&&exam.type==='exam')&&<p className="quiet-copy">Noch keine Prüfung für dieses Modul.</p>}</>:<ModuleStudyPlan timeline data={data} module={module} plan={plan} onChange={onChange} onStudy={onStudy} onExamOpen={onOpen}/>}
    </div>
  </section>
}
