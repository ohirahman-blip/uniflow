import {addDays,dateString,examVisibilityEnd,fromDate,isAssessment,occurrencesOn,today,type AppData,type Semester} from './model'
const dayKey=(userId:string,semesterId:string)=>`uniflow-calendar-day:v1:${userId}:${semesterId}`
export function initialCalendarDay(data:AppData,semester:Semester,userId:string):string{
  try{
    const saved=localStorage.getItem(dayKey(userId,semester.id))
    if(saved&&/^\d{4}-\d{2}-\d{2}$/.test(saved)&&dateString(fromDate(saved))===saved)return saved
  }catch{/* Navigation remains usable when storage is unavailable. */}
  const end=examVisibilityEnd(semester),reference=today(),start=reference<semester.start?semester.start:reference>end?end:reference
  const offerings=data.offerings.filter(item=>item.semesterId===semester.id&&!isAssessment(item.category)&&item.category!=='Freies Lernen')
  for(let date=start,offset=0;date<=end&&offset<730;date=addDays(date,1),offset++){
    const weekday=(fromDate(date).getDay()+6)%7
    if(weekday>(data.weekEndDay??4))continue
    if(occurrencesOn(offerings,date).some(item=>!item.cancelled))return date
  }
  return start
}
export function rememberCalendarDay(userId:string,semesterId:string,date:string){
  try{localStorage.setItem(dayKey(userId,semesterId),date)}catch{/* Storage is optional. */}
}
