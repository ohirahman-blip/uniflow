import type { AdviceContext } from './study-advice'

/** A new premium inference is allowed at most once per elapsed hour.
 * A sleeping/closed tab never accumulates a queue of missed requests. */
export const AI_REQUEST_INTERVAL_MS = 60 * 60 * 1000
export const AI_CHECK_INTERVAL_MS = 60 * 1000

export function aiRequestDue(now:number,lastAttempt:number,visible:boolean,enabled:boolean):boolean {
  if(!visible||!enabled||!Number.isFinite(now)||now<=0)return false
  if(!Number.isFinite(lastAttempt)||lastAttempt<=0)return true
  if(now<lastAttempt)return false
  return now-lastAttempt>=AI_REQUEST_INTERVAL_MS
}

/** Ignore minute-by-minute clock drift, but reject cached advice when
 * the relevant teaching/feedback context actually changes. */
export function aiAdviceSignature(context:AdviceContext):string {
  const {localTime,freeMinutes,nextLecture,...stable}=context
  void localTime
  const timeBucket=(mins:number)=>{
    if(mins<=30)return 'soon'
    if(mins<=180)return 'today'
    if(mins<=1440)return 'next-day'
    return 'later'
  }
  return JSON.stringify({
    ...stable,
    freeWindow:freeMinutes>=30?'free':freeMinutes>0?'short':'none',
    nextLecture:nextLecture?{
      ...nextLecture,
      minutesUntil:timeBucket(nextLecture.minutesUntil)
    }:null
  })
}
