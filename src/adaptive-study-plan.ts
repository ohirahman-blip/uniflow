import {addDays,dateString,fromDate,minutes,occurrencesOn,selectedAssessment,today,weekday,type AppData} from './model'
import {numberedLessons,type NumberedLesson} from './score'
import {lessonProgressMap} from './lesson-progress'

export type LessonDifficulty='easy'|'medium'|'hard'
export const difficultyMinutes:Record<LessonDifficulty,number>={easy:30,medium:60,hard:120}
export type StudySchedulePreferences={
  enabled:boolean;weekdays:number[];minutesPerDay:number;windowStart:number;windowEnd:number // minutesPerDay is legacy-only; never limits planning
  excludedDates:string[];excludedByExam:Record<string,string[]>;lessonMinutes:Record<string,number>;lessonDifficulty:Record<string,LessonDifficulty>;reviewAfter:Record<string,string>
}
export const defaultStudySchedule:StudySchedulePreferences={enabled:true,weekdays:[0,1,2,3,4,5,6],minutesPerDay:60,windowStart:9*60,windowEnd:20*60,excludedDates:[],excludedByExam:{},lessonMinutes:{},lessonDifficulty:{},reviewAfter:{}}
export function studyPreferences(data:Pick<AppData,'studySchedule'>):StudySchedulePreferences{
  const raw=data.studySchedule
  const weekdays=!Array.isArray(raw?.weekdays)?defaultStudySchedule.weekdays:[...new Set(raw.weekdays)].filter(day=>Number.isInteger(day)&&day>=0&&day<7).sort()
  const bound=(value:number|undefined,fallback:number,min:number,max:number)=>Number.isFinite(value)?Math.max(min,Math.min(max,Number(value))):fallback
  const windowStart=bound(raw?.windowStart,540,0,1410)
  const excludedByExam=raw?.excludedByExam&&typeof raw.excludedByExam==='object'?Object.fromEntries(Object.entries(raw.excludedByExam).filter(([,keys])=>Array.isArray(keys)).map(([id,keys])=>[id,keys.filter(key=>typeof key==='string')])):{}
  const lessonMinutes=raw?.lessonMinutes&&typeof raw.lessonMinutes==='object'?Object.fromEntries(Object.entries(raw.lessonMinutes).filter(([,value])=>typeof value==='number'&&Number.isFinite(value)&&value>0)):{}
  const lessonDifficulty=raw?.lessonDifficulty&&typeof raw.lessonDifficulty==='object'?Object.fromEntries(Object.entries(raw.lessonDifficulty).filter(([,value])=>['easy','medium','hard'].includes(value))) as Record<string,LessonDifficulty>:{}
  const reviewAfter=raw?.reviewAfter&&typeof raw.reviewAfter==='object'?Object.fromEntries(Object.entries(raw.reviewAfter).filter(([,value])=>typeof value==='string'&&Number.isFinite(Date.parse(value)))):{}
  return {enabled:raw?.enabled!==false,weekdays,minutesPerDay:Math.round(bound(raw?.minutesPerDay,60,15,480)/15)*15,windowStart,windowEnd:bound(raw?.windowEnd,1200,windowStart+30,1440),
    excludedDates:Array.isArray(raw?.excludedDates)?raw.excludedDates.filter(day=>/^\d{4}-\d{2}-\d{2}$/.test(day)):[],
    excludedByExam,lessonMinutes,lessonDifficulty,reviewAfter}
}
export function lessonDifficultyFor(preferences:StudySchedulePreferences,key:string):LessonDifficulty{
  const choice=preferences.lessonDifficulty[key]
  if(choice)return choice
  const legacy=preferences.lessonMinutes[key]
  return legacy?legacy<=45?'easy':legacy<=75?'medium':'hard':'medium'
}
export function pendingReviewKeys(data:Pick<AppData,'scoreEvents'|'learningSessions'>,preferences:StudySchedulePreferences){
  const created=new Map((data.scoreEvents||[]).filter(event=>event.type==='study-minutes'&&!event.reversedAt).map(event=>[event.sourceId,event.occurredAt]))
  const reversed=new Set((data.scoreEvents||[]).filter(event=>event.type==='study-minutes'&&event.reversedAt).map(event=>event.sourceId))
  const latest=new Map<string,string>()
  for(const session of data.learningSessions||[]){
    if(reversed.has(session.id))continue
    const when=created.get(session.id)||session.endedAt||session.updatedAt
    for(const key of new Set([...(session.lessonKeys||[]),...(session.lessonKey?[session.lessonKey]:[])]))if(when>(latest.get(key)||''))latest.set(key,when)
  }
  return new Set(Object.entries(preferences.reviewAfter).filter(([key,when])=>when>(latest.get(key)||'')).map(([key])=>key))
}
export type StudyPlanItem={key:string;label:string;minutes:number;target:number}
export type StudyDayBundle={id:string;date:string;moduleId:string;examId:string;minutes:number;items:StudyPlanItem[];completed?:boolean}
export type StudyPlanNotice={moduleId?:string;message:string;severity:'info'|'warning'}
export type StudyPlan={reference:string;preferences:StudySchedulePreferences;bundles:StudyDayBundle[];notices:StudyPlanNotice[];lessons:NumberedLesson[]}
export type StudyGap={id:string;date:string;moduleId:string;from:number;to:number;labels:string[]}
type Window={from:number;to:number}
const dayDistance=(a:string,b:string)=>Math.round((fromDate(b).getTime()-fromDate(a).getTime())/86400000)
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
  const progress=lessonProgressMap(data),reviews=pendingReviewKeys(data,preferences)
  const reversed=new Set((data.scoreEvents||[]).filter(event=>event.type==='study-minutes'&&event.reversedAt).map(event=>event.sourceId))
  const sessions=(data.learningSessions||[]).filter(session=>!reversed.has(session.id))
  const history=new Map<string,string>()
  for(const session of sessions){
    const keys=[...new Set([...(session.lessonKeys||[]),...(session.lessonKey?[session.lessonKey]:[])])]
    for(const key of keys)if(session.date>(history.get(key)||''))history.set(key,session.date)
  }
  const semesterLessons=new Map<string,NumberedLesson[]>()
  type Unit={lesson:NumberedLesson;examId:string;deadline:string;loose:boolean;release:string;level:number;base:number;last:string;moduleId:string}
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
      const actualLevel=progress.get(lesson.key)?.green||0
      const level=actualLevel>=4&&reviews.has(lesson.key)?3:actualLevel
      if(level>=4)continue
      const historic=history.get(lesson.key)
      const base=difficultyMinutes[lessonDifficultyFor(preferences,lesson.key)]
      units.push({lesson,examId:exam.id,deadline:exam.date?addDays(exam.date,-1):addDays(reference,13),loose:!exam.date,release:lesson.occurrence.date>reference?lesson.occurrence.date:reference,level,base,last:reviews.has(lesson.key)?'':historic||'',moduleId:lesson.moduleId})
    }
  }
  result.lessons=[...lessonMap.values()]
  const dated=exams.filter(exam=>exam.date).map(exam=>addDays(exam.date,-1))
  const end=[...dated,addDays(reference,exams.some(exam=>!exam.date)?13:0)].sort().pop()||reference
  const horizon=end<addDays(reference,365)?end:addDays(reference,365)
  // Minutes are planning weights, never a daily allowance. Keep whole tasks intact.
  const dates:string[]=[],windowsByDate=new Map<string,Window[]>(),loads=new Map<string,number>()
  for(let date=reference;date<=horizon;date=addDays(date,1)){
    dates.push(date)
    const windows=studyFreeWindows(data,date,preferences).map(window=>({...window}))
    // Actual work already done uses real free time, not a configurable daily budget.
    let done=sessions.filter(session=>session.date===date).reduce((sum,session)=>sum+Math.max(0,session.duration),0)
    loads.set(date,done)
    for(const window of windows){const spent=Math.min(done,window.to-window.from);window.from+=spent;done-=spent}
    windowsByDate.set(date,windows)
  }
  // Deadline-specific balancing weights, never caps. Reserve room for feedback/reviews.
  const balancingLoads=new Map<string,number>()
  for(const deadline of new Set(units.map(unit=>unit.deadline))){
    const availableDays=dates.filter(date=>date<=deadline&&windowsByDate.get(date)?.some(window=>window.to-window.from>=30)).length
    const firstWork=units.filter(unit=>unit.level<3&&unit.deadline<=deadline).reduce((sum,unit)=>sum+unit.base,0)
    balancingLoads.set(deadline,Math.max(60,firstWork/Math.max(1,availableDays*0.45)))
  }
  const bundles=new Map<string,StudyDayBundle>(),firstDates=new Map<string,string>()
  const ordered=units.sort((a,b)=>a.deadline.localeCompare(b.deadline)||a.lesson.occurrence.date.localeCompare(b.lesson.occurrence.date)||a.lesson.occurrence.from.localeCompare(b.lesson.occurrence.from)||a.lesson.key.localeCompare(b.lesson.key))
  const allocated=new Map<string,string>(),plannedLevels=new Map<string,number>(),missing=new Map<string,number>()
  const schedule=(unit:Unit,target:number,earliest:string,optional=false)=>{
    let chosen:string|undefined,best=Infinity,chosenWindow:Window|undefined
    for(const date of dates){
      if(date<earliest||date<unit.release||date>unit.deadline)continue
      if(unit.loose){
        const hash=[...unit.moduleId].reduce((sum,char)=>sum+char.charCodeAt(0),0)
        const index=preferences.weekdays.indexOf(weekday(date)),offset=hash%preferences.weekdays.length
        if(index!==offset&&index!==(offset+Math.ceil(preferences.weekdays.length/2))%preferences.weekdays.length)continue
      }
      const releaseMinute=unit.lesson.occurrence.date===date?minutes(unit.lesson.occurrence.to)+10:preferences.windowStart
      const window=windowsByDate.get(date)?.find(window=>window.to-Math.max(window.from,releaseMinute)>=unit.base)
      if(!window)continue
      // Start early, spread whole tasks, and keep nearby exams from monopolizing a day.
      const score=dayDistance(earliest,date)*20+(loads.get(date)||0)/balancingLoads.get(unit.deadline)!*24
      if(score<best){chosen=date;best=score;chosenWindow=window}
    }
    if(!chosen||!chosenWindow){
      if(!optional)missing.set(unit.moduleId,(missing.get(unit.moduleId)||0)+1)
      return undefined
    }
    const from=Math.max(chosenWindow.from,unit.lesson.occurrence.date===chosen?minutes(unit.lesson.occurrence.to)+10:preferences.windowStart)
    if(from>chosenWindow.from)windowsByDate.get(chosen)!.push({from:chosenWindow.from,to:from})
    chosenWindow.from=from+unit.base
    windowsByDate.get(chosen)!.sort((a,b)=>a.from-b.from)
    loads.set(chosen,(loads.get(chosen)||0)+unit.base)
    const id=chosen+':'+unit.moduleId
    const bundle=bundles.get(id)||{id,date:chosen,moduleId:unit.moduleId,examId:unit.examId,minutes:0,items:[]}
    bundle.items.push({key:unit.lesson.key,label:unit.lesson.label,minutes:unit.base,target})
    bundle.minutes+=unit.base;bundles.set(id,bundle);allocated.set(unit.lesson.key,chosen);plannedLevels.set(unit.lesson.key,target)
    return chosen
  }
  // Required learning comes first. Calendar chronology interleaves lectures/exercises/tutorials.
  for(const unit of ordered.filter(unit=>unit.level<3)){
    const last=unit.last?addDays(unit.last,1):reference
    const previous=firstDates.get(unit.moduleId)||reference
    const earliest=[reference,last,previous,unit.release].sort().pop()!
    const date=schedule(unit,unit.level<2?2:3,earliest)
    if(date)firstDates.set(unit.moduleId,date)
  }
  // Initial learning assumes partial understanding, then reserves a full deepening block.
  for(const unit of ordered.filter(unit=>unit.level<2)){
    const first=allocated.get(unit.lesson.key)
    if(first&&!schedule(unit,3,addDays(first,3),true))schedule(unit,3,addDays(first,1))
  }
  // Good understanding needs only a spaced review; in tight periods this is optional.
  for(const unit of ordered){
    const last=allocated.get(unit.lesson.key)||unit.last
    if((plannedLevels.get(unit.lesson.key)||unit.level)<3)continue
    const earliest=last?addDays(last,unit.level===3?3:7):reference
    schedule(unit,4,earliest,true)
  }
  result.bundles=[...bundles.values()].sort((a,b)=>a.date.localeCompare(b.date)||a.moduleId.localeCompare(b.moduleId))
  for(const [moduleId,count] of missing)result.notices.push({moduleId,severity:'warning',message:`${count} vollständige Lernblöcke passen vor der Prüfung nicht mehr auf die verfügbaren Lerntage. Gib weitere Lerntage frei oder prüfe den Stoffumfang.`})
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
    if(result.length>=2)break
    const match=bundle.items.map(item=>{
      const lesson=plan.lessons.find(lesson=>lesson.key===item.key)
      const release=lesson?.occurrence.date===date?minutes(lesson.occurrence.to)+10:0
      const window=candidates.find(window=>window.to-Math.max(window.from,release)>=item.minutes)
      return {item,release,window}
    }).find(match=>match.window&&match.item.minutes>=15)
    if(!match?.window)continue
    const {window,item,release}=match,duration=item.minutes,start=Math.max(window.from,release)
    const beforeClass=obligations.some(item=>Math.abs(minutes(item.from)-window.to)<=15)
    const length=Math.min(duration,window.to-start),from=beforeClass?window.to-length:start,to=from+length
    result.push({id:date+':'+bundle.moduleId,date,moduleId:bundle.moduleId,from,to,labels:[item.label]})
    window.from=to+10
  }
  return result
}

export function localPlanDate(now=new Date()){return dateString(now)}
