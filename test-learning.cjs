/* Regression checks for the read-only learning journey. Calendar logic is stubbed here
   so the tests never mutate or depend on production calendar components. */
const assert = require('node:assert/strict')
const fs = require('node:fs')
const vm = require('node:vm')
const ts = require('typescript')
const text = fs.readFileSync('src/learning.ts','utf8')
const js = ts.transpileModule(text,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText
const iso = d => d.toISOString().slice(0,10)
const fromDate = s => new Date(s+'T12:00:00Z')
const addDays = (d,n) => iso(new Date(fromDate(d).getTime()+n*86400000))
const weekStart = d => addDays(d,-((fromDate(d).getUTCDay()+6)%7))
const model = {
  addDays, fromDate, weekStart, today:()=> '2026-10-12',
  isAssessment: name=> /exam|klausur|hausaufgabe/i.test(name),
  minutes: t=>Number(t.split(':')[0])*60+Number(t.split(':')[1]),
  occurrencesOn: (offerings, date)=> offerings.flatMap(o=>{
    if(!o.selected || date<o.date || date>o.endDate || (o.recurrence==='once'&&o.date!==date))return []
    const delta=Math.round((fromDate(date)-fromDate(o.date))/86400000)
    if(o.recurrence==='weekly'&&delta%7!==0)return []
    if(o.recurrence==='biweekly'&&delta%14!==0)return []
    return [{key:o.id+':'+date,origin:date,date,from:o.from,to:o.to,offering:o,isOverride:false}]
  })
}
const moduleObject={exports:{}}
vm.runInNewContext(js,{module:moduleObject,exports:moduleObject.exports,require:n=>{
  if(n==='./model')return model
  throw Error('Unexpected dependency '+n)
},Date,Math,Set,Map,Object,Number,String}, {filename:'learning.compiled.cjs'})
const {pastLearningUnits,learningUnitKey,deriveLearningJourneys}=moduleObject.exports
const semester={id:'sem',start:'2026-10-01',end:'2026-10-31',lectureEnd:'2026-10-31'}
const mod = id=>({id,name:id,degreeId:'degree',credits:6,color:'#ddd',shortName:id,status:'current',semesterIds:['sem']})
const offering=(id,moduleId,contentId,date='2026-10-05',category='Vorlesung')=>({
  id,moduleId,semesterId:'sem',contentId,contentLabel:'VL 01',date,endDate:date,
  from:'08:00',to:'10:00',category,selected:true,recurrence:'once',overrides:{}
})
const a=offering('a','A','part1')
const alt={...offering('a-alt','A','part1'),from:'10:00',to:'12:00'}
const b=offering('b','B','part2')
const database=(offerings,checkins=[],sessions=[],assessments=[])=>({
  offerings,assessments,learning:{checkins,sessions,plans:[]}
})
const none=database([a,alt,b])
const past=pastLearningUnits(none,semester,'2026-10-12')
assert.equal(past.length,2,'Two selected alternatives must count as one teaching unit')
const key=learningUnitKey({offering:a,origin:a.date})
assert.equal(key,past.find(x=>x.moduleId==='A').key)
const checkin=(moduleId,k,rating)=>({key:k,moduleId,semesterId:'sem',date:a.date,rating,updatedAt:100})
const cA=checkin('A',key,'unclear')
const base=deriveLearningJourneys(database([a,b],[cA]),semester,[mod('A'),mod('B')],'2026-10-12')
assert.equal(base.find(x=>x.module.id==='A').rated,1)
assert.equal(base.find(x=>x.module.id==='B').understanding,null,'Unknown should not be scored zero')
const session=(id,kind,targetKey,outcome,date='2026-10-08')=>({
  id,moduleId:'A',semesterId:'sem',date,duration:60,kind,targetKey,outcome,createdAt:10
})
const later=deriveLearningJourneys(database([a,b],[cA],[session('s1','review',key,'good'),session('s2','review',key,'good','2026-10-10')]),semester,[mod('A')],'2026-10-12')[0]
assert.ok(later.understanding>base[0].understanding,'Successful targeted reviews must heal past learning gaps')
assert.ok(later.repetition>0,'Repeated learning on distinct days should count')
const cB=checkin('B',learningUnitKey({offering:b,origin:b.date}),'unclear')
const urgent=deriveLearningJourneys(database([a,b],[checkin('A',key,'good'),cB],[],[
  {id:'exam-a',type:'exam',moduleId:'A',date:'2026-10-14',semesterId:'sem'},
  {id:'exam-b',type:'exam',moduleId:'B',date:'2026-11-20',semesterId:'sem'}
]),semester,[mod('A'),mod('B')],'2026-10-12')
assert.equal(urgent[0].module.id,'A','Near exam takes priority even when other module has gaps')
const withoutExamTraining=deriveLearningJourneys(database([a],[checkin('A',key,'good')],[session('s3','review',key,'good')]),semester,[mod('A')],'2026-10-12')[0]
assert.ok(withoutExamTraining.preparation<=80,'Without exam practice preparation cannot exceed 80%')
const free=offering('free','A','freepart','2026-10-06','Freies Lernen')
assert.equal(pastLearningUnits(database([free]),semester,'2026-10-12').length,0)
assert.equal(pastLearningUnits(database([free]),semester,'2026-10-12',true).length,1)
console.log('Learning journey assertions passed.')
