import { useEffect, useState } from 'react'
import { supabase } from './supabase'
import { parseAiAdvice, type AdviceContext, type StudyAdvice } from './study-advice'

/** The switch is a UI convenience, not authorization.
 * The Edge Function separately verifies auth, premium and a server-side quota. */
export const deepseekConfigured = import.meta.env.VITE_UNIFLOW_AI_ENABLED === 'true'

export function usePremiumAdvice(userId:string,premium:boolean,context:AdviceContext){
  const storageKey='uniflow-ai-consent:'+userId
  const cacheKey='uniflow-ai-advice:'+userId
  const [consent,setConsent]=useState(()=>localStorage.getItem(storageKey)==='yes')
  const [advice,setAdvice]=useState<StudyAdvice|null>(null)
  const [working,setWorking]=useState(false)
  const [unavailable,setUnavailable]=useState(false)
  const contextText=JSON.stringify(context)
  useEffect(()=>{
    setConsent(localStorage.getItem(storageKey)==='yes')
    setAdvice(null)
    setUnavailable(false)
  },[storageKey])
  const updateConsent=(allowed:boolean)=>{
    setConsent(allowed)
    if(allowed)localStorage.setItem(storageKey,'yes')
    else {localStorage.removeItem(storageKey);sessionStorage.removeItem(cacheKey);setAdvice(null)}
  }
  useEffect(()=>{
    if(!userId||!premium||!consent||!deepseekConfigured||!supabase){
      setAdvice(null);setWorking(false);return
    }
    let alive=true
    const now=Date.now()
    // Cache avoids paying for a request on every dashboard navigation.
    // A changed class or learning rating invalidates that suggestion.
    try{
      const cached=JSON.parse(sessionStorage.getItem(cacheKey)||'null') as
        {at?:number;context?:string;advice?:unknown}|null
      if(cached?.at && now-cached.at<20*60_000){
        if(cached.context===contextText){
          const verified=parseAiAdvice(cached.advice,context)
          if(verified){setAdvice(verified);setUnavailable(false);return}
        }
        // New class/feedback state invalidates the old advice immediately,
        // without starting another billable model call inside the throttle.
        setAdvice(null);setUnavailable(false);return
      }
    }catch{/* Ignore a malformed cache, never send it to the API. */}
    // Remote failure must not hide deterministic, up-to-date local advice.
    setAdvice(null)
    const timer=window.setTimeout(()=>{
      setWorking(true)
      void (async()=>{
        try{
          const {data,error}=await supabase!.functions.invoke('uniflow-ai-advice',{body:{context}})
          if(error)throw error
          const validated=parseAiAdvice(data?.recommendation,context)
          if(!validated)throw new Error('Antwort nicht verwendbar')
          if(!alive)return
          setAdvice(validated)
          setUnavailable(false)
          sessionStorage.setItem(cacheKey,JSON.stringify({at:Date.now(),context:contextText,advice:validated}))
        }catch{
          if(alive){setAdvice(null);setUnavailable(true)}
        }finally{if(alive)setWorking(false)}
      })()
    },950)
    return()=>{alive=false;window.clearTimeout(timer)}
  },[userId,premium,consent,cacheKey,contextText])
  return {consent,setConsent:updateConsent,advice,working,unavailable,configured:deepseekConfigured}
}
