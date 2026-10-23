const assert=require('node:assert/strict')
const fs=require('node:fs')
const ts=require('typescript')
function compile(path){
  const result=ts.transpileModule(fs.readFileSync(path,'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2020,module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX},reportDiagnostics:true})
  assert.equal((result.diagnostics||[]).filter(item=>item.category===ts.DiagnosticCategory.Error).length,0,path+' syntax')
  return result.outputText
}
const model={exports:{}}
new Function('module','exports','require',compile('src/model.ts'))(model,model.exports,require)
const learning={exports:{}}
new Function('module','exports','require',compile('src/learning.ts'))(learning,learning.exports,id=>id==='./model'?model.exports:require(id))
const score={exports:{}}
new Function('module','exports','require',compile('src/score.ts'))(score,score.exports,id=>id==='./model'?model.exports:id==='./learning'?learning.exports:require(id))
const {SCORE_RULES,attendancePoints,learnedPoints,makeScoreEvent,normalizeBigUpdate,numberedLessons,scoreTotal,upsertScoreEvent}=score.exports
assert.deepEqual(SCORE_RULES,{moduleCreated:100,todoCompleted:20,lectureAttendance:100,exerciseAttendance:50,lectureLearned:100,exerciseLearned:50,minute:2,checkin:5})
assert.equal(attendancePoints('Vorlesung'),100)
assert.equal(attendancePoints('Übung'),50)
assert.equal(learnedPoints('Tutorium'),50)
const start=makeScoreEvent({id:'module-created:m',moduleId:'m',type:'module-created',basePoints:100,occurredAt:'2026-10-22T10:00:00Z',sourceId:'m'})
const boosted=makeScoreEvent({id:'future',moduleId:'m',type:'study-minutes',basePoints:20,multiplier:1.5,occurredAt:'2026-10-22T11:00:00Z',sourceId:'s'})
assert.equal(scoreTotal([start,boosted],'m'),130,'Score has no upper limit and stores the awarded value')
assert.equal(upsertScoreEvent([start],{...start,reversedAt:'2026-10-22T12:00:00Z'}).length,1,'Reversible awards are updated, never duplicated')
const {emptyData}=model.exports
const semester={id:'s',degreeId:'d',name:'WS',start:'2026-10-01',end:'2027-03-31',lectureEnd:'2026-10-31',archived:false}
const moduleA={id:'m',degreeId:'d',name:'Geographie',shortName:'GEO',credits:6,color:'#88aaff',status:'current',grade:'',counted:true,hidden:false,semesterIds:['s']}
const offering=(id,category,date)=>({id,semesterId:'s',moduleId:'m',name:category,category,contentId:id,date,endDate:date,from:'10:00',to:'12:00',recurrence:'once',overrides:{},room:'',selected:true})
let data={...emptyData,modules:[moduleA],offerings:[offering('vl1','Vorlesung','2026-10-05'),offering('ue1','Übung','2026-10-06'),offering('vl2','Vorlesung','2026-10-12')]}
const lessons=numberedLessons(data,semester,'m')
assert.deepEqual(lessons.map(item=>item.label),['Vorlesung 1','Übung 1','Vorlesung 2'])
data={...data,learningSessions:[{id:'old-session',moduleId:'m',date:'2026-10-10',duration:30,kind:'review',rating:'understood',updatedAt:'2026-10-10T12:00:00Z'}],learningCheckins:[{key:lessons[0].key,moduleId:'m',contentId:'vl1',date:'2026-10-05',rating:'understood',updatedAt:'2026-10-05T12:00:00Z'}]}
const migrated=normalizeBigUpdate(data)
assert.equal(scoreTotal(migrated.scoreEvents,'m'),165,'Legacy session, attendance and check-in are preserved as score events')
assert.deepEqual(normalizeBigUpdate(migrated).scoreEvents,migrated.scoreEvents,'Migration is idempotent')
const app=fs.readFileSync('src/App.tsx','utf8'),home=fs.readFileSync('src/ModuleLearningHome.tsx','utf8')
assert.match(app,/module-created:\$\{m\.id\}/,'New modules receive the start bonus')
assert.match(app,/title: 'Lernen'/,'New learning home replaces the old overview navigation')
assert.doesNotMatch(app,/title: 'Module', icon:/,'Legacy module hub is not in the main navigation')
assert.match(home,/onLearnContent/)
assert.match(home,/mlh-completed-preview/)
assert.match(home,/Letzte Aktivitäten/)
console.log('✔ bigupdate: score rules, unlimited totals, idempotent migration, numbering, start bonus and new module home')
