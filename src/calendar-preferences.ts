import {today,type AppData,type Semester} from './model'
const dayKey=(userId:string,semesterId:string)=>`uniflow-calendar-day:v1:${userId}:${semesterId}`
/** Every fresh calendar mount starts on the actual local day. */
export function initialCalendarDay(_data:AppData,_semester:Semester,_userId:string):string{
  return today()
}
export function rememberCalendarDay(userId:string,semesterId:string,date:string){
  try{localStorage.setItem(dayKey(userId,semesterId),date)}catch{/* Storage is optional. */}
}
