/** Validate AI-generated timetables before they can modify a user's workspace. */
export type AiScheduleSlot = {
  day:number;from:string;duration:number;room:string
  /** Optional fields of a module appointment. */
  recurrence?:'weekly'|'biweekly'|'once'
  date?:string
  endDate?:string
  organizer?:string
  onlineLink?:string
}
export type AiScheduleTopic = {label:string;category:string;slots:AiScheduleSlot[]}
export type AiScheduleAssessment = {type:'exam'|'homework';title:string;date:string;from?:string;to?:string;weight?:number;completed?:boolean}
export type AiScheduleException = {topicLabel:string;date:string;action:'move'|'cancel';targetDate?:string;from?:string;to?:string}
export type AiSchedulePreview = {topics:AiScheduleTopic[];assessments:AiScheduleAssessment[];exceptions:AiScheduleException[];errors:string[]}

export const aiScheduleCategories=['Vorlesung','Übung','Tutorium','Seminar','Freies Lernen'] as const
const record=(value:unknown):Record<string,unknown>|null=>
  value!==null&&typeof value==='object'&&!Array.isArray(value)?value as Record<string,unknown>:null
const validTime=(value:string)=>/^([01]\d|2[0-3]):[0-5]\d$/.test(value)
const timeMinutes=(value:string)=>Number(value.slice(0,2))*60+Number(value.slice(3))
const validDate=(value:string)=>{
  if(!/^\d{4}-\d{2}-\d{2}$/.test(value))return false
  const date=new Date(value+'T12:00:00Z')
  return Number.isFinite(date.getTime())&&date.toISOString().slice(0,10)===value
}
const weekdayOf=(date:string)=>(new Date(date+'T12:00:00Z').getUTCDay()+6)%7
const validLink=(value:string)=>{
  if(!value)return true
  try{const url=new URL(value);return url.protocol==='https:'||url.protocol==='http:'}
  catch{return false}
}
export function parseAiSchedulePreview(value:unknown):AiSchedulePreview {
  const data=record(value)
  const preview=record(data?.preview)||data
  if(!preview)throw new Error('Die KI hat keine gültigen Angaben erkannt. Bitte beschreibe sie genauer.')
  const topicInput=Array.isArray(preview.topics)?preview.topics:[]
  const assessmentInput=Array.isArray(preview.assessments)?preview.assessments:[]
  const exceptionInput=Array.isArray(preview.exceptions)?preview.exceptions:[]
  if(topicInput.length>25||assessmentInput.length>30||exceptionInput.length>30||!topicInput.length&&!assessmentInput.length&&!exceptionInput.length)
    throw new Error('Die KI hat keine gültigen Angaben erkannt. Bitte beschreibe sie genauer.')
  const errors=Array.isArray(preview.errors)?preview.errors.slice(0,8)
    .filter((x):x is string=>typeof x==='string').map(x=>x.trim().slice(0,200)).filter(Boolean):[]
  const topics:AiScheduleTopic[]=topicInput.map((value,index)=>{
    const topic=record(value),label=typeof topic?.label==='string'?topic.label.trim().slice(0,90):''
    const category=typeof topic?.category==='string'?topic.category.trim():''
    if(!label||!aiScheduleCategories.some(x=>x===category))
      throw new Error('Die KI hat bei Veranstaltung '+(index+1)+' eine ungültige Bezeichnung oder Art geliefert.')
    if(!Array.isArray(topic?.slots)||!topic.slots.length||topic.slots.length>12)
      throw new Error('Die KI hat für '+label+' keine gültigen Termine erkannt.')
    const slots:AiScheduleSlot[]=topic.slots.map((value,slotIndex)=>{
      const item=record(value)
      const day=item?.day,from=item?.from,duration=item?.duration,room=item?.room
      if(typeof day!=='number'||!Number.isInteger(day)||day<0||day>6||
        typeof from!=='string'||!validTime(from)||
        typeof duration!=='number'||!Number.isInteger(duration)||duration<5||duration>1440||
        timeMinutes(from)+duration>1440||
        typeof room!=='string'||room.length>140)
        throw new Error('Ungültiger Wochentag, Zeit oder Raum in '+label+' (Termin '+(slotIndex+1)+').')
      const recurrence=item?.recurrence===undefined?'weekly':item.recurrence
      const date=item?.date===undefined?'':item.date
      const endDate=item?.endDate===undefined?'':item.endDate
      const organizer=item?.organizer===undefined?'':item.organizer
      const onlineLink=item?.onlineLink===undefined?'':item.onlineLink
      if(!['once','weekly','biweekly'].includes(recurrence as string)||
        typeof date!=='string'||(date!==''&&!validDate(date))||
        typeof endDate!=='string'||(endDate!==''&&!validDate(endDate))||
        typeof organizer!=='string'||organizer.length>160||
        typeof onlineLink!=='string'||onlineLink.length>500||!validLink(onlineLink)||
        (recurrence==='once'&&!date)||
        (date&&weekdayOf(date)!==day)||
        (endDate&&date&&endDate<date)||
        (recurrence==='once'&&endDate&&endDate!==date))
        throw new Error('Ungültige Wiederholung, Datum, Lehrperson oder Link in '+label+
          ' (Termin '+(slotIndex+1)+'). Einmalige Termine benötigen ein konkretes Datum.')
      return {day,from,duration,room:room.trim().slice(0,100),
        recurrence:recurrence as AiScheduleSlot['recurrence'],date,endDate,organizer:organizer.trim().slice(0,120),
        onlineLink:onlineLink.trim()}
    })
    return {label,category,slots}
  })
  const assessments:AiScheduleAssessment[]=assessmentInput.map((value,index)=>{
    const item=record(value),type=item?.type,title=typeof item?.title==='string'?item.title.trim().slice(0,120):'',date=item?.date
    const from=item?.from===undefined?'':item.from,to=item?.to===undefined?'':item.to,weight=item?.weight,completed=item?.completed===true
    if((type!=='exam'&&type!=='homework')||!title||typeof date!=='string'||!validDate(date)||typeof from!=='string'||typeof to!=='string'||
      (from!==''&&!validTime(from))||(to!==''&&!validTime(to))||(from&&to&&timeMinutes(to)<=timeMinutes(from))||
      (weight!==undefined&&(typeof weight!=='number'||!Number.isFinite(weight)||weight<0||weight>100)))
      throw new Error('Ungültige Prüfung oder Hausaufgabe (Eintrag '+(index+1)+').')
    return {type,title,date,from:from||undefined,to:to||undefined,weight:weight as number|undefined,completed}
  })
  const exceptions:AiScheduleException[]=exceptionInput.map((value,index)=>{
    const item=record(value),topicLabel=typeof item?.topicLabel==='string'?item.topicLabel.trim().slice(0,90):'',date=item?.date,action=item?.action
    const targetDate=item?.targetDate===undefined?'':item.targetDate,from=item?.from===undefined?'':item.from,to=item?.to===undefined?'':item.to
    if(!topicLabel||typeof date!=='string'||!validDate(date)||(action!=='move'&&action!=='cancel')||typeof targetDate!=='string'||typeof from!=='string'||typeof to!=='string'||
      (action==='move'&&(!targetDate||!validDate(targetDate)||!validTime(from)||!validTime(to)||timeMinutes(to)<=timeMinutes(from))))
      throw new Error('Ungültige Ausnahme (Eintrag '+(index+1)+').')
    return {topicLabel,date,action,targetDate:targetDate||undefined,from:from||undefined,to:to||undefined}
  })
  return {topics,assessments,exceptions,errors}
}
