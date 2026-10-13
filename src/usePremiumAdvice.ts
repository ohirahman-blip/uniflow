import { useEffect, useState } from 'react'
import { supabase } from './supabase'
import { aiAdviceSignature, aiRequestDue, AI_CHECK_INTERVAL_MS } from './ai-request-schedule'
import { parseAiAdvice, type AdviceContext, type StudyAdvice } from './study-advice'

/** Client UI permission is not authorization: the Supabase Edge Function also
 * verifies the signed-in user, Premium subscription and server-side quota. */
export const deepseekConfigured = import.meta.env.VITE_UNIFLOW_AI_ENABLED === 'true'
const consentKey=(userId:string)=>'uniflow-ai-consent:'+userId
const attemptKey=(userId:string)=>'uniflow-ai-last-request:'+userId
const cacheKey=(userId:string)=>'uniflow-ai-advice:'+userId
const loadConsent=(userId:string)=>!!userId&&localStorage.getItem(consentKey(userId))==='yes'

type CachedAdvice={at:number;signature:string;advice:unknown}
type DisplayedAdvice={signature:string;value:StudyAdvice}

/** Lives at the App root (not inside a tab), so navigating between Calendar,
 * Settings and Dashboard never resets the one-hour request budget.
 * Hidden/closed apps have no scheduled network work or catch-up queue. */
export function usePremiumAdvice(userId:string,premium:boolean,context:AdviceContext,appActive:boolean){
  const [consentEntry,setConsentEntry]=useState(()=>({userId,allowed:loadConsent(userId)}))
  const consent=consentEntry.userId===userId&&consentEntry.allowed
  const [displayed,setDisplayed]=useState<DisplayedAdvice|null>(null)
  const [working,setWorking]=useState(false)
  const [unavailable,setUnavailable]=useState(false)
  const [visible,setVisible]=useState(()=>document.visibilityState==='visible')
  const [pulse,setPulse]=useState(0)
  const signature=aiAdviceSignature(context)

  // A different Supabase account never inherits this account's AI preference.
  useEffect(()=>{
    setConsentEntry({userId,allowed:loadConsent(userId)})
    setDisplayed(null)
    setUnavailable(false)
  },[userId])

  // Only an OPEN, VISIBLE app checks whether one hour has elapsed.
  // When reopened after hours/days, exactly ONE fresh check runs.
  useEffect(()=>{
    if(!appActive)return
    const updateVisibility=()=>{
      const isVisible=document.visibilityState==='visible'
      setVisible(isVisible)
      if(isVisible)setPulse(p=>p+1)
    }
    const timer=window.setInterval(()=>{
      if(document.visibilityState==='visible')setPulse(p=>p+1)
    },AI_CHECK_INTERVAL_MS)
    document.addEventListener('visibilitychange',updateVisibility)
    window.addEventListener('focus',updateVisibility)
    const onStorage=(event:StorageEvent)=>{
      if(event.key===attemptKey(userId))setPulse(p=>p+1)
      if(event.key===consentKey(userId))setConsentEntry({userId,allowed:loadConsent(userId)})
    }
    window.addEventListener('storage',onStorage)
    updateVisibility()
    return()=>{
      window.clearInterval(timer)
      document.removeEventListener('visibilitychange',updateVisibility)
      window.removeEventListener('focus',updateVisibility)
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
    setPulse(p=>p+1)
  }

  useEffect(()=>{
    if(!appActive||!userId||!premium||!consent||!deepseekConfigured||!supabase){
      setDisplayed(null)
      setWorking(false)
      return
    }
    let cancelled=false
    const controller=new AbortController()
    const enabled=appActive&&premium&&consent&&deepseekConfigured
    const hasVisibility=visible&&document.visibilityState==='visible'
    if(!hasVisibility)return

    // Reuse only advice that still matches the current teaching situation.
    try {
      const saved=JSON.parse(sessionStorage.getItem(cacheKey(userId))||'null') as CachedAdvice|null
      if(saved?.signature===signature && Number.isFinite(saved.at)){
        const result=parseAiAdvice(saved.advice,context)
        if(result)setDisplayed({signature,value:result})
        else setDisplayed(null)
      }else setDisplayed(null)
    }catch{setDisplayed(null)}

    const lastAttempt=Number(localStorage.getItem(attemptKey(userId))||0)
    if(!aiRequestDue(Date.now(),lastAttempt,hasVisibility,enabled))return

    // Small debounce lets navigation/visibility state settle. StrictMode
    // cleanup cancels the first scheduled call during development.
    const timer=window.setTimeout(()=>{
      if(cancelled||document.visibilityState!=='visible')return
      const now=Date.now()
      const recent=Number(localStorage.getItem(attemptKey(userId))||0)
      if(!aiRequestDue(now,recent,true,enabled))return

      // Persist BEFORE the HTTP request: even an API error cannot trigger
      // repeated billable retries on rerender, reload or tab reopen.
      localStorage.setItem(attemptKey(userId),String(now))
      setWorking(true)
      setUnavailable(false)
      void (async()=>{
        try {
          const response=await supabase.functions.invoke('uniflow-ai-advice',{
            body:{context},signal:controller.signal
          })
          if(response.error)throw response.error
          const result=parseAiAdvice(response.data?.recommendation,context)
          if(!result)throw new Error('Ungültige KI-Antwort')
          if(cancelled||document.visibilityState!=='visible')return
          sessionStorage.setItem(cacheKey(userId),JSON.stringify({
            at:now,signature,advice:result
          } satisfies CachedAdvice))
          setDisplayed({signature,value:result})
          setUnavailable(false)
        }catch{
          if(!cancelled){setDisplayed(null);setUnavailable(true)}
        }finally{
          if(!cancelled)setWorking(false)
        }
      })()
    },500)

    return()=>{
      cancelled=true
      window.clearTimeout(timer)
      controller.abort()
    }
  },[userId,premium,consent,appActive,visible,pulse,signature])

  return {
    consent,setConsent,
    advice:premium&&consent&&appActive&&displayed?.signature===signature?displayed.value:null,
    working,unavailable,configured:deepseekConfigured
  }
}
