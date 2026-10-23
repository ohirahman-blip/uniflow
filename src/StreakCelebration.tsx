import {useEffect} from 'react'
import {createPortal} from 'react-dom'
import {Flame} from 'lucide-react'
export default function StreakCelebration({count,onClose}:{count:number;onClose:()=>void}){
  useEffect(()=>{const timer=window.setTimeout(onClose,2600);return()=>window.clearTimeout(timer)},[onClose])
  return createPortal(<div className={'streak-celebration'+(count>=7?' is-purple':'')} role="status" onClick={onClose}>
    <div className="streak-aura"/><div className="streak-orbit"/><Flame className="streak-hero-flame" strokeWidth={1.2}/>
    <strong>{count}</strong><span>{count===0?'Sammle heute deine ersten Punkte':count===1?'Deine Serie beginnt':`${count} Tage in Folge`}</span><b>{count>=7?'1,5× auf neue Punkte':'Ab 7 Tagen erhältst du 1,5× Punkte'}</b>
  </div>,document.body)
}
