import { useEffect, useRef, useState } from 'react'
import './startup-splash.css'

export default function StartupSplash({ready,premium,premiumKnown=true,onFinish}:{ready:boolean;premium:boolean;premiumKnown?:boolean;onFinish:()=>void}){
  const started=useRef(Date.now())
  const [finishing,setFinishing]=useState(false)
  useEffect(()=>{
    if(!ready)return
    const reduced=window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const timer=window.setTimeout(()=>setFinishing(true),reduced?0:premium?700:Math.max(0,650-(Date.now()-started.current)))
    return()=>window.clearTimeout(timer)
  },[ready,premium])
  useEffect(()=>{
    if(!finishing)return
    const reduced=window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const timer=window.setTimeout(onFinish,reduced?180:250)
    return()=>window.clearTimeout(timer)
  },[finishing,premium,onFinish])
  return <main className={'uf-startup'+(finishing?' is-finishing':'')+(premium?' is-premium':'')} role="status" aria-label="uniflow wird geladen">
    <div className="uf-startup-wordmark" aria-hidden="true">
      <span>uniflow</span><span className="uf-startup-symbol">
        {premiumKnown&&(premium?<span className="uf-startup-plus"/>:<span className="uf-startup-dot"/>)}
      </span>
    </div>
    <span className="uf-visually-hidden">{finishing?'Dein Studium ist bereit.':'Dein Studium wird geladen …'}</span>
  </main>
}
