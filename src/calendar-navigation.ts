import { addDays, fromDate, weekStart, type CalendarView } from './model'

/** Weekday indexes start on Monday (0). User settings may end on Fri/Sat/Sun. */
export const lastVisibleWeekday = (weekEndDay: number | undefined): number =>
  Math.max(4, Math.min(6, weekEndDay ?? 4))

export const weekdayIndex = (date: string): number =>
  (fromDate(date).getDay() + 6) % 7

export function weekHeaderDates(date: string, weekEndDay: number | undefined): string[] {
  const monday = weekStart(date)
  return Array.from({ length: lastVisibleWeekday(weekEndDay) + 1 }, (_, i) => addDays(monday, i))
}

/** Skip days beyond the chosen week-end without discarding their actual events. */
export function shiftVisibleDay(date: string, amount: number, weekEndDay: number | undefined): string {
  const direction = amount < 0 ? -1 : 1
  let current = date
  let remaining = Math.abs(amount)
  const end = lastVisibleWeekday(weekEndDay)
  while (remaining > 0) {
    current = addDays(current, direction)
    if (weekdayIndex(current) <= end) remaining--
  }
  return current
}

/** Two-day pages glide ONE day at a time: Mo/Di → Di/Mi → Mi/Do.
 * The final pair stays inside the configured Fri/Sat/Sun cutoff. */
export const twoDayStarts = (weekEndDay: number | undefined): number[] =>
  Array.from({length:lastVisibleWeekday(weekEndDay)},(_,i)=>i)

/** Keep both two-day columns inside the same configured workweek.
 * Selecting its final day shows it together with the preceding visible day. */
export function alignCalendarStart(date: string, mode: CalendarView, weekEndDay: number | undefined): string {
  if (mode === 'week') return weekStart(date)
  const end = lastVisibleWeekday(weekEndDay)
  const safeDate = weekdayIndex(date) <= end ? date : shiftVisibleDay(date, 1, end)
  if (mode === 'day') return safeDate
  const dayIndex = weekdayIndex(safeDate)
  const windows = twoDayStarts(end)
  // A canonical start must remain itself even if its first day also belongs
  // to the preceding overlapping window. Otherwise swipe-back isn't reversible.
  const firstMatchingWindow = windows.includes(dayIndex)
    ? dayIndex
    : windows.find(start => dayIndex <= start + 1) ?? end - 1
  return addDays(weekStart(safeDate), firstMatchingWindow)
}

export function datesForCalendarPage(start: string, mode: CalendarView, weekEndDay: number | undefined): string[] {
  const anchor = alignCalendarStart(start, mode, weekEndDay)
  if (mode === 'day') return [anchor]
  if (mode === 'two') return [anchor, addDays(anchor, 1)]
  return weekHeaderDates(anchor, weekEndDay)
}

/** Date at the start of the next / previous visible page, for arrows and swipes. */
export function adjacentCalendarPage(start: string, mode: CalendarView, direction: -1 | 1, weekEndDay: number | undefined): string {
  const anchor = alignCalendarStart(start, mode, weekEndDay)
  if (mode === 'week') return addDays(anchor, direction * 7)
  if (mode === 'day') return shiftVisibleDay(anchor, direction, weekEndDay)
  const windows = twoDayStarts(weekEndDay)
  const index = windows.indexOf(weekdayIndex(anchor))
  const nextIndex = index + direction
  if (nextIndex < 0) return addDays(weekStart(anchor), windows[windows.length - 1] - 7)
  if (nextIndex >= windows.length) return addDays(weekStart(anchor), 7 + windows[0])
  return addDays(weekStart(anchor), windows[nextIndex])
}


/** A single unbroken rail for the 2-day view, rather than three duplicated
 * two-day pages. Consecutive windows share a day, which is inserted only ONCE.
 * At the configured week boundary (Fr/Sa/So) the next week starts cleanly.
 * Offsets are column indexes; each column is half the viewport width.
 */
export function twoDayRail(start: string, weekEndDay: number | undefined): {
  dates: string[]
  anchors: [string,string,string]
  offsets: [number,number,number]
} {
  const current = alignCalendarStart(start, 'two', weekEndDay)
  const previous = adjacentCalendarPage(current,'two',-1,weekEndDay)
  const next = adjacentCalendarPage(current,'two',1,weekEndDay)
  const anchors: [string,string,string] = [previous,current,next]
  const dates: string[] = []
  const offsets: number[] = []
  for (const anchor of anchors) {
    const windowDates = datesForCalendarPage(anchor,'two',weekEndDay)
    const first = windowDates[0]
    let index=dates.indexOf(first)
    if(index<0) {
      // Consecutive windows overlap only within a single workweek.
      // A new week follows the last configured weekday, not Sunday placeholders.
      index=dates.length
      dates.push(first)
    }
    offsets.push(index)
    for (const date of windowDates.slice(1)) {
      if(!dates.includes(date)) dates.push(date)
    }
  }
  return {dates,anchors,offsets:offsets as [number,number,number]}
}
