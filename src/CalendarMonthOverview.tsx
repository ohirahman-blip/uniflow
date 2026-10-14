import type { CSSProperties } from 'react'
import { ArrowLeft, CalendarCheck2, ClipboardList, GraduationCap } from 'lucide-react'
import { formatDate, selectedAssessment, today, type Assessment, type StudyModule } from './model'
import { calendarMonthDates } from './calendar-month'
import './calendar-month.css'
type Props={anchor:string;semesterId:string;assessments:Assessment[];modules:StudyModule[];
  onBack:()=>void;onSelectDate:(date:string)=>void;onSelectAssessment:(a:Assessment)=>void}
const weekdays=['Mo','Di','Mi','Do','Fr','Sa','So']
export default function CalendarMonthOverview({anchor,semesterId,assessments,modules,onBack,onSelectDate,onSelectAssessment}:Props){
  const month=anchor.slice(0,7)
  const byDate=new Map<string,Assessment[]>()
  for(const item of assessments){
    if(item.semesterId!==semesterId)continue
    if(!selectedAssessment(item,assessments))continue
    const list=byDate.get(item.date)||[]
    list.push(item)
    byDate.set(item.date,list)
  }
  const colors=new Map(modules.map(m=>[m.id,m.color]))
  return <section className="uf-month" aria-label="Monatsübersicht für Prüfungen und Hausaufgaben">
    <div className="uf-month-heading"><div><span>MONATSÜBERSICHT</span>
      <h2>{formatDate(month+'-01',{month:'long',year:'numeric'})}</h2></div>
      <button type="button" className="uf-month-back" onClick={onBack}><ArrowLeft size={16}/> Zum Stundenplan</button>
    </div>
    <div className="uf-month-weekdays" aria-hidden="true">{weekdays.map(w=><span key={w}>{w}</span>)}</div>
    <div className="uf-month-grid">{calendarMonthDates(anchor).map(date=>{
      const entries=byDate.get(date)||[]
      return <div className={'uf-month-cell'+(date.slice(0,7)===month?'':' other-month')+(date===today()?' is-today':'')} key={date}>
        <button type="button" className="uf-month-day" onClick={()=>onSelectDate(date)}
          aria-label={formatDate(date,{weekday:'long',day:'numeric',month:'long'})+' im Stundenplan anzeigen'}>{Number(date.slice(-2))}</button>
        <div className="uf-month-assessments">{entries.map(item=><button type="button" key={item.id}
          className={'uf-month-pill '+(item.type==='exam'?'exam':'homework')+(item.completed?' complete':'')}
          style={{'--month-accent':colors.get(item.moduleId)||'#aa9cbd'} as CSSProperties}
          title={(item.type==='exam'?'Prüfung: ':'Hausaufgabe: ')+item.title}
          onClick={()=>onSelectAssessment(item)}>
          {item.type==='exam'?<GraduationCap size={11}/>:<ClipboardList size={11}/>}<span>{item.title}</span>
        </button>)}</div>
      </div>
    })}</div>
    <div className="uf-month-legend"><span><CalendarCheck2 size={14}/> Nur Prüfungen und Hausaufgaben</span></div>
  </section>
}
