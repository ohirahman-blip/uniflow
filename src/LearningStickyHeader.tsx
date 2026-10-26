import {useEffect,useRef,useState,type CSSProperties} from 'react'
import {createPortal} from 'react-dom'
import AnimatedScore from './AnimatedScore'

export default function LearningStickyHeader({moduleId,title,color,score,onHistory}:{moduleId:string;title:string;color:string;score:number;onHistory:()=>void}){
  const bar=useRef<HTMLElement>(null)
  const [hidden,setHidden]=useState({title:false,score:false})
  useEffect(()=>{
    const titleNode=document.getElementById('learning-module-title')
    const scoreNode=document.getElementById('learning-module-score')
    if(!titleNode||!scoreNode||!bar.current)return
    let observer:IntersectionObserver|undefined
    const observe=()=>{
      observer?.disconnect()
      const edge=bar.current?.getBoundingClientRect().bottom||60
      observer=new IntersectionObserver(entries=>{
        setHidden(previous=>{
          const next={...previous}
          for(const entry of entries)next[entry.target===titleNode?'title':'score']=entry.boundingClientRect.bottom<=edge
          return next.title===previous.title&&next.score===previous.score?previous:next
        })
      },{rootMargin:`-${edge}px 0px 0px 0px`,threshold:0})
      observer.observe(titleNode);observer.observe(scoreNode)
    }
    observe()
    const resize=new ResizeObserver(observe)
    resize.observe(bar.current)
    return()=>{observer?.disconnect();resize.disconnect()}
  },[moduleId])
  return createPortal(<header ref={bar} className={'learning-sticky-header'+(hidden.title?' is-visible':'')+(hidden.score?' has-score':'')} style={{'--mlh-accent':color} as CSSProperties} aria-hidden={!hidden.title} inert={!hidden.title}>
    <div><strong className="learning-sticky-title" title={title}>{title}</strong><button onClick={onHistory} tabIndex={hidden.title&&hidden.score?0:-1} aria-label={`${score} Punkte, Aktivitäten öffnen`} aria-hidden={!hidden.score}><AnimatedScore key={moduleId} value={score} storageKey={`sticky-score:${moduleId}`}/></button></div>
  </header>,document.body)
}
