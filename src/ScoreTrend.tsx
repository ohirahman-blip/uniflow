import {useMemo} from 'react'
import {formatDate,today,type AppData,type Semester} from './model'
import {scoreTrend} from './score-trend'
import './score-trend.css'
export default function ScoreTrend({data,moduleId,semester}:{data:AppData;moduleId:string;semester?:Semester}){
  const reference=today()
  const {scoreEvents,assessments}=data
  const trend=useMemo(()=>semester?scoreTrend({scoreEvents,assessments},moduleId,semester,reference):null,[scoreEvents,assessments,moduleId,semester,reference])
  if(!trend)return null
  const ceiling=Math.max(100,Math.ceil(Math.max(0,...trend.points.map(point=>point.value))*1.1/100)*100)
  const y=(value:number)=>142-Math.max(0,value)/ceiling*126
  const points=trend.points.map(point=>({x:trend.x(point.date)*600,y:y(point.value)}))
  const last=points[points.length-1],line=points.map(point=>point.x.toFixed(2)+','+point.y.toFixed(2)).join(' ')
  const marker=trend.through>=trend.start?trend.x(trend.through)*600:null
  return <figure className="score-trend">
    <figcaption><span>Score-Verlauf</span><small>{trend.lastExam?'Bis zur letzten Prüfung':'Bis Semesterende'}</small></figcaption>
    <div className="score-trend-plot">
      <svg viewBox="0 0 600 156" preserveAspectRatio="none" role="img" aria-label={points.length?'Punktestand vom '+formatDate(trend.start)+' bis '+formatDate(trend.through)+': '+trend.total.toLocaleString('de-DE')+' Punkte. Zukünftige Tage ohne Daten.':'Noch keine Score-Daten für dieses Semester.'}>
        {[16,79,142].map(height=><line key={height} x1="0" x2="600" y1={height} y2={height} className="score-trend-grid"/>)}
        {marker!==null&&marker<600&&<line x1={marker} x2={marker} y1="8" y2="148" className="score-trend-today"/>}
        {points.length>0&&<polyline points={line} className="score-trend-line" vectorEffect="non-scaling-stroke"/>}
        {last&&<circle cx={last.x} cy={last.y} r="3" className="score-trend-dot"/>}
      </svg>
      <span className="score-trend-ceiling" aria-hidden="true">{ceiling.toLocaleString('de-DE')}</span>
    </div>
    <div className="score-trend-dates"><time dateTime={trend.start}>{formatDate(trend.start,{day:'numeric',month:'short'})}</time><time dateTime={trend.end}>{formatDate(trend.end,{day:'numeric',month:'short',year:'2-digit'})}</time></div>
  </figure>
}
