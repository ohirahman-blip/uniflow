import { useEffect, useRef, useState } from 'react'
import './startup-splash.css'

export default function StartupSplash({ready,premium,onFinish}:{ready:boolean;premium:boolean;onFinish:()=>void}){
  const started=useRef(Date.now())
  const [finishing,setFinishing]=useState(false)
  const [readyToFinish,setReadyToFinish]=useState(false)
  useEffect(()=>{
    if(!ready)return
    const reduced=window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const timer=window.setTimeout(()=>{
      if(reduced||!premium)setFinishing(true)
      else setReadyToFinish(true)
    },Math.max(0,650-(Date.now()-started.current)))
    return()=>window.clearTimeout(timer)
  },[ready,premium])
  useEffect(()=>{
    if(!finishing)return
    const reduced=window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const timer=window.setTimeout(onFinish,reduced?180:premium?1200:420)
    return()=>window.clearTimeout(timer)
  },[finishing,premium,onFinish])
  return <main className={'uf-startup'+(finishing?' is-finishing':'')+(premium?' is-premium':'')} role="status" aria-label="uniflow wird geladen">
    <div className="uf-startup-wordmark" aria-hidden="true">
      <span>uniflow</span><span className="uf-startup-symbol">
        <span className="uf-startup-dot" onAnimationIteration={()=>{
          if(readyToFinish)setFinishing(true)
        }}/>
        {premium&&<span className="uf-startup-plus"/>}
      </span>
    </div>
    <span className="uf-visually-hidden">{finishing?'Dein Studium ist bereit.':'Dein Studium wird geladen …'}</span>
  </main>
}
