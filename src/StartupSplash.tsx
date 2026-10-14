import { useEffect, useRef, useState } from 'react'
import './startup-splash.css'

export default function StartupSplash({ready,premium,premiumKnown=true,onFinish}:{ready:boolean;premium:boolean;premiumKnown?:boolean;onFinish:()=>void}){
  const spinStarted=useRef(Date.now())
  const [isReload]=useState(()=>
    (performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming|undefined)?.type==='reload')
  const [finishing,setFinishing]=useState(false)
  useEffect(()=>{
    if(premium)spinStarted.current=Date.now()
  },[premium])
  useEffect(()=>{
    if(!ready)return
    const reduced=window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const timer=window.setTimeout(()=>setFinishing(true),!isReload&&!reduced&&premium?Math.max(0,900-(Date.now()-spinStarted.current)):0)
    return()=>window.clearTimeout(timer)
  },[ready,premium,isReload])
  useEffect(()=>{
    if(!finishing)return
    const reduced=window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const timer=window.setTimeout(onFinish,isReload?0:reduced?180:250)
    return()=>window.clearTimeout(timer)
  },[finishing,isReload,onFinish])
  return <main className={'uf-startup'+(finishing?' is-finishing':'')+(premium?' is-premium':'')+(isReload?' is-reload':'')} role="status" aria-label="uniflow wird geladen">
    {isReload?<span className="uf-startup-loading-line" aria-hidden="true"/>:<div className="uf-startup-wordmark" aria-hidden="true">
      <span>uniflow</span><span className="uf-startup-symbol">
        {premiumKnown&&(premium?<span className="uf-startup-plus"/>:<span className="uf-startup-dot"/>)}
      </span>
      {premiumKnown&&!premium&&<span className="uf-startup-loading-line"/>}
    </div>}
    <span className="uf-visually-hidden">{finishing?'Dein Studium ist bereit.':'Dein Studium wird geladen …'}</span>
  </main>
}
