const assert=require('node:assert/strict')
const fs=require('node:fs')
const ts=require('typescript')
const compile=(path)=>ts.transpileModule(fs.readFileSync(path,'utf8'),{
  compilerOptions:{target:ts.ScriptTarget.ES2020,module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX},
  reportDiagnostics:true
})
const load=(path,requireMapping={})=>{
  const result=compile(path)
  const problems=(result.diagnostics||[]).filter(d=>d.category===ts.DiagnosticCategory.Error)
  assert.equal(problems.length,0,path+' TS parse: '+problems.map(d=>d.messageText).join('; '))
  const mod={exports:{}}
  new Function('module','exports','require',result.outputText)(mod,mod.exports,name=>requireMapping[name]||require(name))
  return mod.exports
}
const model=load('src/model.ts')
const learning=load('src/learning.ts',{'./model':model})
const advice=load('src/study-advice.ts',{'./model':model,'./learning':learning})
const moduleA={id:'module-a',degreeId:'d',name:'Datenbanken',shortName:'DB',credits:6,color:'#fff',
  status:'current',grade:'',counted:true,hidden:false,semesterIds:['s']}
const semester={id:'s',degreeId:'d',name:'WS',start:'2026-10-01',end:'2027-03-31',lectureEnd:'2027-02-15',archived:false}
const offering={id:'lecture-1',semesterId:'s',moduleId:'module-a',name:'Datenbanken',category:'Vorlesung',
  contentId:'lecture-a',contentLabel:'VL Teil 1',date:'2026-10-05',endDate:'2026-11-30',from:'08:00',
  to:'10:00',recurrence:'weekly',overrides:{},room:'',selected:true}
const alternative={...offering,id:'lecture-2',date:'2026-10-06',contentId:'lecture-a',selected:false}
const data={...model.emptyData,modules:[moduleA],offerings:[offering,alternative],
  assessments:[{id:'ex',moduleId:'module-a',semesterId:'s',type:'exam',title:'Datenbanken',date:'2026-10-25'}]}
const now=new Date('2026-10-19T07:00:00')
let lessons=learning.pastLessons(data,semester,now)
assert.equal(lessons.length,2,'Two teaching weeks with unselected alternatives ignored')
const previous=lessons.find(x=>x.date==='2026-10-12')
const earlier=lessons.find(x=>x.date==='2026-10-05')
assert.ok(previous&&earlier)
assert.notEqual(previous.key,earlier.key,'Each teaching week has its own feedback identity')
data.lessonTopics=[{key:previous.key,moduleId:'module-a',contentId:'lecture-a',date:previous.date,
  title:'SQL-Joins',updatedAt:'2026-10-18T12:00:00'}]
lessons=learning.pastLessons(data,semester,now)
assert.equal(lessons.find(x=>x.key===previous.key).label,'SQL-Joins')
assert.equal(lessons.find(x=>x.key===earlier.key).label,'VL Teil 1','A topic cannot rename the whole series')
data.learningCheckins=[
  {key:previous.key,moduleId:'module-a',contentId:'lecture-a',date:previous.date,
    rating:'partial',updatedAt:'2026-10-17T12:00:00'},
  {key:earlier.key,moduleId:'module-a',contentId:'lecture-a',date:earlier.date,
    rating:'struggling',updatedAt:'2026-10-06T12:00:00'}
]
const context=advice.adviceContext(data,semester,[moduleA],now)
assert.equal(context.nextLecture?.minutesUntil,60)
assert.equal(context.previousWeak?.topic,'SQL-Joins','Current recommendation uses last week's topic')
const tip=advice.localAdvice(context)
assert.match(tip.message,/SQL-Joins/)
assert.equal(tip.source,'local')
assert.equal(tip.minutes,15)
const adviceOriginal=learning.journeyFor(data,moduleA,lessons,'2026-10-19')
data.learningCheckins=data.learningCheckins.map(x=>x.key===previous.key?
  {...x,rating:'understood',updatedAt:'2026-10-18T14:00:00'}:x)
const revised=advice.adviceContext(data,semester,[moduleA],now)
assert.equal(revised.previousWeak,null,'An older poor rating must not override understood previous lecture')
const after=learning.journeyFor(data,moduleA,lessons,'2026-10-19')
assert.ok(after.understanding>adviceOriginal.understanding,'Changing a rating changes the current journey')
const forged=advice.parseAiAdvice({title:'Etwas tun',message:'Kurz üben',kind:'review',
  moduleId:'someone-else',lessonKey:'someone-else',minutes:999},context)
assert.equal(forged.moduleId,undefined)
assert.equal(forged.lessonKey,undefined)
assert.equal(forged.minutes,60)
assert.equal(advice.parseAiAdvice({title:'',message:'',kind:'review'},context),null)

const app=fs.readFileSync('src/App.tsx','utf8')
const dashboard=fs.readFileSync('src/LearningDashboard.tsx','utf8')
const component=fs.readFileSync('src/LessonFeedback.tsx','utf8')
const hook=fs.readFileSync('src/usePremiumAdvice.ts','utf8')
const edge=fs.readFileSync('supabase/functions/uniflow-ai-advice/index.ts','utf8')
const migration=fs.readFileSync('supabase/migrations/20261013_uniflow_ai_quota.sql','utf8')
for(const filename of ['src/App.tsx','src/LearningDashboard.tsx','src/LessonFeedback.tsx','src/usePremiumAdvice.ts']){
  assert.equal((compile(filename).diagnostics||[]).filter(x=>x.category===ts.DiagnosticCategory.Error).length,0,filename+' TSX parses')
}
assert.match(app,/<LessonFeedback key=\{lesson\.key\}/,'Calendar occurrence detail includes feedback panel')
assert.match(app,/onTopic=\{saveLectureTopic\} onRating=\{saveLectureRating\}/)
assert.match(component,/onBlur=\{e=>save\(e\.currentTarget\.value\)\}/)
assert.match(component,/onRating\(lesson,item\.value\)/)
assert.match(dashboard,/className="learn-recommendation learn-recommendation-dynamic"/)
assert.match(dashboard,/premium\&\&<div className="learn-ai-controls"/)
assert.match(hook,/VITE_UNIFLOW_AI_ENABLED === 'true'/)
assert.match(hook,/if\(!userId\|\|!premium\|\|!consent\|\|!deepseekConfigured\|\|!supabase\)/)
assert.doesNotMatch(app,/DEEPSEEK_API_KEY/,'Do not leak private DeepSeek secret to browser')
assert.match(edge,/auth\.getUser\(token\)/)
assert.match(edge,/\.select\('premium'\)/)
assert.match(edge,/\.rpc\('uniflow_consume_ai_quota'\)/)
assert.match(edge,/Deno\.env\.get\('DEEPSEEK_API_KEY'\)/)
assert.match(edge,/https:\/\/api\.deepseek\.com\/chat\/completions/)
assert.match(migration,/request_count < 25/)
assert.match(migration,/premium is true/)
console.log('✔ uniflow+: per-lecture topics, reversible check-ins, timed local advice, server auth/premium/quota and safe DeepSeek wiring')
