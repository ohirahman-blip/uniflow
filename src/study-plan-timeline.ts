import {addDays,fromDate,type Assessment} from './model'
import type {StudyDayBundle,StudyPlan} from './adaptive-study-plan'
export type LearningTimelineRow={date:string;to?:string;gap:boolean;today:boolean;start:boolean;intensity:0|1|2;bundles:StudyDayBundle[];exams:Assessment[]}
const stamp=(value:string)=>fromDate(value).getTime()
export function learningTimelineRows(plan:StudyPlan,moduleId:string,exams:Assessment[],semesterStart:string):LearningTimelineRow[]{
  const bundles=plan.bundles.filter(bundle=>bundle.moduleId===moduleId)
  const own=exams.filter(exam=>exam.moduleId===moduleId&&exam.date)
  const start=semesterStart&&semesterStart<plan.reference?semesterStart:plan.reference
  const dates=[...new Set([start,plan.reference,...bundles.map(bundle=>bundle.date),...own.map(exam=>exam.date)])].filter(date=>date>=start).sort()
  const rows:LearningTimelineRow[]=[]
  const intensity=(date:string):0|1|2=>{
    const targets=own.filter(exam=>!exam.completed&&exam.date>=date).sort((a,b)=>a.date.localeCompare(b.date))
    const target=targets[0]?.date
    if(!target)return 0
    const ratio=(stamp(date)-stamp(start))/Math.max(86400000,stamp(target)-stamp(start))
    return ratio>=2/3?2:ratio>=1/3?1:0
  }
  for(const [index,date] of dates.entries()){
    const previous=dates[index-1]
    if(previous&&Math.round((stamp(date)-stamp(previous))/86400000)>2){
      const from=addDays(previous,1)
      rows.push({date:from,to:addDays(date,-1),gap:true,today:false,start:false,intensity:intensity(from),bundles:[],exams:[]})
    }
    rows.push({date,gap:false,today:date===plan.reference,start:date===semesterStart,intensity:intensity(date),bundles:bundles.filter(bundle=>bundle.date===date).sort((a,b)=>Number(!!b.completed)-Number(!!a.completed)),exams:own.filter(exam=>exam.date===date)})
  }
  return rows
}
