import type {AppData} from './model'
import type {LearningRating} from './learning'
export type LessonProgress={green:number;yellow:number;label:string}
export function lessonProgressMap(data:Pick<AppData,'learningCheckins'|'learningSessions'|'scoreEvents'>){
  const result=new Map<string,LessonProgress>()
  const sessions=new Map<string,{count:number;minutes:number;rating:LearningRating;latest:string}>()
  const reversed=new Set((data.scoreEvents||[]).filter(event=>event.type==='study-minutes'&&event.reversedAt).map(event=>event.sourceId))
  for(const session of data.learningSessions||[]){
    if(reversed.has(session.id))continue
    const keys=[...new Set([...(session.lessonKeys||[]),...(session.lessonKey?[session.lessonKey]:[])])]
    for(const key of keys){
      const state=sessions.get(key)||{count:0,minutes:0,rating:'struggling',latest:''}
      state.count++;state.minutes+=session.duration/keys.length
      if(session.updatedAt>=state.latest){state.latest=session.updatedAt;state.rating=session.rating}
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
    if(session?.rating==='understood')green=session.count>=2&&session.minutes>=60?4:3
    const meaning=green===4?'Wiederholt und gefestigt':green===3?'Gelernt und gut verstanden':green===2?'Gelernt und teilweise verstanden':green===1?'Gelernt, Verständnis noch offen':'Noch nicht gelernt'
    result.set(key,{green,yellow,label:meaning+(yellow===3?' · Beim Besuch gut verstanden':yellow===2?' · Beim Besuch teilweise verstanden':yellow===1?' · Besucht':'')})
  }
  return result
}
