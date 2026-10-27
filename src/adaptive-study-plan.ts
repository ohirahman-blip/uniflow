import {addDays,dateString,fromDate,minutes,occurrencesOn,selectedAssessment,today,weekday,type AppData} from './model'
import {numberedLessons,type NumberedLesson} from './score'
import {lessonProgressMap} from './lesson-progress'

export type StudySchedulePreferences={
  enabled:boolean;weekdays:number[];minutesPerDay:number;windowStart:number;windowEnd:number
  excludedDates:string[];excludedByExam:Record<string,string[]>;lessonMinutes:Record<string,number>
}
export const defaultStudySchedule:StudySchedulePreferences={enabled:true,weekdays:[0,1,2,3,4,5,6],minutesPerDay:60,windowStart:9*60,windowEnd:20*60,excludedDates:[],excludedByExam:{},lessonMinutes:{}}
export function studyPreferences(data:Pick<AppData,'studySchedule'>):StudySchedulePreferences{
  const raw=data.studySchedule
  const weekdays=!Array.isArray(raw?.weekdays)?defaultStudySchedule.weekdays:[...new Set(raw.weekdays)].filter(day=>Number.isInteger(day)&&day>=0&&day<7).sort()
  const bound=(value:number|undefined,fallback:number,min:number,max:number)=>Number.isFinite(value)?Math.max(min,Math.min(max,Number(value))):fallback
  const windowStart=bound(raw?.windowStart,540,0,1410)
  const excludedByExam=raw?.excludedByExam&&typeof raw.excludedByExam==='object'?Object.fromEntries(Object.entries(raw.excludedByExam).filter(([,keys])=>Array.isArray(keys)).map(([id,keys])=>[id,keys.filter(key=>typeof key==='string')])):{}
  const lessonMinutes=raw?.lessonMinutes&&typeof raw.lessonMinutes==='object'?Object.fromEntries(Object.entries(raw.lessonMinutes).filter(([,value])=>typeof value==='number'&&Number.isFinite(value)&&value>0)):{}
  return {enabled:raw?.enabled!==false,weekdays,minutesPerDay:Math.round(bound(raw?.minutesPerDay,60,15,480)/15)*15,windowStart,windowEnd:bound(raw?.windowEnd,1200,windowStart+30,1440),
    excludedDates:Array.isArray(raw?.excludedDates)?raw.excludedDates.filter(day=>/^\d{4}-\d{2}-\d{2}$/.test(day)):[],
    excludedByExam,lessonMinutes}
}
export type StudyPlanItem={key:string;label:string;minutes:number;target:number}
export type StudyDayBundle={id:string;date:string;moduleId:string;examId:string;minutes:number;items:StudyPlanItem[];completed?:boolean}
export type StudyPlanNotice={moduleId?:string;message:string;severity:'info'|'warning'}
export type StudyPlan={reference:string;preferences:StudySchedulePreferences;bundles:StudyDayBundle[];notices:StudyPlanNotice[];lessons:NumberedLesson[]}
export type StudyGap={id:string;date:string;moduleId:string;from:number;to:number;labels:string[]}
type Window={from:number;to:number}
const dayDistance=(a:string,b:string)=>Math.round((fromDate(b).getTime()-fromDate(a).getTime())/86400000)
const rounded=(value:number)=>Math.ceil(value/15)*15
const weekdaysOpen=(date:string,prefs:StudySchedulePreferences)=>prefs.weekdays.includes(weekday(date))&&!prefs.excludedDates.includes(date)

/** Real calendar obligations, independent of a currently selected display filter. */
export function studyFreeWindows(data:AppData,date:string,prefs=studyPreferences(data)):Window[]{
  if(!weekdaysOpen(date,prefs))return []
  const busy=occurrencesOn(data.offerings,date).filter(item=>!item.cancelled).map(item=>({from:minutes(item.from)-10,to:minutes(item.to)+10}))
  for(const exam of data.assessments.filter(item=>item.type==='exam'&&!item.completed&&item.date===date&&selectedAssessment(item,data.assessments))){
    busy.push({from:exam.from?minutes(exam.from)-15:prefs.windowStart,to:exam.to?minutes(exam.to)+15:exam.from?minutes(exam.from)+135:prefs.windowEnd})
  }
  busy.sort((a,b)=>a.from-b.from)
  const free:Window[]=[]
  let cursor=prefs.windowStart
  for(const block of busy){
    if(block.to<=cursor||block.from>=prefs.windowEnd)continue
    if(block.from>cursor)free.push({from:cursor,to:Math.min(block.from,prefs.windowEnd)})
    cursor=Math.max(cursor,block.to)
  }
  if(cursor<prefs.windowEnd)free.push({from:cursor,to:prefs.windowEnd})
  return free.filter(window=>window.to-window.from>=15)
}

export function buildStudyPlan(data:AppData,reference=today()):StudyPlan{
  const preferences=studyPreferences(data),result:StudyPlan={reference,preferences,bundles:[],notices:[],lessons:[]}
  if(!preferences.enabled)return result
  if(!preferences.weekdays.length){result.notices.push({severity:'warning',message:'Wähle mindestens einen Lerntag in den Einstellungen.'});return result}
  const modules=new Set(data.modules.filter(module=>module.degreeId===data.activeDegreeId&&!module.hidden&&!['planned','passed','recognized'].includes(module.status)).map(module=>module.id))
  const exams=data.assessments.filter(exam=>exam.type==='exam'&&!exam.completed&&modules.has(exam.moduleId)&&selectedAssessment(exam,data.assessments)&&(!exam.date||exam.date>=reference)).sort((a,b)=>(a.date||'9999').localeCompare(b.date||'9999')||a.id.localeCompare(b.id))
  if(!exams.length){result.notices.push({severity:'info',message:'Mit einer anstehenden Prüfung entsteht hier dein Lernplan.'});return result}
  const progress=lessonProgressMap(data)
  const reversed=new Set((data.scoreEvents||[]).filter(event=>event.type==='study-minutes'&&event.reversedAt).map(event=>event.sourceId))
  const sessions=(data.learningSessions||[]).filter(session=>!reversed.has(session.id))
  const history=new Map<string,{minutes:number;count:number;latest:string}>()
  for(const session of sessions){
    const keys=[...new Set([...(session.lessonKeys||[]),...(session.lessonKey?[session.lessonKey]:[])])]
    for(const key of keys){const old=history.get(key)||{minutes:0,count:0,latest:''};old.minutes+=session.duration/keys.length;old.count++;old.latest=old.latest>session.date?old.latest:session.date;history.set(key,old)}
  }
  const semesterLessons=new Map<string,NumberedLesson[]>()
  type Unit={lesson:NumberedLesson;examId:string;deadline:string;loose:boolean;release:string;level:number;remaining:number;base:number;last:string;moduleId:string}
  const units:Unit[]=[],seen=new Set<string>(),lessonMap=new Map<string,NumberedLesson>()
  for(const exam of exams){
    const semester=data.semesters.find(item=>item.id===exam.semesterId)
    if(!semester)continue
    let lessons=semesterLessons.get(semester.id)
    if(!lessons){lessons=numberedLessons(data,semester);semesterLessons.set(semester.id,lessons)}
    const scope=lessons.filter(lesson=>lesson.moduleId===exam.moduleId&&(!exam.date||lesson.occurrence.date<exam.date))
    for(const lesson of scope)lessonMap.set(lesson.key,lesson)
    if(!scope.length)result.notices.push({moduleId:exam.moduleId,severity:'info',message:'Für diese Prüfung ist noch kein Stoff im Stundenplan hinterlegt.'})
    if(!exam.date)result.notices.push({moduleId:exam.moduleId,severity:'info',message:'Ohne Prüfungstermin: lockere Wochenplanung statt festem Abschlussdatum.'})
    const excluded=new Set(preferences.excludedByExam[exam.id]||[])
    for(const lesson of scope){
      if(seen.has(lesson.key)||excluded.has(lesson.key))continue
      seen.add(lesson.key)
      const level=progress.get(lesson.key)?.green||0
      if(level>=4)continue
      const historic=history.get(lesson.key)
      const observed=historic?.count?historic.minutes/historic.count:30
      const custom=preferences.lessonMinutes[lesson.key]
      const base=rounded(Math.max(15,Math.min(120,Number.isFinite(custom)?custom:observed)))
      const remaining=level===0?base:level<3?rounded(Math.max(15,base*.6)):rounded(Math.max(15,60-(historic?.minutes||0)))
      units.push({lesson,examId:exam.id,deadline:exam.date?addDays(exam.date,-1):addDays(reference,13),loose:!exam.date,release:lesson.occurrence.date>reference?lesson.occurrence.date:reference,level,remaining,base,last:historic?.latest||'',moduleId:lesson.moduleId})
    }
  }
  result.lessons=[...lessonMap.values()]
  const dated=exams.filter(exam=>exam.date).map(exam=>addDays(exam.date,-1))
  const end=[...dated,addDays(reference,exams.some(exam=>!exam.date)?13:0)].sort().pop()||reference
  const horizon=end<addDays(reference,365)?end:addDays(reference,365)
  const capacities=new Map<string,number>()
  for(let date=reference;date<=horizon;date=addDays(date,1)){
    const free=studyFreeWindows(data,date,preferences).reduce((sum,window)=>sum+window.to-window.from,0)
    const done=sessions.filter(session=>session.date===date).reduce((sum,session)=>sum+Math.max(0,session.duration),0)
    capacities.set(date,Math.max(0,Math.floor((Math.min(preferences.minutesPerDay,free)-done)/15)*15))
  }
  const dates=[...capacities.keys()],bundles=new Map<string,StudyDayBundle>()
  for(const date of dates){
    let budget=capacities.get(date)||0
    if(budget<15)continue
    const windows=studyFreeWindows(data,date,preferences)
    const allocated=new Map<string,number>()
    const coverageByModule=new Map<string,number>(),coverageByDeadline=new Map<string,number>(),availableByDeadline=new Map<string,number>()
    for(const unit of units){
      if(unit.level===0){
        coverageByModule.set(unit.moduleId,(coverageByModule.get(unit.moduleId)||0)+unit.remaining)
        if(!unit.loose)coverageByDeadline.set(unit.deadline,(coverageByDeadline.get(unit.deadline)||0)+unit.remaining)
      }
      if(!availableByDeadline.has(unit.deadline))availableByDeadline.set(unit.deadline,dates.reduce((sum,day)=>sum+(day>=date&&day<=unit.deadline?(capacities.get(day)||0):0),0))
    }
    while(budget>=15){
      let choice:Unit|undefined,best=-Infinity
      const eligibleFirst=units.some(unit=>!unit.loose&&unit.level===0&&date>=unit.release&&date<=unit.deadline&&unit.last<date&&windows.some(window=>window.to-Math.max(window.from,unit.lesson.occurrence.date===date?minutes(unit.lesson.occurrence.to)+10:preferences.windowStart)>=15))
      const coverageIsTight=[...availableByDeadline].some(([deadline,available])=>{
        const required=[...coverageByDeadline].reduce((sum,[due,needed])=>sum+(due<=deadline?needed:0),0)
        return required>available-((capacities.get(date)||0)-budget)-15
      })
      for(const unit of units){
        if(unit.level>=4||date<unit.release||date>unit.deadline||unit.last>=date)continue
        if((unit.level>0||unit.loose)&&coverageIsTight&&eligibleFirst)continue
        const releaseMinute=unit.lesson.occurrence.date===date?minutes(unit.lesson.occurrence.to)+10:preferences.windowStart
        if(!windows.some(window=>window.to-Math.max(window.from,releaseMinute)>=15))continue
        const distance=dayDistance(date,unit.deadline)
        // Low-pressure distant subjects start twice weekly; close/heavy ones do not wait.
        const coverage=coverageByModule.get(unit.moduleId)||0
        const available=availableByDeadline.get(unit.deadline)||0
        const pressure=coverage/Math.max(15,available)
        if(unit.loose||distance>28&&pressure<.3&&!(unit.level===0&&coverageIsTight)){
          const hash=[...unit.moduleId].reduce((sum,char)=>sum+char.charCodeAt(0),0)
          const index=preferences.weekdays.indexOf(weekday(date)),offset=hash%preferences.weekdays.length
          if(index!==offset&&index!==(offset+Math.ceil(preferences.weekdays.length/2))%preferences.weekdays.length)continue
        }
        const tier=unit.level===0?140:unit.level===1?55:unit.level===2?48:28
        const priority=tier/Math.max(3,distance+1)*(1+Math.min(2,pressure))/(1+(allocated.get(unit.moduleId)||0)/30)*(unit.loose?0.35:1)
        if(priority>best||priority===best&&unit.lesson.key<(choice?.lesson.key||'')){best=priority;choice=unit}
      }
      if(!choice)break
      const spent=Math.min(15,budget,choice.remaining),id=date+':'+choice.moduleId
      const releaseMinute=choice.lesson.occurrence.date===date?minutes(choice.lesson.occurrence.to)+10:preferences.windowStart
      const window=windows.find(window=>window.to-Math.max(window.from,releaseMinute)>=spent)!
      const allocationStart=Math.max(window.from,releaseMinute)
      if(allocationStart>window.from)windows.push({from:window.from,to:allocationStart})
      window.from=allocationStart+spent
      windows.sort((a,b)=>a.from-b.from)
      let bundle=bundles.get(id)
      if(!bundle){bundle={id,date,moduleId:choice.moduleId,examId:choice.examId,minutes:0,items:[]};bundles.set(id,bundle)}
      let item=bundle.items.find(item=>item.key===choice!.lesson.key)
      if(!item){item={key:choice.lesson.key,label:choice.lesson.label,minutes:0,target:choice.level+1};bundle.items.push(item)}
      item.minutes+=spent;bundle.minutes+=spent;budget-=spent;choice.remaining-=spent
      if(choice.level===0){
        coverageByModule.set(choice.moduleId,Math.max(0,(coverageByModule.get(choice.moduleId)||0)-spent))
        if(!choice.loose)coverageByDeadline.set(choice.deadline,Math.max(0,(coverageByDeadline.get(choice.deadline)||0)-spent))
      }
      allocated.set(choice.moduleId,(allocated.get(choice.moduleId)||0)+spent)
      if(choice.remaining<=0){
        choice.level++;choice.last=date
        choice.remaining=choice.level<3?rounded(Math.max(15,choice.base*.6)):rounded(Math.max(15,60-(history.get(choice.lesson.key)?.minutes||0)-choice.base))
      }
    }
  }
  result.bundles=[...bundles.values()].sort((a,b)=>a.date.localeCompare(b.date)||a.moduleId.localeCompare(b.moduleId))
  for(const moduleId of new Set(units.map(unit=>unit.moduleId))){
    const remaining=units.filter(unit=>unit.moduleId===moduleId&&!unit.loose&&unit.level===0)
    if(remaining.length)result.notices.push({moduleId,severity:'warning',message:`${remaining.length} Stoffeinheiten schaffen es mit diesen Lerntagen und dem Zeitbudget nicht bis zur Prüfung auf den ersten grünen Strich. Passe Budget oder Prüfungsumfang an.`})
  }
  // Finished sessions remain visible as history; no historical plan is rewritten.
  const completed=new Map<string,StudyDayBundle>()
  for(const session of sessions.filter(session=>modules.has(session.moduleId)&&session.date>=addDays(reference,-14)&&session.date<=reference)){
    const keys=[...new Set([...(session.lessonKeys||[]),...(session.lessonKey?[session.lessonKey]:[])])].filter(key=>lessonMap.has(key))
    if(!keys.length)continue
    const id='done:'+session.date+':'+session.moduleId
    const bundle=completed.get(id)||{id,date:session.date,moduleId:session.moduleId,examId:'',minutes:0,items:[],completed:true}
    bundle.minutes+=session.duration
    for(const key of keys)if(!bundle.items.some(item=>item.key===key))bundle.items.push({key,label:lessonMap.get(key)!.label,minutes:0,target:progress.get(key)?.green||1})
    completed.set(id,bundle)
  }
  result.bundles.push(...completed.values())
  return result
}

/** Informational windows only: never writes an appointment or removes planned work. */
export function studyGapSuggestions(data:AppData,plan:StudyPlan,date:string,nowMinutes=0):StudyGap[]{
  if(!plan.preferences.enabled||date<plan.reference)return []
  const bundles=plan.bundles.filter(bundle=>!bundle.completed&&bundle.date===date)
  const free=studyFreeWindows(data,date,plan.preferences)
  const obligations=occurrencesOn(data.offerings,date).filter(item=>!item.cancelled)
  const candidates=free.map(window=>({...window,from:date===plan.reference?Math.max(window.from,Math.ceil((nowMinutes+10)/5)*5):window.from})).filter(window=>window.to-window.from>=30)
  candidates.sort((a,b)=>{
    const score=(window:Window)=>Number(!obligations.some(item=>Math.abs(minutes(item.to)-window.from)<=15||Math.abs(minutes(item.from)-window.to)<=15))
    return score(a)-score(b)||a.from-b.from
  })
  const result:StudyGap[]=[]
  for(const bundle of bundles){
    if(result.length>=2||bundle.minutes<15)break
    const latestContent=Math.max(0,...bundle.items.map(item=>{const lesson=plan.lessons.find(lesson=>lesson.key===item.key);return lesson?.occurrence.date===date?minutes(lesson.occurrence.to)+10:0}))
    const window=candidates.find(window=>window.to-Math.max(window.from,latestContent)>=30)
    if(!window)continue
    const duration=Math.min(45,Math.max(30,bundle.minutes)),start=Math.max(window.from,latestContent)
    const beforeClass=obligations.some(item=>Math.abs(minutes(item.from)-window.to)<=15)
    const length=Math.min(duration,window.to-start),from=beforeClass?window.to-length:start,to=from+length
    result.push({id:date+':'+bundle.moduleId,date,moduleId:bundle.moduleId,from,to,labels:bundle.items.map(item=>item.label)})
    window.from=to+10
  }
  return result
}

export function localPlanDate(now=new Date()){return dateString(now)}
