import {useEffect,useRef,useState,type CSSProperties} from 'react'
import {createPortal} from 'react-dom'
import AnimatedScore from './AnimatedScore'

export default function LearningStickyHeader({moduleId,title,color,score,onHistory}:{moduleId:string;title:string;color:string;score:number;onHistory:()=>void}){
  const bar=useRef<HTMLElement>(null)
  const [hidden,setHidden]=useState(false)
  useEffect(()=>{
    const scoreNode=document.getElementById('learning-module-score')
    if(!scoreNode||!bar.current)return
    let observer:IntersectionObserver|undefined
    const observe=()=>{
      observer?.disconnect()
      const edge=bar.current?.getBoundingClientRect().bottom||60
      observer=new IntersectionObserver(entries=>{
        for(const entry of entries)setHidden(entry.boundingClientRect.bottom<=edge)
      },{rootMargin:`-${edge}px 0px 0px 0px`,threshold:0})
      observer.observe(scoreNode)
    }
    observe()
    const resize=new ResizeObserver(observe)
    resize.observe(bar.current)
    return()=>{observer?.disconnect();resize.disconnect()}
  },[moduleId])
  return createPortal(<header ref={bar} className={'learning-sticky-header'+(hidden?' is-visible':'')} style={{'--mlh-accent':color} as CSSProperties} aria-hidden={!hidden} inert={!hidden}>
    <div><button onClick={onHistory} tabIndex={hidden?0:-1} aria-label={`${title}: ${score} Punkte, Aktivitäten öffnen`}><AnimatedScore key={moduleId} value={score} storageKey={`sticky-score:${moduleId}`}/><span className="learning-sticky-points">PUNKTE</span></button></div>
  </header>,document.body)
}
