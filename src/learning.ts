import {
  addDays, fromDate, isAssessment, minutes, occurrencesOn, selectedAssessment, today, weekStart,
  type AppData, type Occurrence, type Semester, type StudyModule
} from './model'

export type LearningRating = 'understood' | 'partial' | 'struggling' | 'absent'
export type LearningCheckin = {
  key: string
  moduleId: string
  contentId: string
  date: string
  rating: LearningRating
  /** Attendance is separate from the understanding check. */
  attended?: boolean
  /** False when only attendance was saved without an understanding choice. */
  understandingSelected?: boolean
  updatedAt: string
}
export type LessonTopic = {
  /** Stable per teaching-content/week key; NOT a rename of the whole recurring series. */
  key: string
  moduleId: string
  contentId: string
  date: string
  title: string
  updatedAt: string
}
export type LearningSession = {
  id: string
  moduleId: string
  date: string
  duration: number
  kind: 'review' | 'exam'
  rating: Exclude<LearningRating, 'absent'>
  lessonKey?: string
  /** A learning activity may cover several lecture/exercise units. */
  lessonKeys?: string[]
  updatedAt: string
  planId?: string
  scheduledKey?: string
}
export type StudyTask = {
  id: string
  moduleId: string
  title: string
  dueDate?: string
  dueTime?: string
  note?: string
  points: number
  createdAt: string
  updatedAt: string
  completedAt?: string
}
export type ScoreEventType = 'module-created' | 'todo-completed' | 'attendance' | 'checkin' | 'study-minutes' | 'content-learned'
export type ScoreEvent = {
  id: string
  moduleId: string
  type: ScoreEventType
  basePoints: number
  multiplier: number
  points: number
  occurredAt: string
  sourceId: string
  groupId?: string
  reversedAt?: string
  label?: string
  metadata?: Record<string, string | number | boolean>
}
export type LearningPlanTask = {
  id: string
  moduleId: string
  date: string
  title: string
  duration: number
  kind: 'review' | 'exam'
  lessonKey?: string
}
export type LearningLesson = {
  key: string
  moduleId: string
  contentId: string
  label: string
  date: string
  from: string
  to: string
}
export type Journey = {
  moduleId: string
  lessons: LearningLesson[]
  rated: number
  total: number
  missing: number
  understanding: number | null
  repetition: number
  training: number
  preparation: number | null
  status: string
  message: string
  priority: number
  examDate?: string
  daysUntilExam?: number
  weakLessons: LearningLesson[]
}

const clamp = (n:number) => Math.max(0,Math.min(100,Math.round(n)))
const ratingValue = (v:LearningRating) =>
  v==='understood'?100:v==='partial'?55:v==='struggling'?10:0
/** Same lesson across alternative groups in a given teaching week.
 * This key matches all previous check-ins, so saved ratings do not migrate. */
export const lessonKeyForOccurrence = (occ:Occurrence) => {
  const o=occ.offering
  return o.moduleId+':'+(o.contentId||o.familyId||o.id)+':'+weekStart(occ.origin)
}
export function lessonForOccurrence(occ:Occurrence,data:AppData):LearningLesson {
  const o=occ.offering
  const key=lessonKeyForOccurrence(occ)
  const topic=(data.lessonTopics||[]).find(t=>t.key===key)?.title?.trim()
  return {
    key,moduleId:o.moduleId,contentId:o.contentId||o.familyId||o.id,
    label:topic||o.contentLabel||o.category,date:occ.date,from:occ.from,to:occ.to
  }
}
export function canRateOccurrence(occ:Occurrence,now=new Date()):boolean {
  const current=todayFrom(now)
  return occ.date<current || (occ.date===current && minutes(occ.to)<=now.getHours()*60+now.getMinutes())
}
const dayDistance = (a:string,b:string) =>
  Math.round((fromDate(a).getTime()-fromDate(b).getTime())/86400000)

/** One teaching content per calendar week; alternative groups never count twice.
 * Only selected, non-cancelled occurrences ending before now can prompt a check-in.
 * No mutation of offerings or the calendar's selection rules. */
export function pastLessons(data:AppData, semester:Semester|undefined, now=new Date()):LearningLesson[] {
  if (!semester) return []
  const stop = todayFrom(now)
  const limit = [semester.end,semester.lectureEnd,stop].sort()[0]
  const result = new Map<string,LearningLesson>()
  if (limit<semester.start) return []
  for(let date=semester.start,i=0;i<240&&date<=limit;date=addDays(date,1),i++){
    for(const occ of occurrencesOn(data.offerings,date)){
      const o=occ.offering
      if(o.semesterId!==semester.id||!o.moduleId||isAssessment(o.category)||o.category==='Freies Lernen')continue
      if(date===stop && minutes(occ.to)>now.getHours()*60+now.getMinutes())continue
      const lesson=lessonForOccurrence(occ,data)
      if(!result.has(lesson.key)) result.set(lesson.key,lesson)
    }
  }
  return [...result.values()].sort((a,b)=>b.date.localeCompare(a.date)||b.from.localeCompare(a.from))
}
/** Completed calendar entries for self-study. Same-content alternatives collapse to one feedback prompt. */
export function pastFreeStudy(data:AppData,semester:Semester|undefined,now=new Date()):LearningLesson[]{
  if(!semester)return []
  const stop=todayFrom(now)
  const limit=[stop,semester.end].sort()[0]
  if(limit<semester.start)return []
  const result=new Map<string,LearningLesson>()
  for(let date=semester.start,i=0;date<=limit&&i<240;date=addDays(date,1),i++){
    for(const occ of occurrencesOn(data.offerings,date)){
      const o=occ.offering
      if(o.semesterId!==semester.id||!o.moduleId||o.category!=='Freies Lernen')continue
      if(date===stop&&minutes(occ.to)>now.getHours()*60+now.getMinutes())continue
      const contentId=o.contentId||o.familyId||o.id
      const key='free:'+o.moduleId+':'+contentId+':'+weekStart(occ.origin)
      if(!result.has(key))result.set(key,{
        key,moduleId:o.moduleId,contentId,label:o.contentLabel||'Freies Lernen',date:occ.date,from:occ.from,to:occ.to
      })
    }
  }
  return [...result.values()].sort((a,b)=>b.date.localeCompare(a.date)||b.from.localeCompare(a.from))
}
const todayFrom=(date:Date)=>`${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`
export function futureExam(data:AppData,moduleId:string,ref=today()){
  return data.assessments.filter(a=>a.moduleId===moduleId&&a.type==='exam'&&!a.completed&&a.date>=ref&&selectedAssessment(a,data.assessments))
    .sort((a,b)=>a.date.localeCompare(b.date))[0]
}
export function journeyFor(data:AppData, module:StudyModule, allLessons:LearningLesson[], ref=today()):Journey {
  const lessons=allLessons.filter(x=>x.moduleId===module.id)
  const checkins=data.learningCheckins||[]
  const sessions=(data.learningSessions||[]).filter(s=>s.moduleId===module.id)
  const statuses=new Map(checkins.filter(c=>c.moduleId===module.id).map(c=>[c.key,c]))
  const rated=lessons.filter(x=>statuses.has(x.key))
  const known=rated.filter(x=>statuses.get(x.key)?.rating!=='absent')
  const weakLessons=lessons.filter(x=>{
    const c=statuses.get(x.key)
    if(!c||c.rating==='absent')return true
    const linked=sessions.filter(s=>s.lessonKey===x.key).sort((a,b)=>a.updatedAt.localeCompare(b.updatedAt))
    const latest=linked.length?linked[linked.length-1]:undefined
    const current=latest&&latest.updatedAt>c.updatedAt?latest.rating:c.rating
    return ratingValue(current)<75
  })
  // Learning after class can replace a poor first impression. The initial check-in
  // stays in the history; only the current, documented assessment changes.
  const baseUnderstanding=known.length?clamp(known.reduce((sum,l)=>{
    const initial=ratingValue(statuses.get(l.key)!.rating)
    const linked=sessions.filter(s=>s.lessonKey===l.key).sort((a,b)=>a.updatedAt.localeCompare(b.updatedAt))
    if(!linked.length)return sum+initial
    const latest=linked[linked.length-1]
    // An explicitly changed calendar rating wins over older study feedback.
    if(statuses.get(l.key)!.updatedAt>=latest.updatedAt)return sum+initial
    const newest=ratingValue(latest.rating)
    return sum+(linked.length>1?newest:0.2*initial+0.8*newest)
  },0)/known.length):null
  // General study can help a weak module, but without a linked topic we must
  // not pretend individual unknown/missed lectures are mastered.
  const generalReviews=sessions.filter(s=>s.kind==='review'&&!s.lessonKey)
  const usefulMinutes=generalReviews.reduce((sum,s)=>sum+s.duration*ratingValue(s.rating)/100,0)
  const separateDays=new Set(generalReviews.map(s=>s.date)).size
  const generalLift=Math.min(15,usefulMinutes/180*15)*(separateDays>=2?1:0.6)
  const understanding=baseUnderstanding===null?null:clamp(baseUnderstanding+generalLift)
  const reviewed=new Set(sessions.filter(x=>x.kind==='review'&&x.lessonKey).map(x=>x.lessonKey!))
  const reviewQuality=sessions.filter(x=>x.kind==='review')
  const confidence=reviewQuality.length?reviewQuality.reduce((sum,x)=>sum+ratingValue(x.rating),0)/reviewQuality.length:0
  const spacedLessons=new Set(reviewQuality.filter(x=>x.lessonKey && reviewQuality.some(y=>
    y.lessonKey===x.lessonKey && Math.abs(dayDistance(x.date,y.date))>=2
  )).map(x=>x.lessonKey))
  const repetition=clamp((lessons.length?reviewed.size/lessons.length*55:0)+
    (reviewQuality.length?confidence*0.25:0)+
    (lessons.length?spacedLessons.size/lessons.length*20:0))
  const examSessions=sessions.filter(x=>x.kind==='exam')
  const effectiveMinutes=examSessions.reduce((sum,x)=>sum+x.duration*ratingValue(x.rating)/100,0)
  const distinctDays=new Set(examSessions.map(x=>x.date)).size
  const training=clamp(Math.min(80,effectiveMinutes/240*80)+Math.min(20,distinctDays*5))
  // Training is capped at 20 points. Understanding and spaced review form the
  // first 80 points. This is an activity/feedback index, never an exam prediction.
  const preparation=understanding===null?null:clamp(.5*understanding+.3*repetition+.2*training)
  const exam=futureExam(data,module.id,ref)
  const daysUntilExam=exam?dayDistance(exam.date,ref):undefined
  const urgency=daysUntilExam===undefined?10:daysUntilExam<=3?100:daysUntilExam<=7?90:daysUntilExam<=14?75:daysUntilExam<=30?45:20
  const learningGap=understanding===null?65:100-understanding
  const insufficient=lessons.length?100-rated.length/lessons.length*100:70
  let priority=clamp(.45*urgency+.3*learningGap+.15*(100-repetition)+.1*insufficient)
  // An imminent exam overrides a distant module's worse average, unless
  // documented preparation is already genuinely extensive.
  if(daysUntilExam!==undefined && (preparation===null||preparation<90)){
    if(daysUntilExam<=3) priority=Math.max(priority,95)
    else if(daysUntilExam<=7) priority=Math.max(priority,90)
    else if(daysUntilExam<=14) priority=Math.max(priority,75)
  }
  let status='Lernreise beginnt'
  let message='Bewerte deine Vorlesungen, damit uniflow deinen Lernstand einschätzen kann.'
  if(rated.length){
    if(understanding!==null&&understanding>=85&&weakLessons.length===0&&repetition>=55){
      status='Sehr gut dabei'
      message='Sehr gut vorbereitet auf die weitere Prüfungsvorbereitung. Bleib bei deinen Wiederholungen.'
    }else if(understanding!==null&&understanding>=65&&weakLessons.length<=Math.max(2,Math.ceil(lessons.length*.3))){
      status='Auf Kurs'
      message='Ein paar Wiederholungen und du bist wieder auf dem neuesten Stand.'
    }else if(weakLessons.length<=Math.max(3,Math.ceil(lessons.length*.5))){
      status='Nachholen empfohlen'
      message='Ich würde mir dieses Modul noch etwas genauer anschauen.'
    }else{
      status='Aufholbedarf'
      message='Hier hat sich etwas angesammelt. Fang mit den wichtigsten offenen Einheiten an.'
    }
    if(rated.length<lessons.length*.5)message+=' Dein Lernstand ist noch nicht vollständig erfasst.'
    if(daysUntilExam!==undefined&&daysUntilExam<=7&&preparation!==null&&preparation<80){
      status='Prüfung hat Vorrang'
      message='Die Prüfung rückt näher. Wiederhole die wichtigsten Lücken und übe prüfungsähnliche Aufgaben.'
    }
  }
  return {moduleId:module.id,lessons,rated:rated.length,total:lessons.length,missing:lessons.length-rated.length,
    understanding,repetition,training,preparation,status,message,priority,
    examDate:exam?.date,daysUntilExam,weakLessons}
}
export function rankedJourneys(data:AppData,modules:StudyModule[],semester:Semester|undefined,ref=today()){
  const lessons=pastLessons(data,semester)
  return modules.filter(m=>m.status==='current'||m.status==='failed'||m.status==='open')
    .map(m=>journeyFor(data,m,lessons,ref)).sort((a,b)=>b.priority-a.priority)
}
