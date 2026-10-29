import {addDays,dateString,fromDate,selectedAssessment,today,type AppData,type Semester} from './model'
export function scoreTrend(data:Pick<AppData,'scoreEvents'|'assessments'>,moduleId:string,semester:Semester,reference=today()){
  const start=semester.start
  const exams=data.assessments.filter(exam=>exam.semesterId===semester.id&&exam.type==='exam'&&exam.date&&selectedAssessment(exam,data.assessments)).map(exam=>exam.date).sort()
  const lastExam=exams[exams.length-1]
  const end=(lastExam||semester.end)>start?(lastExam||semester.end):addDays(start,1)
  const through=reference<end?reference:end
  const totals=new Map<string,number>()
  let baseline=0
  for(const event of new Map((data.scoreEvents||[]).map(event=>[event.id,event])).values()){
    if(event.moduleId!==moduleId||event.reversedAt||!Number.isFinite(event.points))continue
    const timestamp=new Date(event.occurredAt)
    if(!Number.isFinite(timestamp.getTime()))continue
    const date=dateString(timestamp)
    if(date>through)continue
    if(date<start)baseline+=event.points
    else totals.set(date,(totals.get(date)||0)+event.points)
  }
  const points:{date:string;value:number}[]=[]
  let total=baseline
  if(through>=start){
    points.push({date:start,value:baseline})
    for(const [date,amount] of [...totals].sort(([a],[b])=>a.localeCompare(b))){total+=amount;points.push({date,value:total})}
    if(points[points.length-1]?.date!==through)points.push({date:through,value:total})
  }
  const span=Math.max(1,fromDate(end).getTime()-fromDate(start).getTime())
  const x=(date:string)=>(fromDate(date).getTime()-fromDate(start).getTime())/span
  return {start,end,lastExam,through,points,total,x}
}
