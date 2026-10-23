import { addDays, candidateOccurrencesOn, isAssessment, type AppData, type Occurrence, type Semester } from './model'
import { lessonKeyForOccurrence, type ScoreEvent } from './learning'

export const SCORE_RULES = {
  moduleCreated: 100,
  todoCompleted: 20,
  lectureAttendance: 100,
  exerciseAttendance: 50,
  lectureLearned: 100,
  exerciseLearned: 50,
  minute: 2,
  checkin: 5
} as const

export const isLectureCategory = (category: string) => category.trim().toLocaleLowerCase('de-DE').includes('vorles')
export const attendancePoints = (category: string) => isLectureCategory(category) ? SCORE_RULES.lectureAttendance : SCORE_RULES.exerciseAttendance
export const learnedPoints = (category: string) => isLectureCategory(category) ? SCORE_RULES.lectureLearned : SCORE_RULES.exerciseLearned

export function makeScoreEvent(input: Omit<ScoreEvent, 'basePoints' | 'multiplier' | 'points'> & { basePoints: number; multiplier?: number }): ScoreEvent {
  const multiplier = input.multiplier ?? 1
  return { ...input, multiplier, points: Math.round(input.basePoints * multiplier) }
}

export const scoreTotal = (events: ScoreEvent[] | undefined, moduleId: string) =>
  SCORE_RULES.moduleCreated + (events || []).filter(event => event.moduleId === moduleId && event.type !== 'module-created' && !event.reversedAt).reduce((total, event) => total + event.points, 0)

export function upsertScoreEvent(events: ScoreEvent[] | undefined, next: ScoreEvent): ScoreEvent[] {
  const current = events || []
  return current.some(event => event.id === next.id)
    ? current.map(event => event.id === next.id ? next : event)
    : [...current, next]
}

export type NumberedLesson = {
  key: string
  moduleId: string
  contentId: string
  occurrence: Occurrence
  category: string
  number: number
  label: string
}

/** Complete semester list, independent of attendance or understanding. */
export function numberedLessons(data: AppData, semester: Semester | undefined, moduleId?: string): NumberedLesson[] {
  if (!semester) return []
  const raw: Occurrence[] = []
  const limit = semester.lectureEnd < semester.end ? semester.lectureEnd : semester.end
  for (let date = semester.start, i = 0; date <= limit && i < 370; date = addDays(date, 1), i++) {
    for (const occurrence of candidateOccurrencesOn(data.offerings, date, false, false)) {
      const offering = occurrence.offering
      if (offering.semesterId !== semester.id || !offering.moduleId || isAssessment(offering.category) || offering.category === 'Freies Lernen') continue
      if (moduleId && offering.moduleId !== moduleId) continue
      raw.push(occurrence)
    }
  }
  const counts = new Map<string, number>()
  return raw.sort((a, b) => a.date.localeCompare(b.date) || a.from.localeCompare(b.from) || a.key.localeCompare(b.key)).map(occurrence => {
    const category = occurrence.offering.category || 'Veranstaltung'
    const countKey = `${occurrence.offering.moduleId}:${category.toLocaleLowerCase('de-DE')}`
    const number = (counts.get(countKey) || 0) + 1
    counts.set(countKey, number)
    return {
      key: lessonKeyForOccurrence(occurrence), moduleId: occurrence.offering.moduleId,
      contentId: occurrence.offering.contentId || occurrence.offering.familyId || occurrence.offering.id,
      occurrence, category, number, label: `${category} ${number}`
    }
  })
}

/** Additive and idempotent; legacy fields remain untouched. */
export function normalizeBigUpdate(data: AppData): AppData {
  let scoreEvents = [...(data.scoreEvents || []).filter(event=>event.type!=='module-created')]
  for(const module of data.modules){
    const existing=(data.scoreEvents||[]).find(event=>event.type==='module-created'&&event.moduleId===module.id)
    const semester=data.semesters.find(item=>module.semesterIds.includes(item.id))
    scoreEvents.push(makeScoreEvent({id:`module-created:${module.id}`,moduleId:module.id,type:'module-created',basePoints:SCORE_RULES.moduleCreated,occurredAt:existing?.occurredAt||`${semester?.start||'2026-01-01'}T00:00:00.000Z`,sourceId:module.id,label:'Startbonus'}))
  }
  const has = (id: string) => scoreEvents.some(event => event.id === id)
  for (const session of data.learningSessions || []) {
    const id = `study-minutes:${session.id}`
    if (!has(id)) scoreEvents.push(makeScoreEvent({
      id, moduleId: session.moduleId, type: 'study-minutes',
      basePoints: Math.max(0, session.duration) * SCORE_RULES.minute,
      occurredAt: session.updatedAt || `${session.date}T12:00:00.000Z`, sourceId: session.id,
      label: `${session.duration} Min. gelernt`
    }))
  }
  for (const checkin of data.learningCheckins || []) {
    const id = `checkin:${checkin.key}`
    if (!has(id)) scoreEvents.push(makeScoreEvent({
      id, moduleId: checkin.moduleId, type: 'checkin', basePoints: SCORE_RULES.checkin,
      occurredAt: checkin.updatedAt, sourceId: checkin.key, label: 'Verständnis eingetragen'
    }))
    const attended = checkin.attended ?? checkin.rating !== 'absent'
    const attendanceId = `attendance:${checkin.key}`
    const offering = data.offerings.find(item => item.moduleId === checkin.moduleId && (item.contentId || item.familyId || item.id) === checkin.contentId)
    if (attended && !has(attendanceId)) scoreEvents.push(makeScoreEvent({
      id: attendanceId, moduleId: checkin.moduleId, type: 'attendance',
      basePoints: attendancePoints(offering?.category || 'Vorlesung'), occurredAt: checkin.updatedAt,
      sourceId: checkin.key, label: `${offering?.category || 'Vorlesung'} besucht`
    }))
  }
  return { ...data, studyTasks: Array.isArray(data.studyTasks) ? data.studyTasks : [], scoreEvents }
}
