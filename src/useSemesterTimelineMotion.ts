import {useEffect,useLayoutEffect,useRef,useState} from 'react'
import type {AppData} from './model'
import type {StudyPlan} from './adaptive-study-plan'
type View='exams'|'plan'
type Anchor={date:string;top:number}
export function useSemesterTimelineMotion(data:AppData,plan:StudyPlan){
  const [view,setView]=useState<View>('exams'),[requested,setRequested]=useState<View>('exams')
  const [phase,setPhase]=useState<'idle'|'exit'|'enter'>('idle')
  const panelRef=useRef<HTMLDivElement>(null),railRef=useRef<HTMLDivElement>(null)
  const timer=useRef<ReturnType<typeof setTimeout>|null>(null),anchors=useRef<Anchor[]>([])
  const animations=useRef<Animation[]>([])
  useEffect(()=>()=>{if(timer.current)clearTimeout(timer.current);animations.current.forEach(animation=>animation.cancel())},[])
  const changeView=(next:View)=>{
    if(timer.current)clearTimeout(timer.current)
    setRequested(next)
    if(next===view){setPhase('idle');return}
    const panel=panelRef.current
    const reduced=window.matchMedia('(prefers-reduced-motion: reduce)').matches
    anchors.current=panel&&!reduced?[...panel.querySelectorAll<HTMLElement>('[data-timeline-date]')].map(row=>({date:row.dataset.timelineDate!,top:row.querySelector('time')?.getBoundingClientRect().top||row.getBoundingClientRect().top})):[]
    if(reduced){setView(next);setPhase('idle');return}
    setPhase('exit')
    timer.current=setTimeout(()=>{timer.current=null;setView(next);setPhase('enter')},140)
  }
  useLayoutEffect(()=>{
    const panel=panelRef.current,rail=railRef.current
    if(!panel||!rail)return
    const measure=()=>{
      const axis=panel.querySelector<HTMLElement>('.mlh-timeline-axis')
      panel.dataset.sharedAxis=axis?'true':'false'
      if(!axis)return
      const bounds=panel.getBoundingClientRect(),rect=axis.getBoundingClientRect()
      Object.assign(rail.style,{top:rect.top-bounds.top+'px',left:rect.left-bounds.left+'px',height:rect.height+'px'})
      const timeline=axis.parentElement!
      const position=(selector:string)=>{const row=timeline.querySelector<HTMLElement>(selector);return row?(row.getBoundingClientRect().top-rect.top)/Math.max(1,rect.height)*100:100}
      const first=axis.dataset.phaseOne!==undefined?Number(axis.dataset.phaseOne):Math.min(position('[data-intensity="1"]'),position('[data-intensity="2"]'))
      const second=axis.dataset.phaseTwo!==undefined?Number(axis.dataset.phaseTwo):position('[data-intensity="2"]')
      const end=axis.dataset.phaseEnd!==undefined?Number(axis.dataset.phaseEnd):100
      const clamp=(value:number)=>Math.min(100,Math.max(0,value))
      const one=clamp(first),two=Math.max(one,clamp(second)),last=Math.max(two,clamp(end))
      rail.style.setProperty('--phase-one',one+'%');rail.style.setProperty('--phase-two',two+'%');rail.style.setProperty('--phase-end',last+'%')
    }
    measure()
    animations.current.forEach(animation=>animation.cancel());animations.current=[]
    if(anchors.current.length&&!window.matchMedia('(prefers-reduced-motion: reduce)').matches){
      for(const row of panel.querySelectorAll<HTMLElement>('[data-timeline-date]')){
        const date=Date.parse(row.dataset.timelineDate!)
        const previous=anchors.current.reduce((best,item)=>Math.abs(Date.parse(item.date)-date)<Math.abs(Date.parse(best.date)-date)?item:best)
        const time=row.querySelector('time')
        if(!time)continue
        const delta=previous.top-time.getBoundingClientRect().top
        for(const element of [time,row.querySelector(':scope > i')]){
          if(element&&typeof element.animate==='function')animations.current.push(element.animate([{transform:'translateY('+delta+'px)'},{transform:'translateY(0)'}],{duration:420,easing:'cubic-bezier(.22,1,.36,1)'}))
        }
      }
    }
    anchors.current=[]
    const observer=typeof ResizeObserver==='undefined'?null:new ResizeObserver(measure)
    observer?.observe(panel)
    return()=>observer?.disconnect()
  },[view,data,plan])
  return {view,requested,phase,panelRef,railRef,changeView}
}
