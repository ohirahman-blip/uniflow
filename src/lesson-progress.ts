import type {AppData} from './model'
import type {LearningRating} from './learning'
export type LessonProgress={green:number;yellow:number;label:string}
export function lessonProgressMap(data:Pick<AppData,'learningCheckins'|'learningSessions'|'scoreEvents'>){
  const result=new Map<string,LessonProgress>()
  const sessions=new Map<string,{goodRun:number;rating:LearningRating}>()
  const reversed=new Set((data.scoreEvents||[]).filter(event=>event.type==='study-minutes'&&event.reversedAt).map(event=>event.sourceId))
  const recorded=new Map((data.scoreEvents||[]).filter(event=>event.type==='study-minutes'&&!event.reversedAt).map(event=>[event.sourceId,event.occurredAt]))
  const ordered=[...(new Map((data.learningSessions||[]).map(session=>[session.id,session]))).values()].sort((a,b)=>(a.date||'').localeCompare(b.date||'')||(a.endedAt||recorded.get(a.id)||a.updatedAt).localeCompare(b.endedAt||recorded.get(b.id)||b.updatedAt)||a.id.localeCompare(b.id))
  for(const session of ordered){
    if(reversed.has(session.id))continue
    const keys=[...new Set([...(session.lessonKeys||[]),...(session.lessonKey?[session.lessonKey]:[])])]
    for(const key of keys){
      const state=sessions.get(key)||{goodRun:0,rating:'struggling'}
      state.goodRun=session.rating==='understood'?state.goodRun+1:0
      state.rating=session.rating
      sessions.set(key,state)
    }
  }
  const learned=new Set((data.scoreEvents||[]).filter(event=>event.type==='content-learned'&&!event.reversedAt).map(event=>event.sourceId))
  const checkins=new Map((data.learningCheckins||[]).map(item=>[item.key,item]))
  for(const key of new Set([...learned,...sessions.keys(),...checkins.keys()])){
    const session=sessions.get(key),checkin=checkins.get(key)
    const attended=!!checkin&&(checkin.attended??checkin.rating!=='absent')
    let yellow=attended?1:0,green=learned.has(key)||session?1:0
    if(attended&&checkin?.understandingSelected!==false){
      if(checkin?.rating==='partial')yellow=2
      if(checkin?.rating==='understood')yellow=3
    }
    if(session?.rating==='partial')green=2
    if(session?.rating==='understood')green=session.goodRun>=2?4:3
    const meaning=green===4?'Wiederholt und gefestigt':green===3?'Gelernt und gut verstanden':green===2?'Gelernt und teilweise verstanden':green===1?'Gelernt, Verständnis noch offen':'Noch nicht gelernt'
    result.set(key,{green,yellow,label:meaning+(yellow===3?' · Beim Besuch gut verstanden':yellow===2?' · Beim Besuch teilweise verstanden':yellow===1?' · Besucht':'')})
  }
  return result
}
