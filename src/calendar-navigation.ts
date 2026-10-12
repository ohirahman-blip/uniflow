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

/** Deterministic two-day windows. Odd-length weeks end with one overlapping
 * window (Thu/Fri for a Friday cutoff, Sat/Sun for a Sunday cutoff). */
export const twoDayStarts = (weekEndDay: number | undefined): number[] => {
  const finalStart = lastVisibleWeekday(weekEndDay) - 1
  const result: number[] = []
  for (let i = 0; i <= finalStart; i += 2) result.push(i)
  if (result[result.length - 1] !== finalStart) result.push(finalStart)
  return result
}

/** Keep both two-day columns inside the same configured workweek.
 * Selecting its final day shows it together with the preceding visible day. */
export function alignCalendarStart(date: string, mode: CalendarView, weekEndDay: number | undefined): string {
  if (mode === 'week') return weekStart(date)
  const end = lastVisibleWeekday(weekEndDay)
  const safeDate = weekdayIndex(date) <= end ? date : shiftVisibleDay(date, 1, end)
  if (mode === 'day') return safeDate
  const dayIndex = weekdayIndex(safeDate)
  const firstMatchingWindow = twoDayStarts(end).find(start => dayIndex <= start + 1)
  return addDays(weekStart(safeDate), firstMatchingWindow ?? end - 1)
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
