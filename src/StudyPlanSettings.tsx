import {useState} from 'react'
import {X} from 'lucide-react'
import {formatDate,today} from './model'
import UniflowPicker from './UniflowPicker'
import type {StudySchedulePreferences} from './adaptive-study-plan'
const clock=(value:number)=>String(Math.floor(value/60)).padStart(2,'0')+':'+String(value%60).padStart(2,'0')
export default function StudyPlanSettings({preferences,onChange}:{preferences:StudySchedulePreferences;onChange:(value:StudySchedulePreferences)=>void}){
  const [day,setDay]=useState('')
  return <section className="settings-section study-plan-settings">
    <h2>Lernplan</h2><div className="setting-line"><span>Automatisch planen</span><button type="button" role="switch" aria-label="Automatischen Lernplan aktivieren" aria-checked={preferences.enabled} className={'settings-ai-toggle'+(preferences.enabled?' is-on':'')} onClick={()=>onChange({...preferences,enabled:!preferences.enabled})}><span/></button></div>
    <p className="quiet-copy">Ohne KI und ohne Tagesbudget. Vollständige Lernblöcke und Wiederholungen werden frühzeitig auf deine Lerntage verteilt. Uhrzeiten im Kalender sind nur Vorschläge.</p>
    {preferences.enabled&&<>
      <fieldset><legend>Lerntage</legend><div className="study-plan-weekdays">{['Mo','Di','Mi','Do','Fr','Sa','So'].map((label,index)=><button key={label} type="button" aria-pressed={preferences.weekdays.includes(index)} onClick={()=>onChange({...preferences,weekdays:preferences.weekdays.includes(index)?preferences.weekdays.filter(day=>day!==index):[...preferences.weekdays,index].sort()})}>{label}</button>)}</div></fieldset>
      {!preferences.weekdays.length&&<p className="study-plan-warning">Bitte mindestens einen Lerntag auswählen.</p>}
      <div className="study-plan-time-window"><label><span>Frühestens</span><UniflowPicker kind="time" label="Früheste Lernzeit" value={clock(preferences.windowStart)} onChange={value=>{const [h,m]=value.split(':').map(Number),start=Math.min(1410,h*60+m);onChange({...preferences,windowStart:start,windowEnd:Math.max(preferences.windowEnd,start+30)})}}/></label><label><span>Spätestens</span><UniflowPicker kind="time" label="Späteste Lernzeit" value={clock(preferences.windowEnd)} onChange={value=>{const [h,m]=value.split(':').map(Number);onChange({...preferences,windowEnd:Math.max(preferences.windowStart+30,Math.min(1440,h*60+m))})}}/></label></div>
      <p className="quiet-copy">Nur in diesem Zeitfenster werden freie Lücken berücksichtigt, mit Puffer um deine Termine.</p>
      <div className="study-plan-day-off"><label><span>Einzelnen Tag freihalten</span><UniflowPicker kind="date" label="Lernfreien Tag auswählen" min={today()} value={day} onChange={setDay}/></label><button type="button" disabled={!day} onClick={()=>{if(day)onChange({...preferences,excludedDates:[...new Set([...preferences.excludedDates,day])].sort()});setDay('')}}>Freihalten</button></div>
      <div className="study-plan-days-off">{preferences.excludedDates.filter(date=>date>=today()).map(date=><button type="button" key={date} onClick={()=>onChange({...preferences,excludedDates:preferences.excludedDates.filter(day=>day!==date)})} aria-label={formatDate(date)+' wieder als Lerntag freigeben'}>{formatDate(date,{day:'numeric',month:'short'})}<X size={13}/></button>)}</div>
    </>}
  </section>
}
