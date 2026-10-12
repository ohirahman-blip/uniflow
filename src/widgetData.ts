import { addDays, dateString, minutes, occurrencesOn, type AppData } from './model'

/** Serializable future data contract for a native UniFlow widget.
 * No UI, timers, credentials, Supabase queries or platform APIs are included.
 * The future widget adapter can read the signed-in user's workspace and call this selector.
 */
export type WidgetAppointment = {
  id: string
  title: string
  category: string
  organizer: string
  date: string
  from: string
  to: string
  room: string
  onlineLink: string
  place: string
  startsAt: string
  endsAt: string
  ongoing: boolean
}

export function nextWidgetAppointment(data: AppData, now: Date = new Date(), daysAhead = 120): WidgetAppointment | null {
  const todayDate = dateString(now)
  const currentMinutes = now.getHours() * 60 + now.getMinutes()
  const horizon = Math.max(0, Math.min(366, Math.floor(daysAhead)))
  for (let dayOffset = 0; dayOffset <= horizon; dayOffset++) {
    const date = addDays(todayDate, dayOffset)
    const next = occurrencesOn(data.offerings, date)
      .filter(occ => occ.offering.semesterId === data.activeSemesterId &&
        (dayOffset > 0 || minutes(occ.to) > currentMinutes))
      .sort((a, b) => minutes(a.from) - minutes(b.from))[0]
    if (!next) continue
    const room = next.offering.room?.trim() || ''
    const onlineLink = next.offering.onlineLink?.trim() || ''
    return {
      id: next.key,
      title: next.offering.name,
      category: next.offering.category,
      organizer: next.offering.organizer || '',
      date: next.date,
      from: next.from,
      to: next.to,
      room,
      onlineLink,
      place: [room, onlineLink ? 'Online' : ''].filter(Boolean).join(' + '),
      startsAt: `${next.date}T${next.from}`,
      endsAt: `${next.date}T${next.to}`,
      ongoing: dayOffset === 0 && minutes(next.from) <= currentMinutes
    }
  }
  return null
}
