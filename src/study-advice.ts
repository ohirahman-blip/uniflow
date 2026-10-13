import {
  addDays, formatDate, fromDate, isAssessment, minutes, occurrencesOn,
  type AppData, type Occurrence, type Semester, type StudyModule
} from './model'
import { lessonForOccurrence, pastLessons, type LearningRating } from './learning'

export type AdviceKind = 'review' | 'exam' | 'prepare' | 'checkin'
export type StudyAdvice = {
  title: string
  message: string
  moduleId?: string
  lessonKey?: string
  minutes: number
  kind:AdviceKind
  source:'local'|'deepseek'
}
export type ContextLecture = {
  moduleId:string
  moduleName:string
  topic:string
  lessonKey:string
  date:string
  time:string
  minutesUntil:number
}
export type ContextWeak = {
  moduleId:string
  moduleName:string
  topic:string
  lessonKey:string
  date:string
  rating:LearningRating|'unrated'
}
export type AdviceContext = {
  today:string
  localTime:string
  timeZone:string
  freeMinutes:number
  nextLecture:ContextLecture|null
  previousWeak:ContextWeak|null
  pendingFeedback:ContextWeak|null
  exams:{moduleId:string;moduleName:string;date:string;daysUntil:number}[]
  otherWeak:ContextWeak[]
}
const isoLocal=(d:Date)=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
const diffDays=(a:string,b:string)=>Math.round((fromDate(a).getTime()-fromDate(b).getTime())/86400000)
const differenceMinutes=(date:string,time:string,now:Date)=> {
  const target=fromDate(date)
  const m=minutes(time)
  target.setHours(Math.floor(m/60),m%60,0,0)
  return Math.round((target.getTime()-now.getTime())/60000)
}
const isTeaching=(o:Occurrence,semester:Semester)=>o.offering.semesterId===semester.id&&
  !!o.offering.moduleId&&!isAssessment(o.offering.category)&&o.offering.category!=='Freies Lernen'

/** Only facts required for ONE suggestion. No email, account ID, grades,
 * full timetable, notes outside class titles, or contact information. */
export function adviceContext(data:AppData,semester:Semester|undefined,modules:StudyModule[],now=new Date()):AdviceContext {
  const day=isoLocal(now)
  const time=`${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`
  const empty:AdviceContext={today:day,localTime:time,timeZone:Intl.DateTimeFormat().resolvedOptions().timeZone||'Europe/Berlin',
    freeMinutes:0,nextLecture:null,previousWeak:null,pendingFeedback:null,exams:[],otherWeak:[]}
  if(!semester)return empty
  const moduleMap=new Map(modules.map(m=>[m.id,m]))
  let next:Occurrence|null=null
  let nextIn=Number.POSITIVE_INFINITY
  let currentlyInClass=false
  for(let date=day,i=0;i<15&&date<=semester.end;date=addDays(date,1),i++){
    for(const occ of occurrencesOn(data.offerings,date)){
      if(!isTeaching(occ,semester)||!moduleMap.has(occ.offering.moduleId))continue
      const until=differenceMinutes(occ.date,occ.from,now)
      const untilEnd=differenceMinutes(occ.date,occ.to,now)
      if(until<=0&&untilEnd>0)currentlyInClass=true
      if(until>0&&until<nextIn){nextIn=until;next=occ}
    }
    if(next&&date>day)break
  }
  const nextLesson=next?lessonForOccurrence(next,data):null
  const nextModule=next?moduleMap.get(next.offering.moduleId):undefined
  const nextLecture=next&&nextLesson&&nextModule?{
    moduleId:nextModule.id,moduleName:nextModule.name,topic:nextLesson.label,lessonKey:nextLesson.key,
    date:next.date,time:next.from,minutesUntil:nextIn
  }:null
  const checkins=new Map((data.learningCheckins||[]).map(c=>[c.key,c]))
  const lastReview=new Map<string,{rating:LearningRating;updatedAt:string}>()
  for(const session of data.learningSessions||[]){
    if(session.kind!=='review'||!session.lessonKey)continue
    const existing=lastReview.get(session.lessonKey)
    if(!existing||session.updatedAt>existing.updatedAt){
      lastReview.set(session.lessonKey,{rating:session.rating,updatedAt:session.updatedAt})
    }
  }
  const latestRating=(key:string):LearningRating|undefined=>{
    const checkin=checkins.get(key)
    const review=lastReview.get(key)
    return review&&(!checkin||review.updatedAt>checkin.updatedAt)?review.rating:checkin?.rating
  }
  const lessons=pastLessons(data,semester,now)
  const weak:ContextWeak[]=[]
  let pendingFeedback:ContextWeak|null=null
  for(const lesson of lessons){
    const m=moduleMap.get(lesson.moduleId)
    if(!m)continue
    const checkinRating=checkins.get(lesson.key)?.rating
    const currentRating=latestRating(lesson.key)
    const item:ContextWeak={
      moduleId:m.id,moduleName:m.name,topic:lesson.label,lessonKey:lesson.key,date:lesson.date,
      rating:currentRating||'unrated'
    }
    if(!checkinRating){if(!pendingFeedback)pendingFeedback=item}
    if(currentRating&&currentRating!=='understood')weak.push(item)
  }
  // "The previous lecture was difficult" must refer to the actual most
  // recent earlier lesson of that teaching group, NOT an unrelated older gap.
  const previousLesson=nextLecture&&nextLesson?lessons.find(l=>
    l.moduleId===nextLecture.moduleId && l.contentId===nextLesson.contentId &&
    l.key!==nextLecture.lessonKey
  ):undefined
  const previousRating=previousLesson?latestRating(previousLesson.key):undefined
  const previousWeak=previousLesson&&previousRating&&previousRating!=='understood'?
    weak.find(w=>w.lessonKey===previousLesson.key)||null:null
  const exams=data.assessments.filter(a=>a.type==='exam'&&!a.completed&&a.date>=day&&moduleMap.has(a.moduleId))
    .map(a=>({moduleId:a.moduleId,moduleName:moduleMap.get(a.moduleId)!.name,date:a.date,daysUntil:diffDays(a.date,day)}))
    .sort((a,b)=>a.daysUntil-b.daysUntil).slice(0,4)
  // Only describe a gap before another class TODAY. Tomorrow's lecture is not
  // a 180-minute gap after today's timetable has already ended.
  // Do not claim the user has no other private commitments.
  const freeMinutes=!currentlyInClass&&next?.date===day?
    Math.max(0,Math.min(nextIn,180)):0
  return {...empty,freeMinutes,nextLecture,previousWeak,pendingFeedback,exams,otherWeak:weak.slice(0,6)}
}

export function localAdvice(context:AdviceContext):StudyAdvice {
  const {previousWeak,nextLecture,exams,otherWeak,pendingFeedback,freeMinutes}=context
  const exam=exams[0]
  const criticalExam=exam&&exam.daysUntil<=3
  if(criticalExam){
    return {title:'Deine Klausur hat Vorrang',message:`Die Klausur in ${exam.moduleName} ist in ${exam.daysUntil} ${exam.daysUntil===1?'Tag':'Tagen'}. Nutze die nächste freie Lernphase für eine gezielte Übungsaufgabe.`,
      moduleId:exam.moduleId,minutes:30,kind:'exam',source:'local'}
  }
  if(nextLecture&&nextLecture.minutesUntil<=180&&previousWeak){
    const phrase=previousWeak.rating==='absent'?'noch einmal durchgehen':'noch nicht ganz verstanden'
    return {title:'Kurz vor der nächsten Vorlesung',message:`Vor ${nextLecture.moduleName} könntest du „${previousWeak.topic}“ 15 Minuten wiederholen. Das Thema hattest du ${phrase}.`,
      moduleId:nextLecture.moduleId,lessonKey:previousWeak.lessonKey,minutes:15,kind:'review',source:'local'}
  }
  if(exam&&exam.daysUntil<=7){
    return {title:'Zeit für Klausurtraining',message:`In ${exam.moduleName} steht in ${exam.daysUntil} Tagen eine Klausur an. Ein paar gezielte Aufgaben sind heute wichtiger als neue Themen.`,
      moduleId:exam.moduleId,minutes:30,kind:'exam',source:'local'}
  }
  if(freeMinutes>=30&&otherWeak.length){
    const weak=otherWeak[0]
    return {title:'Deine freie Zeit nutzen',message:`Laut Stundenplan sind bis zur nächsten Veranstaltung etwa ${freeMinutes} Minuten frei. Wie wäre es, „${weak.topic}“ noch einmal anzuschauen?`,
      moduleId:weak.moduleId,lessonKey:weak.lessonKey,minutes:Math.min(30,freeMinutes),kind:'review',source:'local'}
  }
  if(pendingFeedback){
    return {title:'Wie lief deine letzte Vorlesung?',message:`Du hast „${pendingFeedback.topic}“ in ${pendingFeedback.moduleName} noch nicht bewertet. Ein kurzer Check-in macht deine nächsten Empfehlungen genauer.`,
      moduleId:pendingFeedback.moduleId,lessonKey:pendingFeedback.lessonKey,minutes:2,kind:'checkin',source:'local'}
  }
  if(nextLecture&&nextLecture.minutesUntil<=24*60){
    return {title:'Gut vorbereitet reingehen',message:`Als Nächstes steht ${nextLecture.moduleName} an. Schau dir vorab kurz an, worum es bei „${nextLecture.topic}“ geht.`,
      moduleId:nextLecture.moduleId,lessonKey:nextLecture.lessonKey,minutes:10,kind:'prepare',source:'local'}
  }
  if(exam&&exam.daysUntil<=14){
    return {title:'Die Klausur im Blick',message:`In ${exam.moduleName} steht am ${formatDate(exam.date,{day:'numeric',month:'long'})} eine Klausur an. Plane eine Wiederholung für diese Woche ein.`,
      moduleId:exam.moduleId,minutes:30,kind:'exam',source:'local'}
  }
  if(otherWeak.length){
    const weak=otherWeak[0]
    return {title:'Ein Thema festigen',message:`„${weak.topic}“ in ${weak.moduleName} war noch nicht vollständig verstanden. Ein kurzer zweiter Durchgang könnte helfen.`,
      moduleId:weak.moduleId,lessonKey:weak.lessonKey,minutes:20,kind:'review',source:'local'}
  }
  return {title:'Du bist auf Kurs',message:'Trage nach deinen Veranstaltungen kurz ein, wie gut du sie verstanden hast. Dann werden die Empfehlungen persönlicher.',
    minutes:0,kind:'checkin',source:'local'}
}
/** AI may rephrase and prioritize facts, not invent modules, times or actions.
 * A malformed recommendation is ignored in favor of the local algorithm. */
export function parseAiAdvice(value:unknown,ctx:AdviceContext):StudyAdvice|null {
  if(!value||typeof value!=='object')return null
  const r=value as Record<string,unknown>
  if(typeof r.title!=='string'||!r.title.trim()||r.title.length>90||
     typeof r.message!=='string'||!r.message.trim()||r.message.length>460)return null
  const kind=r.kind
  if(kind!=='review'&&kind!=='exam'&&kind!=='prepare'&&kind!=='checkin')return null
  const availableModules=new Set([ctx.nextLecture?.moduleId,ctx.previousWeak?.moduleId,ctx.pendingFeedback?.moduleId,
    ...ctx.exams.map(e=>e.moduleId),...ctx.otherWeak.map(w=>w.moduleId)].filter(Boolean))
  const moduleId=typeof r.moduleId==='string'&&availableModules.has(r.moduleId)?r.moduleId:undefined
  const validLessons=new Set([ctx.nextLecture?.lessonKey,ctx.previousWeak?.lessonKey,ctx.pendingFeedback?.lessonKey,
    ...ctx.otherWeak.map(w=>w.lessonKey)].filter(Boolean))
  const lessonKey=typeof r.lessonKey==='string'&&validLessons.has(r.lessonKey)?r.lessonKey:undefined
  const minutes=typeof r.minutes==='number'&&Number.isFinite(r.minutes)?Math.max(0,Math.min(60,Math.round(r.minutes))):15
  return {title:r.title.trim(),message:r.message.trim(),kind,minutes,moduleId,lessonKey,source:'deepseek'}
}
