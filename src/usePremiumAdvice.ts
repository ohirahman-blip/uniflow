import { useEffect, useRef, useState } from 'react'
import { supabase } from './supabase'
import { aiAdviceSignature, canRequestOnOpen, readAiDailyAttempts, recordAiDailyAttempt } from './ai-request-schedule'
import { parseAiAdvice, type AdviceContext, type StudyAdvice } from './study-advice'

/** Consent is only a UI permission. Supabase also verifies the JWT,
 * admin-controlled premium flag and atomic 25-per-UTC-day quota. */
export const deepseekConfigured = import.meta.env.VITE_UNIFLOW_AI_ENABLED === 'true'
const consentKey=(userId:string)=>'uniflow-ai-consent:'+userId
const cacheKey=(userId:string)=>'uniflow-ai-advice:'+userId
const loadConsent=(userId:string)=>!!userId&&localStorage.getItem(consentKey(userId))==='yes'
type CachedAdvice={signature:string;advice:unknown}
type DisplayedAdvice={signature:string;value:StudyAdvice}

/** Mounted at App root, so switching app tabs does NOT count as opening it.
 * Every NEW foreground session is eligible for one fresh recommendation.
 * Hidden/unmounted apps do no network work; there is no hourly timer.
 * At most 25 attempts per UTC day locally and atomically on the server. */
export function usePremiumAdvice(userId:string,premium:boolean,context:AdviceContext,appActive:boolean){
  const [consentEntry,setConsentEntry]=useState(()=>({userId,allowed:loadConsent(userId)}))
  const consent=consentEntry.userId===userId&&consentEntry.allowed
  const [displayed,setDisplayed]=useState<DisplayedAdvice|null>(null)
  const [working,setWorking]=useState(false)
  const [unavailable,setUnavailable]=useState(false)
  const [foregroundEpoch,setForegroundEpoch]=useState(0)
  const [visible,setVisible]=useState(()=>document.visibilityState==='visible')
  const requestedEpoch=useRef<{userId:string;epoch:number}|null>(null)
  const wasHidden=useRef(document.visibilityState!=='visible')
  const signature=aiAdviceSignature(context)

  useEffect(()=>{
    setConsentEntry({userId,allowed:loadConsent(userId)})
    setDisplayed(null)
    requestedEpoch.current=null
    setUnavailable(false)
  },[userId])

  useEffect(()=>{
    if(!appActive)return
    const onVisibility=()=>{
      const nowVisible=document.visibilityState==='visible'
      setVisible(nowVisible)
      if(nowVisible&&wasHidden.current){
        wasHidden.current=false
        setForegroundEpoch(e=>e+1)
      }else if(!nowVisible){
        wasHidden.current=true
      }
    }
    const onStorage=(event:StorageEvent)=>{
      if(event.key===consentKey(userId)){
        setConsentEntry({userId,allowed:loadConsent(userId)})
      }
    }
    document.addEventListener('visibilitychange',onVisibility)
    window.addEventListener('storage',onStorage)
    onVisibility()
    return()=>{
      document.removeEventListener('visibilitychange',onVisibility)
      window.removeEventListener('storage',onStorage)
    }
  },[appActive,userId])

  const setConsent=(allowed:boolean)=>{
    if(!userId)return
    if(allowed)localStorage.setItem(consentKey(userId),'yes')
    else {
      localStorage.removeItem(consentKey(userId))
      sessionStorage.removeItem(cacheKey(userId))
      setDisplayed(null)
    }
    setConsentEntry({userId,allowed})
  }

  useEffect(()=>{
    if(!appActive||!userId||!premium||!consent||!deepseekConfigured||!supabase){
      setDisplayed(null)
      setWorking(false)
      return
    }
    if(!visible||document.visibilityState!=='visible')return
    // Avoid another request after navigation, rating edits, study feedback
    // or a clock tick. Only a NEW opening/foreground epoch may request.
    if(requestedEpoch.current?.userId===userId&&requestedEpoch.current.epoch===foregroundEpoch)return

    // Reuse matching advice while an opening is being prepared. If feedback
    // changed, drop stale AI advice and display the local recommendation.
    try{
      const saved=JSON.parse(sessionStorage.getItem(cacheKey(userId))||'null') as CachedAdvice|null
      const parsed=saved?.signature===signature?parseAiAdvice(saved.advice,context):null
      setDisplayed(parsed?{signature,value:parsed}:null)
    }catch{setDisplayed(null)}

    // Reserve the foreground epoch BEFORE starting async work.
    requestedEpoch.current={userId,epoch:foregroundEpoch}
    if(!canRequestOnOpen(true,true,readAiDailyAttempts(userId)))return
    let cancelled=false
    const controller=new AbortController()
    const timer=window.setTimeout(()=>{
      if(cancelled||document.visibilityState!=='visible')return
      // Count attempts even on API failure so a broken API never causes a storm.
      if(!recordAiDailyAttempt(userId))return
      setWorking(true)
      setUnavailable(false)
      void (async()=>{
        try{
          const {data,error}=await supabase!.functions.invoke('uniflow-ai-advice',{
            body:{context},signal:controller.signal
          })
          if(error)throw error
          const next=parseAiAdvice(data?.recommendation,context)
          if(!next)throw new Error('Ungültige KI-Antwort')
          if(cancelled||document.visibilityState!=='visible')return
          sessionStorage.setItem(cacheKey(userId),JSON.stringify({signature,advice:next} satisfies CachedAdvice))
          setDisplayed({signature,value:next})
          setUnavailable(false)
        }catch{
          if(!cancelled){setDisplayed(null);setUnavailable(true)}
        }finally{
          if(!cancelled)setWorking(false)
        }
      })()
    },500)
    return()=>{cancelled=true;window.clearTimeout(timer);controller.abort()}
  },[appActive,userId,premium,consent,visible,foregroundEpoch,signature])

  // The cache never overrides newly changed classes, times or check-ins.
  return {
    consent,setConsent,
    advice:premium&&consent&&appActive&&displayed?.signature===signature?displayed.value:null,
    working,unavailable,configured:deepseekConfigured
  }
}
