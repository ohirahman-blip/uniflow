import { useEffect,useState,type CSSProperties } from 'react'
import { Pause,Play,Square,Timer } from 'lucide-react'
import { pauseTimer,timerClock,timerElapsed,type StudyTimerState } from './study-timer'

export default function StudyTimerCard({timer,moduleName,color,onChange,onFinish}:{timer:StudyTimerState;moduleName:string;color:string;onChange:(timer:StudyTimerState)=>void;onFinish:(timer:StudyTimerState)=>void}){
  const [now,setNow]=useState(Date.now)
  useEffect(()=>{
    const refresh=()=>setNow(Date.now())
    refresh()
    if(timer.runningSince===null)return
    const interval=window.setInterval(refresh,1000)
    window.addEventListener('focus',refresh);document.addEventListener('visibilitychange',refresh)
    return()=>{window.clearInterval(interval);window.removeEventListener('focus',refresh);document.removeEventListener('visibilitychange',refresh)}
  },[timer.id,timer.runningSince])
  const elapsed=timerElapsed(timer,now),target=timer.targetMinutes*60000,overtime=elapsed>=target
  return <section className={'mlh-running-timer'+(overtime?' is-overtime':'')} style={{'--timer-accent':color} as CSSProperties} aria-label={`Lerntimer für ${moduleName}`}>
    <header><Timer size={16}/><span>{moduleName}</span><small>{timer.runningSince===null?'Pausiert':overtime?'Zusatzzeit':'Lernsession läuft'}</small></header>
    <div className="mlh-timer-clock" role="timer" aria-label={overtime?'Zusatzzeit nach Timerende':'Verbleibende Lernzeit'}>{overtime?'+':''}{timerClock(overtime?elapsed-target:target-elapsed)}</div>
    <p>Gelernt: {timerClock(elapsed)}</p>
    <div className="mlh-timer-progress" aria-hidden="true"><i style={{width:`${Math.min(100,elapsed/Math.max(1,target)*100)}%`}}/></div>
    <div className="mlh-timer-controls"><button onClick={()=>onChange(timer.runningSince===null?{...timer,runningSince:Date.now()}:pauseTimer(timer))}>{timer.runningSince===null?<Play size={16}/>:<Pause size={16}/>} {timer.runningSince===null?'Fortsetzen':'Stoppen'}</button><button onClick={()=>onFinish(pauseTimer(timer))}><Square size={14}/> Beenden</button></div>
  </section>
}
