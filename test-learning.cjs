const assert=require('node:assert/strict')
const fs=require('node:fs')
const ts=require('typescript')
function compile(path){
  const res=ts.transpileModule(fs.readFileSync(path,'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2020,module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX},reportDiagnostics:true})
  assert.equal((res.diagnostics||[]).filter(d=>d.category===ts.DiagnosticCategory.Error).length,0,path+' TS syntax')
  return res.outputText
}
const model={exports:{}}
new Function('module','exports','require',compile('src/model.ts'))(model,model.exports,require)
const learning={exports:{}}
new Function('module','exports','require',compile('src/learning.ts'))(learning,learning.exports,id=>id==='./model'?model.exports:require(id))
const dashboard=ts.transpileModule(fs.readFileSync('src/LearningDashboard.tsx','utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2020,jsx:ts.JsxEmit.ReactJSX},reportDiagnostics:true})
assert.equal((dashboard.diagnostics||[]).filter(d=>d.category===ts.DiagnosticCategory.Error).length,0,'Dashboard TSX syntax')
const {pastLessons,pastFreeStudy,journeyFor}=learning.exports
const {emptyData}=model.exports
const moduleA={id:'a',degreeId:'d',name:'A',shortName:'A',credits:6,color:'#fff',status:'current',grade:'',counted:true,hidden:false,semesterIds:['s']}
const moduleB={...moduleA,id:'b',name:'B'}
const semester={id:'s',degreeId:'d',name:'WS',start:'2026-10-01',end:'2027-03-31',lectureEnd:'2027-02-15',archived:false}
const makeOffer=(id,moduleId,selected,day)=>({id,semesterId:'s',moduleId,name:'Vorlesung',category:'Vorlesung',contentId:moduleId+'-part1',contentLabel:'VL1',date:day,endDate:'2026-10-26',from:'08:00',to:'10:00',recurrence:'weekly',overrides:{},room:'',selected})
const data={...emptyData,offerings:[
  makeOffer('a1','a',true,'2026-10-05'),
  makeOffer('a2','a',false,'2026-10-06'),
  makeOffer('b1','b',true,'2026-10-05')
],modules:[moduleA,moduleB],assessments:[{id:'exam',semesterId:'s',moduleId:'a',type:'exam',title:'Klausur',date:'2026-10-15'}]}
const lessons=pastLessons(data,semester,new Date('2026-10-12T12:00:00'))
assert.equal(lessons.filter(x=>x.moduleId==='a').length,2,'Do not double count alternatives')
const a=lessons.filter(x=>x.moduleId==='a')
const b=lessons.filter(x=>x.moduleId==='b')
data.learningCheckins=[...a.map(x=>({key:x.key,moduleId:'a',contentId:x.contentId,date:x.date,rating:'understood',updatedAt:'2026-10-12T12:00:00'})),...b.map(x=>({key:x.key,moduleId:'b',contentId:x.contentId,date:x.date,rating:'struggling',updatedAt:'2026-10-12T12:00:00'}))]
const A=journeyFor(data,moduleA,lessons,'2026-10-12')
const B=journeyFor(data,moduleB,lessons,'2026-10-12')
assert.ok(A.priority>B.priority,'Imminent exam A must outrank weak distant B')
assert.equal(A.understanding,100)
assert.equal(B.understanding,10)
assert.ok(A.preparation<=80,'100% lecture understanding without practice cannot imply full exam preparation')
data.learningSessions=[{id:'r1',moduleId:'b',date:'2026-10-13',duration:45,kind:'review',rating:'understood',lessonKey:b[0].key,updatedAt:'2026-10-13T12:00:00'},{id:'r2',moduleId:'b',date:'2026-10-16',duration:45,kind:'review',rating:'understood',lessonKey:b[0].key,updatedAt:'2026-10-16T12:00:00'}]
const B2=journeyFor(data,moduleB,lessons,'2026-10-12')
assert.ok(B2.understanding>B.understanding,'Study reviews must compensate poor initial check-ins')
assert.ok(B2.repetition>B.repetition,'Spaced repetition improves score')
const freeA={...makeOffer('freeA','a',true,'2026-10-05'),category:'Freies Lernen',contentId:'one-free-content'}
const freeAlt={...makeOffer('freeAlt','a',true,'2026-10-05'),category:'Freies Lernen',contentId:'one-free-content'}
assert.equal(pastFreeStudy({...data,offerings:[freeA,freeAlt]},semester,new Date('2026-10-12T12:00:00')).length,2,'Alternatives of weekly free learning count once per week')
console.log('✔ learning journey: deduplication, exam priority, capped readiness, review compensation, TSX parsing')