import { addDays, fromDate, isAssessment, minutes, occurrencesOn, today, weekStart, type AppData, type Occurrence, type Semester, type StudyModule } from './model'

export type LearningRating = 'good' | 'partial' | 'unclear'
export type LearningKind = 'review' | 'exam'
export type LearningCheckin = {
  key: string
  moduleId: string
  semesterId: string
  date: string
  rating: LearningRating
  updatedAt: number
}
export type LearningSession = {
  id: string
  moduleId: string
  semesterId: string
  date: string
  duration: number
  kind: LearningKind
  targetKey?: string
  outcome: LearningRating
  createdAt: number
}
export type LearningData = { checkins: LearningCheckin[]; sessions: LearningSession[] }
export type LearningUnit = {
  key: string
  moduleId: string
  date: string
  from: string
  to: string
  label: string
  occurrence: Occurrence
}
export type LearningJourney = {
  module: StudyModule
  units: LearningUnit[]
  rated: number
  understanding: number | null
  repetition: number
  examTraining: number
  preparation: number | null
  evidence: number
  openUnits: { unit: LearningUnit; score: number }[]
  examDate?: string
  daysToExam?: number
  priority: number
  status: string
  advice: string
}
const clamp = (n: number) => Math.max(0, Math.min(100, Math.round(n)))
export const ratingValue = (rating: LearningRating) =>
  rating === 'good' ? 100 : rating === 'partial' ? 55 : 15

/** Key identifies ONE teaching content in ONE week. Alternative time slots share a key. */
export function learningUnitKey(occ: Occurrence): string {
  const o = occ.offering
  return [o.semesterId, o.moduleId, o.contentId || o.familyId || o.id, weekStart(occ.origin)].join(':')
}

/** Read-only occurrence enumeration; does not change any calendar or offering. */
export function pastLearningUnits(data: AppData, semester: Semester, asOf = today()): LearningUnit[] {
  const end = asOf < semester.end ? asOf : semester.end
  const result = new Map<string, LearningUnit>()
  const now = new Date()
  for (let day = semester.start, i = 0; day <= end && i < 240; day = addDays(day, 1), i++) {
    for (const occ of occurrencesOn(data.offerings, day)) {
      const o = occ.offering
      if (o.semesterId !== semester.id || isAssessment(o.category) || o.category === 'Freies Lernen') continue
      if (day === today()) {
        const ended = new Date(now.getFullYear(), now.getMonth(), now.getDate(), Math.floor(minutes(occ.to) / 60), minutes(occ.to) % 60)
        if (now < ended) continue
      }
      const key = learningUnitKey(occ)
      if (!result.has(key)) result.set(key, {
        key, moduleId: o.moduleId, date: day, from: occ.from, to: occ.to,
        label: o.contentLabel || o.category, occurrence: occ
      })
    }
  }
  return [...result.values()].sort((a, b) => (b.date + b.to).localeCompare(a.date + a.to))
}
const ageInDays = (future: string, base: string) =>
  Math.round((fromDate(future).getTime() - fromDate(base).getTime()) / 86400000)
const urgency = (days: number | undefined) => {
  if (days === undefined) return 0
  if (days <= 3) return 100
  if (days <= 7) return 92
  if (days <= 14) return 76
  if (days <= 30) return 51
  return 22
}

export function deriveLearningJourneys(data: AppData, semester: Semester, modules: StudyModule[], asOf = today()): LearningJourney[] {
  const learning = data.learning || { checkins: [], sessions: [] }
  const past = pastLearningUnits(data, semester, asOf)
  const checkins = new Map(learning.checkins.map(c => [c.key, c]))
  const allSessions = learning.sessions.filter(s => s.semesterId === semester.id && s.date <= asOf)
  return modules.map(module => {
    const units = past.filter(unit => unit.moduleId === module.id)
    const sessions = allSessions.filter(s => s.moduleId === module.id)
    const scored = units.flatMap(unit => {
      const initial = checkins.get(unit.key)
      if (!initial) return []
      const related = sessions.filter(s => s.targetKey === unit.key && s.kind === 'review')
        .sort((a,b) => (a.date + a.createdAt).localeCompare(b.date + b.createdAt))
      let score = ratingValue(initial.rating)
      for (const session of related) score = clamp(0.35 * score + 0.65 * ratingValue(session.outcome))
      return [{ unit, score, reviews: related }]
    })
    const rated = scored.length
    const understanding = rated ? clamp(scored.reduce((n, x) => n + x.score, 0) / rated) : null
    const targeted = rated ? scored.reduce((n, x) => {
      const successfulDays = new Set(x.reviews.filter(s => s.outcome === 'good').map(s => s.date)).size
      const partialDays = new Set(x.reviews.filter(s => s.outcome === 'partial').map(s => s.date)).size
      return n + Math.min(100, successfulDays * 50 + partialDays * 25)
    }, 0) / rated : 0
    const generalReviews = sessions.filter(s => s.kind === 'review' && !s.targetKey)
    const general = Math.min(100, generalReviews.reduce((n, s) => n + Math.min(75, s.duration) / 75 * (ratingValue(s.outcome) / 100) * 22, 0))
    const repetition = clamp(targeted * 0.75 + general * 0.25)
    const trainingUnits = sessions.filter(s => s.kind === 'exam')
      .reduce((n, s) => n + Math.min(90, s.duration) / 60 * ratingValue(s.outcome) / 100, 0)
    const examTraining = clamp(trainingUnits / 4 * 100)
    const preparation = understanding === null ? null : clamp(understanding * 0.5 + repetition * 0.3 + examTraining * 0.2)
    const evidence = units.length ? clamp(rated / units.length * 100) : 0
    const openUnits = scored.filter(x => x.score < 75).sort((a,b) => a.score-b.score)
      .map(({unit,score}) => ({unit,score}))
    const examDate = data.assessments.filter(a => a.moduleId === module.id && a.type === 'exam' && a.date >= asOf)
      .map(a => a.date).sort()[0]
    const daysToExam = examDate ? ageInDays(examDate, asOf) : undefined
    const gap = understanding === null ? 45 : 100-understanding
    const repeatGap = 100-repetition
    const deadline = urgency(daysToExam)
    // A near exam outranks distant gaps, but no module disappears completely.
    const priority = clamp(daysToExam === undefined
      ? gap * 0.55 + repeatGap * 0.3 + (100-evidence) * 0.15
      : Math.max(daysToExam <= 7 ? 77 : 0, deadline * 0.58 + gap * 0.24 + repeatGap * 0.12 + (100-examTraining) * 0.06))
    let status = 'Gut dabei'
    let advice = 'Weiter regelmäßig wiederholen und dein Wissen anwenden.'
    if (rated === 0) {
      status = 'Deine Reise beginnt'
      advice = 'Bewerte deine erste Vorlesung, damit uniflow deinen Lernstand einschätzen kann.'
    } else if (evidence < 50) {
      status = 'Noch wenig eingeschätzt'
      advice = 'Einige Vorlesungen sind noch unbewertet. Hol die Check-ins nach.'
    } else if (understanding !== null && understanding < 45) {
      status = 'Etwas aufholen'
      advice = 'Ich würde mir dieses Modul noch genauer anschauen und offene Themen wiederholen.'
    } else if (openUnits.length || repetition < 45) {
      status = 'Ein paar Wiederholungen'
      advice = 'Ein paar Wiederholungen und du bist auf dem neuesten Stand.'
    } else if (understanding !== null && understanding >= 85 && repetition >= 65) {
      status = 'Sehr gut dabei'
      advice = 'Sehr gut vorbereitet für die Klausurvorbereitung. Weiter so!'
    }
    if (daysToExam !== undefined && daysToExam <= 7 && (preparation ?? 0) < 85) {
      advice = `Klausur in ${daysToExam} ${daysToExam === 1 ? 'Tag' : 'Tagen'}: Jetzt zuerst klausurrelevante Inhalte und Aufgaben üben.`
    }
    return { module, units, rated, understanding, repetition, examTraining,
      preparation, evidence, openUnits, examDate, daysToExam, priority, status, advice }
  }).sort((a,b) => b.priority-a.priority)
}
