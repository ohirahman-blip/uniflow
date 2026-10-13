import type { AdviceContext } from './study-advice'

/** Limit is per UTC day per account. The server is the final authority;
 * this local count avoids needless denied calls after the 25th opening. */
export const AI_DAILY_LIMIT = 25
export const utcUsageDay = (now=new Date())=>now.toISOString().slice(0,10)
export const aiUsageKey = (userId:string,day:string)=>'uniflow-ai-attempts:'+userId+':'+day
export function canRequestOnOpen(visible:boolean,enabled:boolean,attempts:number):boolean {
  return visible&&enabled&&Number.isFinite(attempts)&&attempts>=0&&attempts<AI_DAILY_LIMIT
}
export function readAiDailyAttempts(userId:string,day=utcUsageDay()):number {
  try{return Math.max(0,Math.floor(Number(localStorage.getItem(aiUsageKey(userId,day)))||0))}
  catch{return AI_DAILY_LIMIT}
}
export function recordAiDailyAttempt(userId:string,day=utcUsageDay()):boolean {
  if(!userId)return false
  try{
    const previous=readAiDailyAttempts(userId,day)
    if(!canRequestOnOpen(true,true,previous))return false
    localStorage.setItem(aiUsageKey(userId,day),String(previous+1))
    return true
  }catch{return false}
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
