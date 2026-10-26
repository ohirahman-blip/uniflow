import { useState } from 'react'
import { ArrowRight,Play } from 'lucide-react'
import type { LearningRating } from './learning'
import { parseStudyMinutes } from './study-timer'
import UniflowPicker from './UniflowPicker'
import {today} from './model'

export type SessionValues={duration:number;rating:Exclude<LearningRating,'absent'>;date:string}
export default function LearningSessionForm({initialMinutes=45,initialRating,initialDate= today(),onSave,onStart,timerExists=false,finishing=false,onDiscard}:{onDiscard?:()=>void;initialMinutes?:number;initialRating?:SessionValues['rating'];initialDate?:string;onSave:(values:SessionValues)=>void;onStart?:(minutes:number)=>void;timerExists?:boolean;finishing?:boolean}){
  const [duration,setDuration]=useState(String(initialMinutes)),[rating,setRating]=useState<SessionValues['rating']|''>(initialRating||''),[date,setDate]=useState(initialDate),[error,setError]=useState('')
  const [discardRequested,setDiscardRequested]=useState(false)
  const parsed=parseStudyMinutes(duration)
  const save=()=>{
    if(parsed===null)return setError('Gib eine Dauer ein, z. B. 45 Minuten oder 1:30 Stunden.')
    if(!rating)return setError('Wie gut hast du den Stoff verstanden?')
    onSave({duration:parsed,rating,date})
  }
  return <form className="mlh-form" onSubmit={event=>{event.preventDefault();save()}}>
    <label><span>{finishing?'Gemessene Lernzeit · anpassbar':'Dauer · Minuten oder Stunden:Minuten'}</span><input type="text" inputMode="text" value={duration} placeholder="45 oder 1:30" onChange={event=>{setDuration(event.target.value);setError('')}} autoComplete="off"/></label>
    <label><span>Datum</span><UniflowPicker kind="date" label="Datum der Lernsession" value={date} onChange={setDate}/></label>
    <div className="mlh-rating"><span>Wie gut hast du den Stoff verstanden?</span>{([{value:'understood',label:'Gut'},{value:'partial',label:'Teilweise'},{value:'struggling',label:'Gar nicht'}] as const).map(option=><button type="button" key={option.value} aria-pressed={rating===option.value} className={rating===option.value?'active':''} onClick={()=>{setRating(option.value);setError('')}}>{option.label}</button>)}</div>
    {error&&<p className="auth-error" role="alert">{error}</p>}
    <button className="mlh-primary" type="submit">{finishing?'Beenden & speichern':'Session speichern'}<ArrowRight size={18}/></button>
    {onDiscard&&(discardRequested?<div className="session-discard"><p>Session ohne Punkte verwerfen?</p><button type="button" onClick={onDiscard}>Ja, verwerfen</button><button type="button" onClick={()=>setDiscardRequested(false)}>Behalten</button></div>:<button className="dismiss-action" type="button" onClick={()=>setDiscardRequested(true)}>Lernsession verwerfen</button>)}
    {onStart&&<button className="mlh-start-timer" type="button" disabled={timerExists} onClick={()=>{if(parsed===null){setError('Gib zuerst eine gültige Dauer ein.');return}onStart(parsed)}}><Play size={16}/> Timer starten</button>}
    {onStart&&timerExists&&<p>Es läuft bereits ein Lerntimer. Du kannst trotzdem eine andere Session direkt speichern.</p>}
  </form>
}
