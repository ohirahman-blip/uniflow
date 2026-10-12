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

/** Keep both two-day columns inside the same configured workweek.
 * Selecting its final day shows it together with the preceding visible day. */
export function alignCalendarStart(date: string, mode: CalendarView, weekEndDay: number | undefined): string {
  if (mode === 'week') return weekStart(date)
  const end = lastVisibleWeekday(weekEndDay)
  const safeDate = weekdayIndex(date) <= end ? date : shiftVisibleDay(date, 1, end)
  if (mode === 'day') return safeDate
  const dayIndex = weekdayIndex(safeDate)
  return addDays(weekStart(safeDate), Math.min(dayIndex, end - 1))
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
  const index = weekdayIndex(anchor)
  const lastStart = lastVisibleWeekday(weekEndDay) - 1
  if (direction === 1) {
    if (index + 2 <= lastStart) return addDays(anchor, 2)
    if (index < lastStart) return addDays(weekStart(anchor), lastStart)
    return addDays(weekStart(anchor), 7)
  }
  if (index - 2 >= 0) return addDays(anchor, -2)
  if (index > 0) return weekStart(anchor)
  return addDays(weekStart(anchor), lastStart - 7)
}
