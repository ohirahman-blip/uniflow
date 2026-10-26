/** Pure policy shared by the browser and Edge Function; no credentials. */
export const ADVICE_MIN_REFRESH_MS=30*60*1000
export const ADVICE_MAX_AGE_MS=4*60*60*1000
export const ADVICE_FAILURE_BACKOFF_MS=5*60*1000
type Plain=Record<string,unknown>
const record=(value:unknown):Plain|null=>value!==null&&typeof value==='object'&&!Array.isArray(value)?value as Plain:null
const text=(value:unknown,max=100)=>typeof value==='string'?value.slice(0,max).replace(/[\u0000-\u001f]/g,' ').trim():''
const number=(value:unknown,max:number)=>typeof value==='number'&&Number.isFinite(value)?Math.max(0,Math.min(max,Math.round(value))):0
const weak=(value:unknown)=>{const item=record(value);return item?{moduleId:text(item.moduleId,110),moduleName:text(item.moduleName,85),topic:text(item.topic,100),lessonKey:text(item.lessonKey,170),date:text(item.date,10),rating:text(item.rating,24)}:null}
export function sanitizeAdviceContext(value:unknown){
  const input=record(value)
  if(!input)return null
  const next=record(input.nextLecture)
  const result={today:text(input.today,10),localTime:text(input.localTime,5),timeZone:text(input.timeZone,70),progressRevision:text(input.progressRevision,64),freeMinutes:number(input.freeMinutes,240),
    nextLecture:next?{moduleId:text(next.moduleId,110),moduleName:text(next.moduleName,85),topic:text(next.topic,100),lessonKey:text(next.lessonKey,170),date:text(next.date,10),time:text(next.time,5),minutesUntil:number(next.minutesUntil,60*24*15)}:null,
    previousWeak:weak(input.previousWeak),pendingFeedback:weak(input.pendingFeedback),
    otherWeak:(Array.isArray(input.otherWeak)?input.otherWeak:[]).slice(0,6).map(weak).filter((item):item is NonNullable<typeof item>=>item!==null),
    exams:(Array.isArray(input.exams)?input.exams:[]).slice(0,4).flatMap(value=>{
      const item=record(value)
      return item?[{moduleId:text(item.moduleId,110),moduleName:text(item.moduleName,85),date:text(item.date,10),daysUntil:number(item.daysUntil,365)}]:[]
    })}
  return /^\d{4}-\d\d-\d\d$/.test(result.today)&&/^\d\d:\d\d$/.test(result.localTime)?result:null
}
export function aiAdviceSignature(value:unknown):string{
  const context=sanitizeAdviceContext(value)
  if(!context)return ''
  const {localTime,freeMinutes,nextLecture,...stable}=context
  void localTime
  const bucket=(minutes:number)=>minutes<=30?'soon':minutes<=180?'today':minutes<=1440?'next-day':'later'
  return JSON.stringify({...stable,freeWindow:freeMinutes>=30?'free':freeMinutes>0?'short':'none',nextLecture:nextLecture?{...nextLecture,minutesUntil:bucket(nextLecture.minutesUntil)}:null})
}
export type AdviceCacheTiming={signature:string;generatedAt:string;retryAt?:string|null}
export function shouldRefreshAdvice(cache:AdviceCacheTiming|null,signature:string,now=Date.now()):boolean{
  if(cache?.retryAt&&Date.parse(cache.retryAt)>now)return false
  if(!cache||!Number.isFinite(Date.parse(cache.generatedAt)))return true
  const age=Math.max(0,now-Date.parse(cache.generatedAt))
  return age>=ADVICE_MIN_REFRESH_MS&&(cache.signature!==signature||age>=ADVICE_MAX_AGE_MS)
}
