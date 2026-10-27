import type { LearningCheckin, LearningSession, LearningPlanTask, LessonTopic, ScoreEvent, StudyTask } from './learning'
import type { StudyTimerState } from './study-timer'
import type {StudySchedulePreferences} from './adaptive-study-plan'
export type Repeat = 'once' | 'weekly' | 'biweekly'
export type CalendarView = 'day' | 'two' | 'week'
export type ModuleStatus = 'open' | 'planned' | 'current' | 'passed' | 'failed' | 'recognized'
export type Degree = { id: string; name: string; level: 'Bachelor' | 'Master' | string; university: string; targetCredits: number }
export type Semester = { id: string; degreeId: string; name: string; start: string; end: string; lectureEnd: string; archived: boolean }
export type StudyModule = { completedOn?: string; emoji?: string; id: string; degreeId: string; name: string; shortName: string; credits: number; color: string; status: ModuleStatus; grade: string; counted: boolean; hidden: boolean; semesterIds: string[] }
export type CreditGoal = { id: string; degreeId: string; name: string; targetCredits: number; moduleIds: string[] }
export type Override = { date?: string; from?: string; to?: string; cancelled?: boolean; selected?: boolean; scope?: 'single' | 'future'; reason?: 'selection' | 'move' | 'removal' | 'pause'; changeId?: string; previous?: Override | null }
export type Offering = { scheduleChanges?: { fromOrigin: string; shiftDays: number; from: string; to: string }[]; familyId?: string; id: string; semesterId: string; moduleId: string; name: string; category: string; date: string; endDate: string; from: string; to: string; recurrence: Repeat; overrides: Record<string, Override>; room: string; onlineLink?: string; organizer?: string; contentId?: string; contentLabel?: string; selected: boolean }
export type Assessment = {
  id: string
  semesterId: string
  moduleId: string
  type: 'exam' | 'homework'
  title: string
  date: string
  from?: string
  to?: string
  completed?: boolean
  notes?: string
  /** Exam attempts with the same componentId are alternatives of one assessment. */
  componentId?: string
  /** Weight belongs to the whole component and is mirrored to its alternatives. */
  weight?: number
  /** Only one exam attempt per component is shown as the currently chosen date. */
  selected?: boolean
}
export type Alternative = { recurrence?: Repeat; endDate?: string; id: string; parentOfferingId: string; parentOrigin?: string; kind: 'slot' | 'group'; moduleId: string; category: string; name: string; date: string; from: string; to: string; room: string }
export type AppData = { studySchedule?: Partial<StudySchedulePreferences>; soundEffects?: boolean; dailyScoreGoal?: number; streakDays?: string[]; studyTimer?: StudyTimerState; alternatives?: Alternative[]; creditGoals?: CreditGoal[]; weekEndDay?: 4 | 5 | 6; theme?: 'dark' | 'light'; themePreferenceVersion?: 1; notificationPreferences?: { mail?: boolean; lessonFeedback: boolean }; version: 2; profile: string; degrees: Degree[]; activeDegreeId: string; semesters: Semester[]; activeSemesterId: string; modules: StudyModule[]; offerings: Offering[]; assessments: Assessment[]; learningCheckins?: LearningCheckin[]; lessonTopics?: LessonTopic[]; learningSessions?: LearningSession[]; learningPlans?: LearningPlanTask[]; studyTasks?: StudyTask[]; scoreEvents?: ScoreEvent[]; firstHour: number; lastHour: number; lastUpdate: number }
export type Occurrence = { key: string; offering: Offering; origin: string; date: string; from: string; to: string; isOverride: boolean; cancelled?: boolean }
export const STORE = 'uniflow-v2-local'
export const LEGACY_STORE = 'uniflow-v1-local'
export const moduleEmojis: string[] = []
export const colors = ['#EC9A83', '#929DDC', '#7EBBAA', '#E5C47C', '#B5A0C9', '#7EB9D5', '#E6A7BB', '#D990BF']
export const emptyData: AppData = { version: 2, profile: '', degrees: [], activeDegreeId: '', semesters: [], activeSemesterId: '', modules: [], offerings: [], assessments: [], learningCheckins: [], lessonTopics: [], learningSessions: [], learningPlans: [], studyTasks: [], scoreEvents: [], alternatives: [], creditGoals: [], weekEndDay: 4, theme: 'dark', themePreferenceVersion: 1, notificationPreferences: { lessonFeedback: false }, firstHour: 0, lastHour: 24, lastUpdate: 0 }
export const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4)
export const dateString = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
export const fromDate = (iso: string) => new Date(`${iso}T12:00:00`)
export function addDays(iso: string, n: number) { const d = fromDate(iso); d.setDate(d.getDate() + n); return dateString(d) }
/** Calendar-month arithmetic used for the short exam period after a semester. */
export function addMonths(iso: string, n: number) {
  const d = fromDate(iso)
  const day = d.getDate()
  d.setDate(1)
  d.setMonth(d.getMonth() + n)
  d.setDate(Math.min(day, new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate()))
  return dateString(d)
}
export const examVisibilityEnd = (semester: Pick<Semester, 'end'>) => addMonths(semester.end, 1)
export const today = () => dateString(new Date())
export const weekStart = (iso: string) => addDays(iso, -((fromDate(iso).getDay() + 6) % 7))
export const weekday = (iso: string) => (fromDate(iso).getDay() + 6) % 7
export const formatDate = (iso: string, opts?: Intl.DateTimeFormatOptions) => fromDate(iso).toLocaleDateString('de-DE', opts || { weekday: 'long', day: 'numeric', month: 'long' })
export const minutes = (time: string) => Number(time.split(':')[0]) * 60 + Number(time.split(':')[1] || 0)
export const timeString = (mins: number) => `${String(Math.floor(mins / 60)).padStart(2, '0')}:${String(mins % 60).padStart(2, '0')}`
export const semesterName = (date: string) => { const y = +date.slice(0, 4), m = +date.slice(5, 7); return m >= 4 && m <= 9 ? `Sommersemester ${y}` : `Wintersemester ${m >= 10 ? y : y - 1}/${String((m >= 10 ? y + 1 : y) % 100).padStart(2, '0')}` }
export function currentSemesterDates(ref = today()) { const y = +ref.slice(0, 4), m = +ref.slice(5, 7); const start = m >= 4 && m <= 9 ? `${y}-04-01` : m >= 10 ? `${y}-10-01` : `${y - 1}-10-01`; return semesterFromStart(start) }
export function semesterFromStart(start: string) { const y = +start.slice(0, 4), m = +start.slice(5, 7); const summer = m >= 4 && m <= 9; const yr = summer ? y : m >= 10 ? y : y - 1; return { name: summer ? `Sommersemester ${yr}` : `Wintersemester ${yr}/${String((yr + 1) % 100).padStart(2, '0')}`, start: summer ? `${yr}-04-01` : `${yr}-10-01`, end: summer ? `${yr}-09-30` : `${yr + 1}-03-31`, lectureEnd: summer ? `${yr}-07-20` : `${yr + 1}-02-15` } }
export const nextSemesterDates = (ref = today()) => { const cur = currentSemesterDates(ref); return semesterFromStart(addDays(cur.end, 1)) }
export const overlaps = (a: string, b: string, c: string, d: string) => a <= d && c <= b
export function acronym(input: string) { const segments = input.replace(/\b(und|and|of|der|die|das|für|the)\b/gi, ' ').split(/[\s\-\/]+/).filter(Boolean); let res = segments.map(w => /^[a-zA-ZäöüÄÖÜ]+\d+$/.test(w) ? w[0].toUpperCase() + w.match(/\d+$/)![0] : w[0].toUpperCase()).join(''); return (res || input.slice(0, 4).toUpperCase()).slice(0, 7) }
export function occursOn(o: Offering, d: string) { if (d < o.date || d > o.endDate) return false; if (o.recurrence === 'once') return d === o.date; if (weekday(d) !== weekday(o.date)) return false; const weeks = Math.round((fromDate(d).getTime() - fromDate(o.date).getTime()) / (7 * 86400000)); return o.recurrence === 'weekly' || weeks % 2 === 0 }
/** Each real teaching group has ONE permanent offering ID. Selecting another
 * group changes visibility only; it must never create cloned series. */
function scheduleAt(o: Offering, origin: string) {
  const changes = [...(o.scheduleChanges || [])].filter(x => x.fromOrigin <= origin)
    .sort((a,b) => a.fromOrigin.localeCompare(b.fromOrigin))
  return changes[changes.length - 1]
}
export function occurrenceAtOrigin(o: Offering, origin: string, includeUnselected = false, includeCancelled = false): Occurrence | null {
  if (!occursOn(o, origin)) return null
  const override = o.overrides?.[origin]
  if (override?.cancelled && !includeCancelled) return null
  const schedule = scheduleAt(o,origin)
  if (!includeUnselected && !override?.cancelled && !(override?.selected ?? o.selected)) return null
  return {
    key: `${o.id}:${origin}`, offering:o, origin,
    date:override?.date || addDays(origin,schedule?.shiftDays || 0),
    from:override?.from || schedule?.from || o.from,
    to:override?.to || schedule?.to || o.to,
    isOverride:!!override || !!schedule,
    cancelled:!!override?.cancelled
  }
}
export function occurrenceInWeek(o: Offering, week: string, includeUnselected = false): Occurrence | null {
  const origin = addDays(weekStart(week),weekday(o.date))
  return occurrenceAtOrigin(o,origin,includeUnselected)
}
export function candidateOccurrencesOn(offers: Offering[], date: string, includeUnselected = false, includeCancelled = false): Occurrence[] {
  const all: Occurrence[] = []
  for (const o of offers) {
    const origins = new Set<string>([date])
    for (const change of o.scheduleChanges || []) origins.add(addDays(date,-change.shiftDays))
    for (const [origin, override] of Object.entries(o.overrides || {})) if (override.date === date) origins.add(origin)
    for (const origin of origins) {
      const item = occurrenceAtOrigin(o,origin,includeUnselected,includeCancelled)
      if (item?.date === date) all.push(item)
    }
  }
  return all.sort((a,b)=>minutes(a.from)-minutes(b.from)||a.key.localeCompare(b.key))
}
export const occurrencesOn = (offers: Offering[], date: string) => candidateOccurrencesOn(offers,date,false)

const assessmentAttemptWords = /(?:[-–—,:]?\s*)(?:erst(?:er|e|es)?\s*termin|zweit(?:er|e|es)?\s*termin|[12]\.?\s*termin|[12]\.\s*versuch|versuch\s*[12])\s*$/i
export const assessmentBaseTitle = (title:string) => title.replace(assessmentAttemptWords,'').trim().toLocaleLowerCase('de-DE')
export const assessmentComponentKey = (item:Assessment) => item.type==='exam'
  ? item.componentId || `${item.moduleId}:${assessmentBaseTitle(item.title)}`
  : item.componentId || item.id
export const selectedAssessment = (item:Assessment,all:Assessment[]) => {
  if(item.type!=='exam')return true
  const group=all.filter(other=>assessmentComponentKey(other)===assessmentComponentKey(item))
    .sort((a,b)=>a.date.localeCompare(b.date)||a.id.localeCompare(b.id))
  return group.some(other=>other.selected===true)?item.selected===true:group[0]?.id===item.id
}

/** Keep component weights at 100%. Editing one value redistributes the remainder;
 * adding a new component starts with an even split. Exam alternatives count once. */
export function rebalanceAssessmentWeights(items:Assessment[],moduleId:string,changedKey?:string,requested?:number):Assessment[]{
  const moduleItems=items.filter(item=>item.moduleId===moduleId)
  const keys=[...new Set(moduleItems.map(assessmentComponentKey))]
  if(!keys.length)return items
  const current=new Map(keys.map(key=>[key,moduleItems.find(item=>assessmentComponentKey(item)===key)?.weight]))
  const target=new Map<string,number>()
  if(changedKey&&keys.includes(changedKey)&&Number.isFinite(requested)){
    const chosen=Math.max(0,Math.min(100,requested||0)),others=keys.filter(key=>key!==changedKey)
    target.set(changedKey,chosen)
    const remainder=100-chosen
    const oldTotal=others.reduce((sum,key)=>sum+(current.get(key)||0),0)
    others.forEach(key=>target.set(key,oldTotal>0?remainder*(current.get(key)||0)/oldTotal:remainder/Math.max(1,others.length)))
  }else{
    const equal=100/keys.length
    keys.forEach(key=>target.set(key,equal))
  }
  return items.map(item=>item.moduleId===moduleId?{...item,weight:Number((target.get(assessmentComponentKey(item))||0).toFixed(1))}:item)
}

export function upsertAssessment(items:Assessment[],next:Assessment):Assessment[]{
  const existing=items.find(item=>item.id===next.id)
  let componentId=existing?.componentId||next.componentId
  if(next.type==='exam'&&!componentId){
    const match=items.find(item=>item.id!==next.id&&item.type==='exam'&&item.moduleId===next.moduleId&&assessmentBaseTitle(item.title)===assessmentBaseTitle(next.title))
    componentId=match?.componentId||match?.id||next.id
  }
  if(next.type==='homework')componentId=next.id
  const inserted={...next,componentId}
  let result=existing?items.map(item=>item.id===next.id?inserted:item):[...items,inserted]
  if(next.type==='exam'){
    const key=assessmentComponentKey(inserted)
    result=result.map(item=>item.type==='exam'&&assessmentComponentKey(item)===key?{...item,componentId}:item)
    const group=result.filter(item=>item.type==='exam'&&assessmentComponentKey(item)===key).sort((a,b)=>a.date.localeCompare(b.date)||a.id.localeCompare(b.id))
    if(!group.some(item=>item.selected))result=result.map(item=>assessmentComponentKey(item)===key?{...item,selected:item.id===group[0]?.id}:item)
  }
  return result
}
/** A content group is unique *within* one module, semester and teaching topic. */
export const sameContent = (a: Offering,b:Offering) => a.semesterId === b.semesterId && a.moduleId === b.moduleId &&
  (a.contentId || a.familyId || a.id) === (b.contentId || b.familyId || b.id)
export const intersects = (a: {from:string;to:string},b:{from:string;to:string}) => minutes(a.from)<minutes(b.to) && minutes(a.to)>minutes(b.from)
/** Same-content groups are reciprocal, regardless of chosen lecturer or day.
 * Independent modules at the same time are separate slot alternatives. */
export function linkedCandidates(offers: Offering[], occ: Occurrence): {occ: Occurrence;kind:'group'|'slot'}[] {
  const matches:{occ:Occurrence;kind:'group'|'slot'}[]=[]
  const seen=new Set<string>()
  for(const o of offers){
    if(o.id===occ.offering.id || !sameContent(o,occ.offering))continue
    const alternate=occurrenceInWeek(o,occ.origin,true)
    if(alternate && alternate.key!==occ.key && !seen.has(alternate.key)){
      matches.push({occ:alternate,kind:'group'});seen.add(alternate.key)
    }
  }
  for(const other of candidateOccurrencesOn(offers,occ.date,true)){
    if(other.key===occ.key || seen.has(other.key) || !intersects(other,occ))continue
    matches.push({occ:other,kind:'slot'});seen.add(other.key)
  }
  return matches
}
/** Change which existing groups are displayed in the PERSONAL calendar.
 * 'both' preserves the old main and any unrelated overlapping module.
 * An 8-week back-and-forth still contains the same original offering IDs. */
export function chooseOffering(offers: Offering[], main: Occurrence, alternative: Occurrence,
  scope:'single'|'future', keepBoth = false): Offering[] {
  if(main.key===alternative.key)return offers
  const choiceId = scope === 'single' ? uid() : undefined
  const updates = new Map<string, Map<string, boolean>>();
  const mark=(occ:Occurrence,selected:boolean)=>{
    if(!updates.has(occ.offering.id))updates.set(occ.offering.id,new Map())
    updates.get(occ.offering.id)!.set(occ.origin,selected)
  }
  const applyWeek=(a:Occurrence,b:Occurrence)=>{
    mark(a,keepBoth)
    mark(b,true)
    if(!keepBoth){
      for(const conflict of occurrencesOn(offers,b.date)){
        if(conflict.key!==a.key && conflict.key!==b.key &&
          conflict.offering.semesterId===b.offering.semesterId && intersects(conflict,b))mark(conflict,false)
      }
    }
  }
  if(scope==='single')applyWeek(main,alternative)
  else {
    const source=offers.find(o=>o.id===main.offering.id)
    const target=offers.find(o=>o.id===alternative.offering.id)
    if(!source||!target)return offers
    // A semester is normally <= 26 weeks; cap safeguards malformed imports.
    for(let week=weekStart(main.origin),i=0;i<210 && week<=source.endDate;i++,week=addDays(week,7)){
      const a=occurrenceInWeek(source,week,true)
      const b=occurrenceInWeek(target,week,true)
      // An every-other-week group only replaces the weeks when it exists.
      if(a&&b)applyWeek(a,b)
    }
  }
  if(!updates.size)return offers
  return offers.map(o=>{
    const update=updates.get(o.id)
    if(!update)return o
    const overrides={...(o.overrides||{})}
    for(const [origin,selected] of update) {
      const old = overrides[origin]
      overrides[origin] = {...(old||{}),selected,scope,reason:'selection',changeId:choiceId,
        previous: scope === 'single' ? old ? {...old} : null : undefined}
    }
    return {...o,overrides}
  })
}
/** In a future delete, the clicked occurrence is deleted too. */
export function deleteOffering(offers: Offering[], occ: Occurrence, scope: 'single' | 'future'): Offering[] {
  return offers.flatMap(o => {
    if (o.id !== occ.offering.id) return [o]
    if (o.recurrence === 'once' || occ.origin === o.date && scope === 'future') return scope === 'future' || o.recurrence === 'once' ? [] : [o]
    if (scope === 'future') return [{ ...o, endDate: addDays(occ.origin, -1), overrides: Object.fromEntries(Object.entries(o.overrides || {}).filter(([date]) => date < occ.origin)) }]
    return [{ ...o, overrides: { ...o.overrides, [occ.origin]: { date:occ.date, from:occ.from, to:occ.to, cancelled: true, scope:'single', reason:'removal' } } }]
  })
}
export function isAssessment(category: string) { return /klausur|prüfung|exam|hausaufgabe|abgabe|deadline/i.test(category) }
/** Separate previously saved "Klausur" / "Hausaufgabe" offerings into dated,
 * independent assessments. IDs are deterministic so repeated loads cannot duplicate.
 * Any old weekly assessment is expanded into its scheduled individual dates. */
export function separateAssessments(data: AppData): AppData {
  const converted: Assessment[] = []
  const retained: Offering[] = []
  for (const offering of data.offerings || []) {
    if (!isAssessment(offering.category)) { retained.push(offering); continue }
    const step = offering.recurrence === 'biweekly' ? 14 : offering.recurrence === 'weekly' ? 7 : 0
    let origin = offering.date
    for (let i=0; i<550 && origin<=offering.endDate; i++) {
      const visit = occurrenceAtOrigin(offering,origin,true)
      if (visit) {
        converted.push({
          id: `legacy-${offering.id}-${origin}`,
          semesterId: offering.semesterId,
          moduleId: offering.moduleId,
          type: /klausur|prüfung|exam/i.test(offering.category) ? 'exam' : 'homework',
          title: offering.contentLabel || (offering.name !== offering.category ? offering.name : offering.category),
          date: visit.date,
          from: /klausur|prüfung|exam/i.test(offering.category) ? visit.from : undefined,
          to: /klausur|prüfung|exam/i.test(offering.category) ? visit.to : undefined,
          completed: false
        })
      }
      if (!step) break
      origin=addDays(origin,step)
    }
  }
  const items = new Map<string,Assessment>()
  for (const item of converted) items.set(item.id,item)
  for (const item of Array.isArray(data.assessments) ? data.assessments : []) items.set(item.id,item)
  const oldIds = new Set(data.offerings.filter(o=>isAssessment(o.category)).map(o=>o.id))
  return {
    ...data, offerings: retained, assessments: [...items.values()],
    alternatives: (data.alternatives||[]).filter(a=>!oldIds.has(a.parentOfferingId))
  }
}

export function moveOccurrence(offers: Offering[], offeringId: string, origin: string, targetDate: string,
  from: string, to: string, scope: 'single' | 'future'): Offering[] {
  return offers.map(o=>{
    if(o.id!==offeringId)return o
    if(scope==='single'||o.recurrence==='once')return {
      ...o,overrides:{...(o.overrides||{}),[origin]:{...(o.overrides?.[origin]||{}),date:targetDate,from,to,scope:'single',reason:'move'}}
    }
    const shiftDays=Math.round((fromDate(targetDate).getTime()-fromDate(origin).getTime())/86400000)
    const previous=(o.scheduleChanges||[]).filter(x=>x.fromOrigin!==origin)
    // Preserve ONE identity. Future changes supersede past schedule rules.
    return {...o,scheduleChanges:[...previous,{fromOrigin:origin,shiftDays,from,to}]
      .sort((a,b)=>a.fromOrigin.localeCompare(b.fromOrigin))}
  })
}
export function migrateLegacy(raw: any): AppData | null {  
if (!raw || !Array.isArray(raw.degrees) || !Array.isArray(raw.semesters) || !Array.isArray(raw.modules) || !Array.isArray(raw.offerings)) return null
  return separateAssessments({ ...emptyData, profile: raw.profile || '', degrees: raw.degrees.map((d: any) => ({ ...d, university: d.university || '' })), activeDegreeId: raw.activeDegreeId || '', semesters: raw.semesters.map((s: any) => ({ ...s, lectureEnd: s.lectureEnd || s.end })), activeSemesterId: raw.activeSemesterId || '', modules: raw.modules.map((m: any) => ({ ...m, shortName: m.shortName || acronym(m.name || ''), color: m.color || colors[0], emoji: m.emoji || '', semesterIds: m.semesterIds || [] })), alternatives: Array.isArray(raw.alternatives) ? raw.alternatives : [], weekEndDay: raw.weekEndDay ?? 4, theme: 'dark', themePreferenceVersion: 1, offerings: raw.offerings.map((o: any) => ({ ...o, category: o.category || ({ lecture: 'Vorlesung', exercise: 'Übung', tutorial: 'Tutorium', study: 'Freies Lernen', exam: 'Prüfung' } as Record<string, string>)[o.kind] || 'Sonstiges', recurrence: o.recurrence === 'biweekly' ? 'biweekly' : o.recurrence === 'weekly' ? 'weekly' : 'once', overrides: o.overrides || {}, selected: o.selected !== false })), lastUpdate: Date.now() })
}
export function loadData(): AppData { try { const curr = localStorage.getItem(STORE); if (curr) { const parsed = JSON.parse(curr); if (parsed && Array.isArray(parsed.degrees)) { const theme=parsed.theme==='light'?'light':'dark'; return separateAssessments({ ...emptyData, ...parsed, theme, themePreferenceVersion:1, alternatives: Array.isArray(parsed.alternatives) ? parsed.alternatives : [], assessments: Array.isArray(parsed.assessments) ? parsed.assessments : [], version: 2 }) } } const old = localStorage.getItem(LEGACY_STORE); if (old) { const migrated = migrateLegacy(JSON.parse(old)); if (migrated) return migrated } } catch { } return { ...emptyData } }

// Alternatives remain independent of the personal timetable until explicitly selected.
// The offering pool and its alternatives are separate from the personal timetable.
// An alternative can itself occur once, weekly, or every second week.
export function alternativeDate(a: Alternative, occ: Occurrence): string {
  if (a.kind === 'slot') return occ.date
  const deltaDays = Math.round((fromDate(occ.origin).getTime() - fromDate(a.parentOrigin || occ.offering.date).getTime()) / 86400000)
  const weeks = Math.floor(deltaDays / 7)
  return addDays(a.date, weeks * 7)
}
export function alternativeApplies(a: Alternative, occ: Occurrence): boolean {
  const sameFamily = a.parentOfferingId === occ.offering.id || a.parentOfferingId === occ.offering.familyId
  if (!sameFamily) return false
  const origin = a.parentOrigin || occ.offering.date
  const elapsedWeeks = Math.floor((fromDate(occ.origin).getTime() - fromDate(origin).getTime()) / (7 * 86400000))
  if (elapsedWeeks < 0) return false
  const repeat = a.recurrence || (a.kind === 'group' ? 'weekly' : 'once')
  if (repeat === 'once' && occ.origin !== origin) return false
  if (repeat === 'biweekly' && elapsedWeeks % 2 !== 0) return false
  const dest = alternativeDate(a, occ)
  if (a.endDate && dest > a.endDate) return false
  return true
}
export function alternativesFor(alternatives: Alternative[], occ: Occurrence): Alternative[] {
  return alternatives.filter(a => alternativeApplies(a, occ))
}

export function activateAlternative(offers: Offering[], alt: Alternative, occ: Occurrence): Offering[] {
  const destination = alternativeDate(alt, occ)
  const removed = offers.map(o => o.id === occ.offering.id
    ? { ...o, overrides: { ...o.overrides, [occ.origin]: { date: occ.origin, from: occ.from, to: occ.to, cancelled: true } } }
    : o)
  const replacement: Offering = {
    id: uid(), semesterId: occ.offering.semesterId, moduleId: alt.moduleId,
    name: alt.name, category: alt.category, date: destination, endDate: destination,
    from: alt.from, to: alt.to, recurrence: 'once', overrides: {}, room: alt.room,
    selected: true
  }
  return [...removed, replacement]
}

// Replace a deleted appointment with a linked alternative, without changing earlier dates.
export function replaceWithAlternative(offers: Offering[], alt: Alternative, occ: Occurrence, scope: 'single' | 'future'): Offering[] {
  if (scope === 'single' || occ.offering.recurrence === 'once' || (alt.recurrence || 'once') === 'once')
    return activateAlternative(offers, alt, occ)
  const shifted = Math.round((fromDate(alternativeDate(alt,occ)).getTime() - fromDate(occ.origin).getTime()) / 86400000)
  const futureEnd = addDays(occ.offering.endDate, shifted)
  const ending = alt.endDate && alt.endDate < futureEnd ? alt.endDate : futureEnd
  const replacement: Offering = {
    id: uid(), familyId: occ.offering.familyId || occ.offering.id,
    semesterId: occ.offering.semesterId, moduleId: alt.moduleId,
    name: alt.name, category: alt.category, date: alternativeDate(alt,occ),
    endDate: ending, from: alt.from, to: alt.to,
    recurrence: alt.recurrence || 'weekly', overrides: {}, room: alt.room, selected:true
  }
  const before = offers.map(o => o.id === occ.offering.id
    ? { ...o, endDate: addDays(occ.origin,-1), overrides: Object.fromEntries(Object.entries(o.overrides || {}).filter(([date]) => date < occ.origin)) }
    : o)
  return [...before,replacement]
}

/** Select an available series when there is no competing main event.
 * Never creates a new offering: selecting or hiding only changes its existing ID.
 * Future operations apply to the chosen occurrence and later scheduled occurrences,
 * preserving past decisions. */
export function setOfferingAttendance(offers: Offering[], chosen: Occurrence,
    scope: 'single' | 'future', selected = true): Offering[] {
  const existing = offers.find(o => o.id === chosen.offering.id)
  // Resuming a once-paused visit revokes that exception rather than adding another.
  if (scope === 'single' && selected && existing?.overrides?.[chosen.origin]?.scope === 'single'
    && existing.overrides[chosen.origin].reason === 'pause') {
    return undoSingleChoice(offers,{...chosen,offering:existing})
  }
  const changeId = scope === 'single' ? uid() : undefined
  return offers.map(o => {
    if (o.id !== chosen.offering.id) return o
    const overrides = { ...o.overrides }
    if (scope === 'single') {
      overrides[chosen.origin] = { ...overrides[chosen.origin], selected, scope, reason: selected ? 'selection' : 'pause', changeId, previous: overrides[chosen.origin] ? {...overrides[chosen.origin]} : null }
    } else {
      for (let origin = chosen.origin, i = 0; i < 220 && origin <= o.endDate;
        origin = addDays(origin, o.recurrence === 'biweekly' ? 14 : 7), i++) {
        if (!occursOn(o,origin)) continue
        overrides[origin] = { ...overrides[origin], selected, scope, reason: selected ? 'selection' : 'pause' }
        if (o.recurrence === 'once') break
      }
    }
    return { ...o, overrides }
  })
}


/** Suspend attendance, not the underlying teaching offering. Suspended instances
 * remain visible as inactive, neutral-grey cards and can be restored. */
export function suspendOffering(offers: Offering[], occ: Occurrence, scope: 'single' | 'future'): Offering[] {
  return setOfferingAttendance(offers, occ, scope, false)
}

/** Undo exactly ONE previous one-time decision. Linked group/slot decisions
 * share a changeId, so reverting restores every involved original selection.
 * Never deletes or creates a scheduled series. */
export function undoSingleChoice(offers: Offering[], occ: Occurrence): Offering[] {
  const record = occ.offering.overrides?.[occ.origin]
  if (!record || record.scope !== 'single') return offers
  const choiceId = record.changeId
  return offers.map(o => {
    let dirty = false
    const overrides = {...(o.overrides || {})}
    for (const [origin,value] of Object.entries(overrides)) {
      if (choiceId ? value.changeId === choiceId : o.id === occ.offering.id && origin === occ.origin) {
        if (value.previous) overrides[origin] = value.previous
        else delete overrides[origin]
        dirty = true
      }
    }
    return dirty ? {...o,overrides} : o
  })
}

/** Deletion of a teaching group is a different, irreversible operation from
 * skipping one visit. Only the specified group ID is removed. */
export function removeOfferingGroup(offers: Offering[], id: string): Offering[] {
  return offers.filter(o => o.id !== id)
}

/** Returns all distinct offerings in a module grouped by their stable content
 * identity. Alternative groups are never cloned, even after 100 switches. */
export function contentGroups(offers: Offering[], moduleId: string, semesterId: string) {
  const groups = new Map<string, Offering[]>()
  for (const offering of offers) {
    if (offering.moduleId !== moduleId || offering.semesterId !== semesterId) continue
    if (isAssessment(offering.category)) continue
    const id = offering.contentId || offering.familyId || offering.id
    groups.set(id, [...(groups.get(id) || []), offering])
  }
  return [...groups.entries()].map(([id, offerings]) => ({id, offerings}))
}

/** Link an existing offering to a topic. Only the content relation changes;
 * IDs and all scheduled occurrences stay intact. */
export function linkOfferingToContent(offers: Offering[], offeringId: string,
    topic: Offering): Offering[] {
  const candidate = offers.find(o => o.id === offeringId)
  if (!candidate || candidate.moduleId !== topic.moduleId ||
      candidate.semesterId !== topic.semesterId || candidate.category !== topic.category || candidate.id === topic.id) return offers
  return offers.map(o => o.id === offeringId
    ? { ...o, contentId: topic.contentId || topic.familyId || topic.id,
        contentLabel: topic.contentLabel || topic.category }
    : o)
}

/** Prioritize the selected equivalent group, even when it meets on another day.
 * Otherwise an overlapping different module is the replaceable current event.
 * If neither exists, the user is simply adding a visit. */
export function findMainForInactive(offers: Offering[], alternative: Occurrence): Occurrence | null {
  const equivalent = offers.filter(o => o.id !== alternative.offering.id && sameContent(o,alternative.offering))
    .map(o => occurrenceInWeek(o,weekStart(alternative.origin),false))
    .find((occ): occ is Occurrence => !!occ)
  if(equivalent) return equivalent
  return occurrencesOn(offers,alternative.date).find(occ =>
    occ.offering.semesterId === alternative.offering.semesterId &&
    occ.key !== alternative.key && intersects(occ,alternative)) || null
}
