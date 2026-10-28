import type { CSSProperties } from 'react'
import { ArrowUpRight, Check, GraduationCap } from 'lucide-react'
import { formatDate, fromDate, selectedAssessment, today, type AppData, type Assessment, type Semester, type StudyModule } from './model'

type Props={display?:'all'|'cards'|'timeline';data:AppData;semester?:Semester;module:StudyModule;onOpen:(exam:Assessment)=>void;onToggle:(exam:Assessment)=>void}
const day=(value:string)=>fromDate(value).getTime()

export default function ExamTimeline({display='all',data,semester,module,onOpen,onToggle}:Props){
  if(!semester)return null
  const exams=data.assessments.filter(exam=>exam.semesterId===semester.id&&exam.type==='exam'&&selectedAssessment(exam,data.assessments)).sort((a,b)=>a.date.localeCompare(b.date))
  const own=exams.filter(exam=>exam.moduleId===module.id)
  if(!own.length)return null
  const start=day(semester.start),end=Math.max(day(semester.end),...exams.filter(exam=>exam.date).map(exam=>day(exam.date)))
  const target=own.find(exam=>!exam.completed&&exam.date>=today())||own[own.length-1]
  type Month={date:string;label:string;endLabel:string;from:number;to:number;exams:Assessment[];gap:boolean;height:number}
  const months:Month[]=[]
  let cursor=new Date(fromDate(semester.start).getFullYear(),fromDate(semester.start).getMonth(),1,12)
  for(let i=0;i<24&&cursor.getTime()<=end;i++){
    const date=`${cursor.getFullYear()}-${String(cursor.getMonth()+1).padStart(2,'0')}-01`
    const next=new Date(cursor.getFullYear(),cursor.getMonth()+1,1,12),label=cursor.toLocaleDateString('de-DE',{month:'short',year:'2-digit'})
    const items=exams.filter(exam=>exam.date.slice(0,7)===date.slice(0,7))
    months.push({date,label,endLabel:label,from:Math.max(start,cursor.getTime()),to:Math.min(end,next.getTime()),exams:items,gap:false,height:Math.max(74,items.length*44+24)})
    cursor=next
  }
  const rows:Month[]=[]
  for(const [index,month] of months.entries()){
    const empty=!month.exams.length&&month.date.slice(0,7)!==today().slice(0,7)&&index>0&&index<months.length-1
    const previous=rows[rows.length-1]
    if(empty&&previous?.gap){previous.to=month.to;previous.endLabel=month.label}
    else rows.push({...month,gap:empty,height:empty?32:month.height})
  }
  const totalHeight=rows.reduce((sum,row)=>sum+row.height,0)
  const top=(index:number)=>rows.slice(0,index).reduce((sum,row)=>sum+row.height,0)
  const positionAt=(time:number)=>{
    if(time<=start)return 0
    if(time>=end)return 100
    const index=rows.findIndex(row=>time>=row.from&&time<row.to)
    if(index<0)return 100
    const row=rows[index],fraction=(time-row.from)/Math.max(1,row.to-row.from)
    return (top(index)+fraction*row.height)/Math.max(1,totalHeight)*100
  }
  const targetTime=target.date?day(target.date):day(semester.end)
  const targetPosition=positionAt(targetTime),nowPosition=positionAt(day(today()))
  const firstPhase=positionAt(start+(targetTime-start)/3),secondPhase=positionAt(start+(targetTime-start)*2/3)
  return <section className={display==='timeline'?'semester-exam-timeline':'mlh-exams'} aria-label="Prüfungen und Semesterzeitstrahl">
    {display!=='timeline'&&<><header><GraduationCap size={17}/><h2>Prüfungen</h2></header>
    <div className="mlh-exam-cards">{own.map(exam=><article key={exam.id} className={'mlh-exam-row'+(exam.completed?' is-completed':'')}><button className="mlh-exam-check" role="checkbox" aria-checked={!!exam.completed} aria-label={exam.completed?exam.title+' wieder öffnen':exam.title+' als erledigt markieren'} onClick={()=>onToggle(exam)}><i>{exam.completed&&<Check size={12}/>}</i></button><button className="mlh-exam-open" aria-label={exam.title+' ansehen'} onClick={()=>onOpen(exam)}><span><strong>{exam.title}</strong><small>{exam.date?formatDate(exam.date,{day:'numeric',month:'long'}):'Termin offen'}{exam.from?' · '+exam.from:''}</small></span><ArrowUpRight size={18}/></button></article>)}</div></>}
    {display==='all'&&<div className="mlh-timeline-heading"><h3>Dein Semester im Blick</h3><span>Grobe Orientierung bis {target.title}</span></div>}
    {display!=='cards'&&<div className="mlh-timeline" style={{height:Math.max(260,totalHeight)} as CSSProperties}>
      <div className="mlh-timeline-axis" aria-hidden="true"><div className="mlh-timeline-phases"><i style={{height:`${firstPhase}%`}}/><i style={{height:`${secondPhase-firstPhase}%`}}/><i style={{height:`${targetPosition-secondPhase}%`}}/></div></div>
      {rows.map((month,index)=><div key={month.date} className={'mlh-timeline-month'+(month.gap?' is-gap':'')} style={{top:`${top(index)/Math.max(1,totalHeight)*100}%`}}><time>{month.gap&&month.label!==month.endLabel?`${month.label}–${month.endLabel}`:month.label}</time><i/><div>{month.gap?<span className="mlh-timeline-break" aria-label="Zeitraum ohne Prüfungen zusammengefasst">···</span>:month.exams.map(exam=>{const subject=data.modules.find(item=>item.id===exam.moduleId);return <button key={exam.id} className={(exam.moduleId===module.id?'is-own':'')+(exam.completed?' is-completed':'')} aria-label={exam.completed?`${exam.title}, erledigt`:exam.title} onClick={()=>onOpen(exam)} style={{'--exam-color':subject?.color||'#aaa'} as CSSProperties}><strong>{subject?.shortName||subject?.name||exam.title}</strong><small>{formatDate(exam.date,{day:'numeric',month:'short'})} · {exam.title}</small></button>})}</div></div>)}
      <div className="mlh-timeline-now" style={{top:`${nowPosition}%`}}><span>Heute</span><i/></div>
    </div>}
  </section>
}
