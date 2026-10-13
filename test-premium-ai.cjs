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
assert.equal(context.previousWeak?.topic,'SQL-Joins',"Current recommendation uses last week's topic")
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
// A later successful review can compensate an initially weak lecture.
data.learningCheckins=data.learningCheckins.map(x=>x.key===previous.key?
  {...x,rating:'partial',updatedAt:'2026-10-17T10:00:00'}:x)
data.learningSessions=[{id:'review-1',moduleId:'module-a',date:'2026-10-18',duration:45,
  kind:'review',rating:'understood',lessonKey:previous.key,updatedAt:'2026-10-18T16:00:00'}]
assert.equal(advice.adviceContext(data,semester,[moduleA],now).previousWeak,null,
  'A later successful review removes stale not-understood advice')
data.learningSessions=[]
data.learningCheckins=data.learningCheckins.filter(x=>x.key!==previous.key)
const unknown=advice.adviceContext(data,semester,[moduleA],now)
assert.equal(unknown.pendingFeedback?.rating,'unrated','Unknown must never be mislabeled absent')
assert.equal(unknown.previousWeak,null)
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
assert.match(dashboard,/learn-recommendation-ai/,'Only real AI responses get a special gradient')
assert.match(dashboard,/isAiRecommendation\&\&<Sparkles size=\{15\}\/>/,'Free guidance has no AI icon')
assert.doesNotMatch(dashboard,/learn-ai-controls/,'AI mode no longer appears on dashboard')
assert.match(app,/role="switch" aria-label="KI-Modus aktivieren"/)
assert.match(app,/\{premium\&\&<section className="settings-section settings-ai-section"/)
assert.match(hook,/VITE_UNIFLOW_AI_ENABLED === 'true'/)
assert.match(hook,/if\(!appActive\|\|!userId\|\|!premium\|\|!consent\|\|!deepseekConfigured\|\|!supabase\)/)
assert.match(hook,/document\.visibilityState==='visible'/)
assert.match(hook,/localStorage\.setItem\(attemptKey\(userId\),String\(now\)\)/)
assert.match(hook,/setInterval\([\s\S]*?AI_CHECK_INTERVAL_MS/);
const schedule=load('src/ai-request-schedule.ts')
const HOUR=60*60*1000
assert.equal(schedule.AI_REQUEST_INTERVAL_MS,HOUR)
assert.equal(schedule.aiRequestDue(100000,0,true,true),true,'First visible launch requests immediately')
assert.equal(schedule.aiRequestDue(100000,0,false,true),false,'Hidden app never requests')
assert.equal(schedule.aiRequestDue(100000,0,true,false),false,'Disabled KI never requests')
assert.equal(schedule.aiRequestDue(100000,HOUR,true,true),false,'Too soon after last request')
const T=1_900_000_000_000
assert.equal(schedule.aiRequestDue(T,T-HOUR+1,true,true),false,'No early refresh')
assert.equal(schedule.aiRequestDue(T,T-HOUR,true,true),true,'Exactly one hour is due')
assert.equal(schedule.aiRequestDue(T,T-12*HOUR,false,true),false,'No catch-up while app closed')
assert.equal(schedule.aiRequestDue(T,T-12*HOUR,true,true),true,'On reopen only one request becomes due')
const sigBase=advice.adviceContext(data,semester,[moduleA],now)
const sigAfterMinute={...sigBase,localTime:'07:01',freeMinutes:sigBase.freeMinutes-1,
  nextLecture:sigBase.nextLecture&&{...sigBase.nextLecture,minutesUntil:sigBase.nextLecture.minutesUntil-1}}
assert.equal(schedule.aiAdviceSignature(sigBase),schedule.aiAdviceSignature(sigAfterMinute),
  'Minute-by-minute time drift does not invalidate AI advice')
const sigChanged={...sigBase,otherWeak:[...sigBase.otherWeak,{...sigBase.otherWeak[0],topic:'Ein anderes Thema'}]}
assert.notEqual(schedule.aiAdviceSignature(sigBase),schedule.aiAdviceSignature(sigChanged),
  'Material changes invalidate cached advice without extra network calls')
assert.doesNotMatch(app,/DEEPSEEK_API_KEY/,'Do not leak private DeepSeek secret to browser')
assert.match(edge,/auth\.getUser\(token\)/)
assert.match(edge,/\.select\('premium'\)/)
assert.match(edge,/\.rpc\('uniflow_consume_ai_quota'\)/)
assert.match(edge,/Deno\.env\.get\('DEEPSEEK_API_KEY'\)/)
assert.match(edge,/https:\/\/api\.deepseek\.com\/chat\/completions/)
assert.match(migration,/request_count < 25/)
assert.match(migration,/premium is true/)
console.log('✔ uniflow+: per-lecture topics, reversible check-ins, timed local advice, server auth/premium/quota and safe DeepSeek wiring')
