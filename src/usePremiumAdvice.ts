import {useEffect,useRef,useState} from 'react'
import {supabase} from './supabase'
import {aiFailureText,describeAiRequestError} from './ai-errors'
import {aiAdviceSignature,shouldRefreshAdvice,ADVICE_MAX_AGE_MS,ADVICE_FAILURE_BACKOFF_MS} from './ai-request-schedule'
import {parseAiAdvice,type AdviceContext,type StudyAdvice} from './study-advice'

export const deepseekConfigured=import.meta.env.VITE_UNIFLOW_AI_ENABLED === 'true'
const consentKey=(userId:string)=>'uniflow-ai-consent:'+userId
const cacheKey=(userId:string)=>'uniflow-ai-advice:v2:'+userId
const failureKey=(userId:string)=>'uniflow-ai-backoff:v2:'+userId
const loadConsent=(userId:string)=>{try{return !!userId&&localStorage.getItem(consentKey(userId))==='yes'}catch{return false}}
type CachedAdvice={value:StudyAdvice;signature:string;generatedAt:string;retryAt?:string|null}
type OwnedCache={userId:string;saved:CachedAdvice|null}
function parseCache(raw:unknown,context:AdviceContext):CachedAdvice|null{
  if(!raw||typeof raw!=='object')return null
  const item=raw as Record<string,unknown>
  const value=parseAiAdvice(item.recommendation||item.value,context)
  if(!value||typeof item.signature!=='string'||typeof item.generatedAt!=='string'||!Number.isFinite(Date.parse(item.generatedAt)))return null
  return {value,signature:item.signature,generatedAt:item.generatedAt,retryAt:typeof item.retryAt==='string'?item.retryAt:null}
}
function readCache(userId:string,context:AdviceContext){try{return parseCache(JSON.parse(localStorage.getItem(cacheKey(userId))||'null'),context)}catch{return null}}
function readBackoff(userId:string){try{return Number(localStorage.getItem(failureKey(userId)))||0}catch{return 0}}

/** Only the visible Dashboard activates network work. No interval, daily counter,
 * or forced regeneration on tab switches/consent toggles. The database is the
 * device-independent authority and serializes paid calls with a short lease. */
export function usePremiumAdvice(userId:string,premium:boolean,context:AdviceContext,appActive:boolean){
  const [consentEntry,setConsentEntry]=useState(()=>({userId,allowed:loadConsent(userId)}))
  const consent=consentEntry.userId===userId&&consentEntry.allowed
  const [displayed,setDisplayed]=useState<OwnedCache>({userId:'',saved:null})
  const cache=useRef<OwnedCache>({userId:'',saved:null})
  const latestContext=useRef(context)
  latestContext.current=context
  const [working,setWorking]=useState(false),[unavailable,setUnavailable]=useState(false),[errorMessage,setErrorMessage]=useState('')
  const [foregroundEpoch,setForegroundEpoch]=useState(0)
  const [visible,setVisible]=useState(()=>document.visibilityState==='visible')
  const signature=aiAdviceSignature(context)

  useEffect(()=>{
    const saved=readCache(userId,latestContext.current)
    cache.current={userId,saved}
    setDisplayed({userId,saved})
    setConsentEntry({userId,allowed:loadConsent(userId)})
    setWorking(false);setUnavailable(false);setErrorMessage('')
  },[userId])

  useEffect(()=>{
    const foreground=()=>{
      const shown=document.visibilityState==='visible'
      setVisible(shown)
      if(shown)setForegroundEpoch(epoch=>epoch+1)
    }
    const storage=(event:StorageEvent)=>{
      if(event.key===consentKey(userId))setConsentEntry({userId,allowed:loadConsent(userId)})
      if(event.key===cacheKey(userId)){
        const saved=readCache(userId,latestContext.current)
        if(saved){cache.current={userId,saved};setDisplayed({userId,saved})}
      }
    }
    document.addEventListener('visibilitychange',foreground)
    window.addEventListener('focus',foreground)
    window.addEventListener('storage',storage)
    return()=>{document.removeEventListener('visibilitychange',foreground);window.removeEventListener('focus',foreground);window.removeEventListener('storage',storage)}
  },[userId])

  const setConsent=(allowed:boolean)=>{
    if(!userId)return
    try{if(allowed)localStorage.setItem(consentKey(userId),'yes');else localStorage.removeItem(consentKey(userId))}catch{/* This session can still change its consent. */}
    setConsentEntry({userId,allowed})
    setErrorMessage('');setUnavailable(false)
    // OFF -> ON reuses existing advice and cannot bypass the server cooldown.
  }

  useEffect(()=>{
    if(!appActive||!userId||!premium||!consent||!deepseekConfigured||!supabase){
      setWorking(false)
      if(appActive&&premium&&consent&&!deepseekConfigured)setErrorMessage('KI-Empfehlungen sind in dieser Umgebung deaktiviert.')
      return
    }
    if(!visible||document.visibilityState!=='visible')return
    let cancelled=false
    const controller=new AbortController()
    const client=supabase
    const accept=(candidate:CachedAdvice|null)=>{
      if(!candidate||cancelled)return
      const previous=cache.current.userId===userId?cache.current.saved:null
      if(previous&&Date.parse(previous.generatedAt)>Date.parse(candidate.generatedAt))return
      cache.current={userId,saved:candidate};setDisplayed({userId,saved:candidate})
      try{localStorage.setItem(cacheKey(userId),JSON.stringify(candidate))}catch{/* Server cache is still authoritative. */}
    }
    // StrictMode-safe debounce; no request starts in a hidden tab or another page.
    const timer=window.setTimeout(()=>{
      if(cancelled||document.visibilityState!=='visible')return
      if(readBackoff(userId)>Date.now()){
        setUnavailable(true);setErrorMessage('Die Aktualisierung pausiert kurz. Die letzte Empfehlung bleibt erhalten.')
        return
      }
      void(async()=>{
        try{
          const requestContext=latestContext.current
          const {data:remote,error:readError}=await client.from('uniflow_ai_advice_cache')
            .select('recommendation,signature,generated_at,next_attempt_at').eq('user_id',userId).maybeSingle()
          if(cancelled)return
          if(readError)throw new Error(aiFailureText('CACHE_NOT_CONFIGURED'))
          const remoteCache=remote?parseCache({recommendation:remote.recommendation,signature:remote.signature,generatedAt:remote.generated_at,retryAt:remote.next_attempt_at},requestContext):null
          accept(remoteCache)
          const saved=cache.current.userId===userId?cache.current.saved:null
          const retryAt=remote?.next_attempt_at||saved?.retryAt
          if(retryAt&&Date.parse(retryAt)>Date.now())return
          if(!shouldRefreshAdvice(saved,signature)){setUnavailable(false);setErrorMessage('');return}
          if(cancelled||document.visibilityState!=='visible')return
          setWorking(true);setErrorMessage('')
          const {data,error}=await client.functions.invoke('uniflow-ai-advice',{body:{context:requestContext},signal:controller.signal})
          if(error)throw error
          if(cancelled)return
          const candidate=parseCache(data,requestContext)
          accept(candidate)
          if(!candidate&&data?.status!=='pending')throw new Error(aiFailureText('CACHE_NOT_CONFIGURED'))
          if(!candidate&&typeof data?.retryAt==='string'){
            try{localStorage.setItem(failureKey(userId),String(Date.parse(data.retryAt)))}catch{/* Best effort only. */}
          }else{
            try{localStorage.removeItem(failureKey(userId))}catch{/* Best effort only. */}
          }
          setUnavailable(false);setErrorMessage('')
        }catch(error){
          if(cancelled)return
          const message=await describeAiRequestError(error,'uniflow-ai-advice')
          if(cancelled)return
          try{localStorage.setItem(failureKey(userId),String(Date.now()+ADVICE_FAILURE_BACKOFF_MS))}catch{/* The server also backs off. */}
          setUnavailable(true);setErrorMessage(message)
          // Keep both local and server copies of the last successful result.
        }finally{if(!cancelled)setWorking(false)}
      })()
    },500)
    return()=>{cancelled=true;window.clearTimeout(timer);controller.abort()}
  },[appActive,userId,premium,consent,visible,foregroundEpoch,signature])

  const saved=displayed.userId===userId?displayed.saved:null
  return {consent,setConsent,working,unavailable,errorMessage,configured:deepseekConfigured,
    advice:premium&&consent&&appActive?saved?.value||null:null,
    generatedAt:saved?.generatedAt||null,
    isStale:!!saved&&(unavailable||saved.signature!==signature||Date.now()-Date.parse(saved.generatedAt)>=ADVICE_MAX_AGE_MS)}
}
