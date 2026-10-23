import {addDays,today,type AppData} from './model'
export function streakCount(days:string[]|undefined,reference=today()){
  const dates=new Set(days||[])
  let cursor=dates.has(reference)?reference:addDays(reference,-1),count=0
  while(dates.has(cursor)&&count<10000){count++;cursor=addDays(cursor,-1)}
  return count
}
/** Award once per civil date. Only newly earned points receive today's boost. */
export function applyScoreAwards(previous:AppData,next:AppData):AppData{
  const old=new Map((previous.scoreEvents||[]).map(event=>[event.id,event]))
  const earned=(next.scoreEvents||[]).filter(event=>{
    const before=old.get(event.id)
    return !event.reversedAt&&event.basePoints>0&&(!before||!!before.reversedAt||event.basePoints>before.basePoints)
  })
  const days=[...new Set([...(previous.streakDays||[]),...(next.streakDays||[]),...(earned.length?[today()]:[])])].sort()
  const multiplier=streakCount(days)>=7?1.5:1,ids=new Set(earned.map(event=>event.id))
  return {...next,streakDays:days,scoreEvents:(next.scoreEvents||[]).map(event=>{
    const previousEvent=old.get(event.id)
    const awardMultiplier=ids.has(event.id)?multiplier:previousEvent?.multiplier??event.multiplier
    return {...event,multiplier:awardMultiplier,points:Math.round(event.basePoints*awardMultiplier)}
  })}
}
