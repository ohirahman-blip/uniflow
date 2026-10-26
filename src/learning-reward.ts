import type {ScoreEvent} from './learning'
export type LearningReward={id:string;moduleId:string;kind:'session'|'content';points:number}
/** Read the final awarded group, not estimates before the streak multiplier. */
export function rewardPoints(events:ScoreEvent[]|undefined,groupId:string){
  return (events||[]).reduce((total,event)=>total+(event.groupId===groupId&&!event.reversedAt?Math.max(0,event.points):0),0)
}
