import {useEffect,useRef,useState} from 'react'
import {createPortal} from 'react-dom'
import {useSwipeToDismiss} from './useSwipeToDismiss'
import StudyTimerCard from './StudyTimerCard'
import LearningSessionForm,{type SessionValues} from './LearningSessionForm'
import {timerElapsed,type StudyTimerState} from './study-timer'
import {dateString,type AppData} from './model'
import type {LearningSession} from './learning'

export default function DashboardTimer({data,onChange,onSession}:{data:AppData;onChange:(timer:StudyTimerState|undefined)=>void;onSession:(session:Omit<LearningSession,'id'|'updatedAt'>)=>void}){
  const [finishing,setFinishing]=useState<StudyTimerState|null>(null)
  const panel=useRef<HTMLElement>(null)
  useSwipeToDismiss(panel,()=>setFinishing(null),!!finishing)
  useEffect(()=>{
    if(!finishing)return
    const previousFocus=document.activeElement as HTMLElement|null
    const overflow=document.body.style.overflow
    document.body.style.overflow='hidden'
    panel.current?.querySelector<HTMLButtonElement>('button')?.focus()
    const keydown=(event:KeyboardEvent)=>{
      if(document.querySelector('.uf-picker-backdrop'))return
      if(event.key==='Escape')setFinishing(null)
      if(event.key==='Tab'){
        const fields=Array.from(panel.current?.querySelectorAll<HTMLElement>('button:not(:disabled),input:not(:disabled),[tabindex="0"]')||[]).filter(item=>item.getClientRects().length>0)
        const first=fields[0],last=fields[fields.length-1]
        if(event.shiftKey&&document.activeElement===first){event.preventDefault();last?.focus()}
        else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first?.focus()}
      }
    }
    window.addEventListener('keydown',keydown)
    return()=>{document.body.style.overflow=overflow;window.removeEventListener('keydown',keydown);previousFocus?.focus()}
  },[finishing])
  const timer=data.studyTimer
  if(!timer)return null
  const module=data.modules.find(item=>item.id===timer.moduleId)
  const save=(values:SessionValues)=>{if(!finishing)return;onSession({...values,moduleId:finishing.moduleId,kind:'review',timerId:finishing.id,startedAt:finishing.startedAt,endedAt:new Date().toISOString(),elapsedSeconds:Math.round(timerElapsed(finishing)/1000)});setFinishing(null)}
  return <><StudyTimerCard timer={timer} moduleName={module?.name||'Lernsession'} color={module?.color||'#aaa'} onChange={onChange} onDiscard={()=>onChange(undefined)} onFinish={value=>{onChange(value);setFinishing(value)}}/>{finishing&&createPortal(<div className="mlh-overlay" onPointerDown={event=>{if(event.target===event.currentTarget)setFinishing(null)}}><section ref={panel} className="mlh-sheet" role="dialog" aria-modal="true" aria-label="Lernsession beenden"><i className="mlh-sheet-handle"/><header><h2>Lernsession beenden</h2><button autoFocus aria-label="Schließen" onClick={()=>setFinishing(null)}>×</button></header><LearningSessionForm key={finishing.id} initialMinutes={Math.max(.01,Math.round(timerElapsed(finishing)/600)/100)} initialDate={dateString(new Date(finishing.startedAt))} finishing onSave={save} onDiscard={()=>{onChange(undefined);setFinishing(null)}}/></section></div>,document.body)}</>
}
