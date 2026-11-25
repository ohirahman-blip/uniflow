export const clockMinutes = (value: string) => Number(value.split(':')[0]) * 60 + Number(value.split(':')[1] || 0)
export const clockString = (value: number) => `${String(Math.floor(value / 60)).padStart(2,'0')}:${String(value % 60).padStart(2,'0')}`

export function parseClock(value: string, allowMidnight = false): string | null {
  const text = value.trim().replace('.', ':')
  const match = /^(\d{1,2})(?::(\d{1,2}))?$/.exec(text)
  const compact = /^(\d{1,2})(\d{2})$/.exec(text)
  const parts = match || compact
  if (!parts) return null
  const hour = Number(parts[1]), minute = Number(parts[2] || 0)
  if (minute > 59 || hour > 23 && !(allowMidnight && hour === 24 && minute === 0)) return null
  return `${String(hour).padStart(2,'0')}:${String(minute).padStart(2,'0')}`
}

/** Missing ends stay missing; known durations move with their start. */
export function shiftEndTime(from: string, to: string, nextFrom: string): string {
  if (!to) return ''
  return clockString(clockMinutes(nextFrom) + Math.max(1, clockMinutes(to) - clockMinutes(from)))
}

/** An open-ended event occupies a small visual slot, not an asserted duration. */
export function calendarEnd(from: string, to: string): string {
  return to || clockString(Math.min(1440, clockMinutes(from) + 30))
}

export function timeRangeLabel(value: {from:string;to?:string;endTimeUnknown?:boolean}) {
  return value.to && !value.endTimeUnknown ? `${value.from}–${value.to}` : `${value.from} · Ende offen`
}
