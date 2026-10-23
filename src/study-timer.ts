export type StudyTimerState={
  id:string
  moduleId:string
  startedAt:string
  runningSince:number|null
  elapsedMs:number
  targetMinutes:number
}
export const timerElapsed=(timer:StudyTimerState,now=Date.now())=>Math.max(0,timer.elapsedMs+(timer.runningSince===null?0:Math.max(0,now-timer.runningSince)))
export const pauseTimer=(timer:StudyTimerState):StudyTimerState=>({...timer,elapsedMs:timerElapsed(timer),runningSince:null})
export function parseStudyMinutes(text:string):number|null{
  const value=text.trim().replace(',','.')
  let result:number
  if(/^\d+:\d{1,2}(?::\d{1,2})?$/.test(value)){
    const [hours,minutes,seconds=0]=value.split(':').map(Number)
    if(minutes>59||seconds>59)return null
    result=hours*60+minutes+seconds/60
  }else if(/^\d+(?:\.\d+)?$/.test(value))result=Number(value)
  else return null
  const rounded=Math.round(result*100)/100
  return Number.isFinite(rounded)&&rounded>0?rounded:null
}
export function timerClock(ms:number){
  const seconds=Math.floor(Math.max(0,ms)/1000),hours=Math.floor(seconds/3600)
  const rest=`${String(Math.floor(seconds/60)%60).padStart(2,'0')}:${String(seconds%60).padStart(2,'0')}`
  return hours?`${String(hours).padStart(2,'0')}:${rest}`:rest
}
