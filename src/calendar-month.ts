import { addDays, dateString, fromDate, weekStart } from './model'

export function shiftCalendarMonth(anchor:string,direction:number):string {
  const date=fromDate(anchor)
  const first=new Date(date.getFullYear(),date.getMonth()+direction,1)
  const last=new Date(first.getFullYear(),first.getMonth()+1,0).getDate()
  return dateString(new Date(first.getFullYear(),first.getMonth(),Math.min(date.getDate(),last)))
}
export function calendarMonthDates(anchor:string):string[]{
  const d=fromDate(anchor)
  const first=dateString(new Date(d.getFullYear(),d.getMonth(),1))
  const last=new Date(d.getFullYear(),d.getMonth()+1,0).getDate()
  const lead=(fromDate(first).getDay()+6)%7
  const length=Math.ceil((lead+last)/7)*7
  const monday=weekStart(first)
  return Array.from({length},(_,i)=>addDays(monday,i))
}
