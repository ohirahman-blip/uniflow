import {useEffect,useId,useRef,useState,type CSSProperties} from 'react'
import {createPortal} from 'react-dom'
import {playSuccessSound} from './streak-audio'
import type {LearningReward} from './learning-reward'
import './learning-reward.css'

const pieces=Array.from({length:54},(_,index)=>({
  left:(index*37)%101,delay:(index%9)*65,duration:1500+(index%7)*110,
  drift:(index%2?-1:1)*(24+(index*17)%110),turn:(index%2?-1:1)*(180+(index%5)*135),
  color:index%4
}))
export default function LearningRewardCelebration({reward,moduleName,color,soundEnabled,onClose}:{reward:LearningReward;moduleName:string;color:string;soundEnabled:boolean;onClose:()=>void}){
  const titleId=useId(),close=useRef<HTMLButtonElement>(null)
  const [progress,setProgress]=useState(0)
  useEffect(()=>{
    if(window.matchMedia('(prefers-reduced-motion: reduce)').matches){setProgress(1);return}
    let frame=0,start:number|undefined
    const tick=(now:number)=>{
      start??=now
      const elapsed=Math.max(0,now-start-100),fraction=Math.min(1,elapsed/1600)
      setProgress(1-(1-fraction)**3)
      if(fraction<1)frame=requestAnimationFrame(tick)
    }
    frame=requestAnimationFrame(tick)
    return()=>cancelAnimationFrame(frame)
  },[])
  useEffect(()=>{if(soundEnabled)return playSuccessSound()},[soundEnabled])
  useEffect(()=>{
    const previousFocus=document.activeElement as HTMLElement|null,overflow=document.body.style.overflow
    document.body.style.overflow='hidden';close.current?.focus()
    const timer=window.setTimeout(onClose,2600)
    const escape=(event:KeyboardEvent)=>{if(event.key==='Escape')onClose()}
    window.addEventListener('keydown',escape)
    return()=>{clearTimeout(timer);window.removeEventListener('keydown',escape);document.body.style.overflow=overflow;if(previousFocus?.isConnected)previousFocus.focus({preventScroll:true})}
  },[onClose])
  const points=Math.round(reward.points*progress).toLocaleString('de-DE')
  return createPortal(<section className="learning-reward" role="dialog" aria-modal="true" aria-labelledby={titleId} style={{'--reward-accent':color,'--reward-digits':reward.points.toLocaleString('de-DE').length+1} as CSSProperties}>
    <div className="learning-confetti" aria-hidden="true">{pieces.map((piece,index)=><i key={index} style={{left:piece.left+'%','--confetti-delay':piece.delay+'ms','--confetti-duration':piece.duration+'ms','--confetti-drift':piece.drift+'px','--confetti-turn':piece.turn+'deg','--confetti-color':['var(--reward-accent)','#f1c478','#a5d9bb','#ada6ec'][piece.color]} as CSSProperties}/>)}</div>
    <div className="learning-reward-content">
      <p>{moduleName}</p><h2 id={titleId}>{reward.kind==='session'?'Lernsession geschafft!':'Stoff gelernt!'}</h2>
      <div className="learning-reward-points" aria-label={`${reward.points} Punkte verdient`}>
        <strong aria-hidden="true"><span>+{points}</span><span className="learning-reward-fill" style={{clipPath:`inset(${(1-progress)*100}% 0 0)`}}>+{points}</span></strong><span>PUNKTE</span>
      </div>
      <div className="learning-reward-meter" aria-hidden="true"><i style={{transform:`scaleX(${progress})`}}/></div>
      <button ref={close} onClick={onClose} onKeyDown={event=>{if(event.key==='Tab')event.preventDefault()}}>Weiter</button>
    </div>
  </section>,document.body)
}
