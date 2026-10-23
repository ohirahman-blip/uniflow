import type { CSSProperties } from 'react'
import { ArrowUpRight, GraduationCap } from 'lucide-react'
import { formatDate, fromDate, selectedAssessment, today, type AppData, type Assessment, type Semester, type StudyModule } from './model'

type Props={data:AppData;semester?:Semester;module:StudyModule;onOpen:(exam:Assessment)=>void}
const day=(value:string)=>fromDate(value).getTime()

export default function ExamTimeline({data,semester,module,onOpen}:Props){
  if(!semester)return null
  const exams=data.assessments.filter(exam=>exam.semesterId===semester.id&&exam.type==='exam'&&selectedAssessment(exam,data.assessments)).sort((a,b)=>a.date.localeCompare(b.date))
  const own=exams.filter(exam=>exam.moduleId===module.id)
  if(!own.length)return null
  const start=day(semester.start),end=Math.max(day(semester.end),...exams.map(exam=>day(exam.date))),span=Math.max(86400000,end-start)
  const position=(date:string)=>Math.max(0,Math.min(100,(day(date)-start)/span*100))
  const target=own.find(exam=>!exam.completed&&exam.date>=today())||own[own.length-1]
  const targetPosition=position(target.date),nowPosition=position(today())
  const months:{date:string;label:string;exams:Assessment[]}[]=[]
  let cursor=new Date(fromDate(semester.start).getFullYear(),fromDate(semester.start).getMonth(),1,12)
  for(let i=0;i<24&&cursor.getTime()<=end;i++){
    const date=`${cursor.getFullYear()}-${String(cursor.getMonth()+1).padStart(2,'0')}-01`
    months.push({date,label:cursor.toLocaleDateString('de-DE',{month:'short',year:'2-digit'}),exams:exams.filter(exam=>exam.date.slice(0,7)===date.slice(0,7))})
    cursor=new Date(cursor.getFullYear(),cursor.getMonth()+1,1,12)
  }
  return <section className="mlh-exams" aria-label="Prüfungen und Semesterzeitstrahl">
    <header><GraduationCap size={17}/><h2>Prüfungen</h2></header>
    <div className="mlh-exam-cards">{own.map(exam=><button key={exam.id} onClick={()=>onOpen(exam)}><span><strong>{exam.title}</strong><small>{formatDate(exam.date,{day:'numeric',month:'long'})}{exam.from?` · ${exam.from}`:''}</small></span><ArrowUpRight size={18}/></button>)}</div>
    <div className="mlh-timeline-heading"><h3>Dein Semester im Blick</h3><span>Grobe Orientierung bis {target.title}</span></div>
    <div className="mlh-timeline" style={{height:Math.max(330,months.length*Math.max(72,...months.map(month=>month.exams.length*42+24))),'--exam-position':`${targetPosition}%`} as CSSProperties}>
      <div className="mlh-timeline-axis" aria-hidden="true"><div className="mlh-timeline-phases"><i/><i/><i/></div></div>
      {months.map(month=><div key={month.date} className="mlh-timeline-month" style={{top:`${position(month.date)}%`}}><time>{month.label}</time><i/><div>{month.exams.map(exam=>{const subject=data.modules.find(item=>item.id===exam.moduleId);return <button key={exam.id} className={exam.moduleId===module.id?'is-own':''} onClick={()=>onOpen(exam)} style={{'--exam-color':subject?.color||'#aaa'} as CSSProperties}><strong>{subject?.shortName||subject?.name||exam.title}</strong><small>{formatDate(exam.date,{day:'numeric',month:'short'})} · {exam.title}</small></button>})}</div></div>)}
      <div className="mlh-timeline-now" style={{top:`${nowPosition}%`}}><span>Heute</span><i/></div>
    </div>
    <div className="mlh-phase-legend"><span><i/>Stoff lernen</span><span><i/>Intensiv wiederholen</span><span><i/>Klausurvorbereitung</span></div>
  </section>
}
