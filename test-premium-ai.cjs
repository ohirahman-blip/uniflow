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
assert.equal(context.freeMinutes,60,'A real same-day gap is preserved')
const tomorrowOnly={...data,offerings:[{...offering,date:'2026-10-20',selected:true}]}
const evening=advice.adviceContext(tomorrowOnly,semester,[moduleA],new Date('2026-10-19T20:00:00'))
assert.equal(evening.nextLecture?.date,'2026-10-20','Next lesson is tomorrow')
assert.equal(evening.freeMinutes,0,'Tomorrow must not produce a fake 180-minute gap')
assert.doesNotMatch(advice.localAdvice(evening).message,/180 Minuten frei|bis zur nächsten Veranstaltung etwa/,'No fake next-day free time')
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
assert.match(dashboard,/firstName=data\.profile\.trim\(\)\.split/,'Greeting uses the current profile first name')
assert.match(dashboard,/nextCheckin=pending\[0\]/,'Only one pending check-in is offered at once')
assert.doesNotMatch(dashboard,/recent\.map\(/,'Other pending check-ins remain hidden until current one is rated')
assert.match(dashboard,/learn-checkins-stack/,'Next check-in is visually stacked')
assert.match(app,/name: 'Einstellungen', icon: Settings2/,'Mobile navigation uses Einstellungen')
assert.match(app,/<h1>Einstellungen<\/h1>/,'Settings title has no punctuation')
assert.doesNotMatch(app,/<span className="overline">UNIFLOW<\/span><h1>Einstellungen/,'Settings eyebrow removed')
assert.doesNotMatch(app,/<span className="overline">DEIN STUDIUM<\/span><h1>Module/,'Module eyebrow removed')
const uiPolish=fs.readFileSync('src/ui-polish.css','utf8')
assert.match(uiPolish,/\.module-hub \.page-title-row h1/,'Module title scoped to page')
assert.match(uiPolish,/\.settings-screen \.page-title-row h1/,'Settings title scoped to page')
assert.match(dashboard,/greetingForHour\(new Date\(\)\.getHours\(\)\)/,'Dashboard uses local-time greeting')
assert.doesNotMatch(dashboard,/>Dein Tag</,'Generic dashboard heading removed')
const greeting=load('src/dashboard-greeting.ts')
assert.equal(greeting.greetingForHour(8),'Guten Morgen')
assert.equal(greeting.greetingForHour(14),'Schönen Tag')
assert.equal(greeting.greetingForHour(19),'Guten Abend')
assert.equal(greeting.greetingForHour(23),'Gute Nacht')
const dashboardCss=fs.readFileSync('src/learning-dashboard.css','utf8')
assert.match(dashboardCss,/grid-template-columns:minmax\(0,1fr\) max-content/,'Check-in label stays aligned right')
assert.match(dashboardCss,/overflow-wrap:anywhere/,'Long lesson titles wrap without moving the label')
assert.match(dashboardCss,/white-space:nowrap;justify-self:end/,'Wie liefs label stays on one line')
assert.match(dashboard,/isAiRecommendation\?<><Sparkles size=\{15\}\/> uniflow\+/,'Real AI advice is labeled uniflow+ top-left')
assert.doesNotMatch(dashboard,/DEEPSEEK · UNIFLOW\+|Mit DeepSeek erstellt|uniflow\+ KI/,'No provider descriptions on advice card')
assert.doesNotMatch(dashboard,/learn-ai-controls/,'AI mode no longer appears on dashboard')
assert.match(app,/role="switch" aria-label="KI-Modus aktivieren"/)
assert.doesNotMatch(app,/Ein neuer Vorschlag beim Öffnen der App|DeepSeek im Hintergrund/,'No long public AI explanations in settings')
assert.doesNotMatch(app,/settings-ai-details"><summary>Datenschutz<\/summary>/,'Privacy disclosure no longer takes up visible space')
assert.match(app,/aria-describedby="settings-ai-data-note"/,'Screen readers still receive a concise AI data-sharing notice')
assert.match(app,/className="settings-ai-inline"/,'KI switch sits in one compact line')
assert.doesNotMatch(app,/Intelligente Empfehlungen<\/strong>/,'Redundant second line removed')
assert.match(app,/<BrandMark premium=\{premium\} page=\{page\}\/>/,'Header and sidebar share conditional branded logo')
assert.match(app,/dataset\.uniflowTier=premium\?'plus':'free'/,'Only server-fetched premium status switches themes')
const branding=fs.readFileSync('src/brand-theme.css','utf8')
assert.match(branding,/data-uniflow-tier='plus'/,'Purple-gold theme only applies to Plus accounts')
assert.match(branding,/uf-brandmark--free/,'Free wordmark has orange/pink plus on white text')
assert.match(branding,/uf-brandmark--plus/,'Plus wordmark gets purple/gold')
assert.match(branding,/@keyframes uf-brand-plus-turn/,'Premium plus rotates on remount')
assert.match(branding,/prefers-reduced-motion:reduce/,'Brand animations respect accessibility')
assert.match(app,/key=\{premium\?page:'static'\}/,'Premium plus remounts and rotates on page change')
assert.match(app,/<span className="uf-logo-plus" key=\{premium\?page:'static'\} aria-hidden="true"\/>/,'Logo uses geometric cross instead of ambiguous font plus')
assert.match(branding,/\.uf-brandmark \.uf-logo-plus::before[\s\S]*?\.uf-brandmark \.uf-logo-plus::after/,'Plus is formed from two perpendicular bars')
assert.match(branding,/\.uf-brandmark--plus \.uf-logo-plus::after\{background:#996f00!important\}/,'The gold plus uses exactly #996f00')
assert.match(branding,/--uniflow-accent:#996f00/,'All Plus theme accents are gold')
assert.match(branding,/--uf-primary:#996f00/,'Primary Plus token is gold')
assert.match(branding,/--uf-secondary:#996f00/,'Secondary Plus token is gold')
assert.match(branding,/linear-gradient\(110deg,#2b1731 0%,#56365f 51%,#241329 100%\)/,'The violet logo gradient is nearly black')
assert.match(branding,/\.calendar-compact-toolbar \.view-switch button.active/,'Calendar active view uses premium gold')
assert.match(branding,/\.mail-send:not\(:disabled\)/,'Postfach actions use gold for Plus')
assert.match(branding,/\.module-fast \.module-fast-quick-premium \.module-fast-preview-button/,'Module AI actions use gold for Plus')
assert.match(app,/ai\.consent&&ai\.errorMessage/,'Specific advice failures are visible on settings page')
assert.match(app,/ai\.consent&&ai\.working/,'Toggle immediately shows progress in settings')
assert.match(app,/ai\.consent&&!ai\.working&&ai\.advice/,'Fresh recommendation shown in settings after toggle')
assert.match(app,/\{premium\&\&<section className="settings-section settings-ai-section"/)
assert.match(hook,/VITE_UNIFLOW_AI_ENABLED === 'true'/)
assert.match(hook,/if\(!appActive\|\|!userId\|\|!premium\|\|!consent\|\|!deepseekConfigured\|\|!supabase\)/)
assert.match(hook,/document\.visibilityState==='visible'/)
assert.match(hook,/document\.addEventListener\('visibilitychange'/)
assert.match(hook,/setForegroundEpoch\(e=>e\+1\)/)
assert.match(hook,/setActivationEpoch\(e=>e\+1\)/,'OFF to ON allows an explicit fresh request')
assert.match(hook,/activationEpoch,signature\]/,'Activation restarts the request effect even in same foreground')
assert.match(hook,/sessionStorage\.removeItem\(cacheKey\(userId\)\)/,'Reactivating cannot replay cached AI advice')
assert.match(hook,/recordAiDailyAttempt\(userId\)/)
assert.match(hook,/describeAiRequestError\(error,'uniflow-ai-advice'\)/,'Advice failures carry precise diagnostics')
assert.match(edge,/model:Deno\.env\.get\('DEEPSEEK_MODEL'\)\?\.trim\(\)\|\|'deepseek-v4-flash'/,'Current provider model used')
assert.doesNotMatch(hook,/setInterval\(/,'No periodic DeepSeek background timer')
const schedule=load('src/ai-request-schedule.ts')
assert.equal(schedule.AI_DAILY_LIMIT,25)
assert.equal(schedule.canRequestOnOpen(true,true,0),true,'First foreground open can request')
assert.equal(schedule.canRequestOnOpen(true,true,24),true,'25th open can request')
assert.equal(schedule.canRequestOnOpen(true,true,25),false,'26th attempt blocked')
assert.equal(schedule.canRequestOnOpen(false,true,0),false,'Background cannot request')
assert.equal(schedule.canRequestOnOpen(true,false,0),false,'Disabled KI cannot request')
// Opening again can request immediately; no one-hour or 90-second restriction.
const fakeStore=new Map()
global.localStorage={
  getItem:(key)=>fakeStore.get(key)||null,
  setItem:(key,value)=>fakeStore.set(key,String(value))
}
const day='2026-10-13', key=schedule.aiUsageKey('premium-user',day)
assert.equal(schedule.readAiDailyAttempts('premium-user',day),0)
for(let i=0;i<25;i++)assert.equal(schedule.recordAiDailyAttempt('premium-user',day),true)
assert.equal(fakeStore.get(key),'25')
assert.equal(schedule.recordAiDailyAttempt('premium-user',day),false)
assert.equal(schedule.readAiDailyAttempts('premium-user','2026-10-14'),0,'New UTC day resets local limit')
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
assert.match(edge,/for\(let attempt=0;attempt<2;attempt\+\+\)/,'Empty DeepSeek replies retried once')
assert.match(edge,/max_tokens:900/,'More room for response')
assert.match(edge,/response_format:undefined/,'Retry without problematic JSON mode')
assert.match(edge,/max_tokens:1200/,'Retry allows adequate output length')
assert.match(edge,/if\(!recommendation\)return reply\(req,502,\{error:lastFailure,attempts:2\}\)/,'Still fail rather than fabricate responses')
assert.equal((compile('supabase/functions/uniflow-ai-advice/index.ts').diagnostics||[]).filter(x=>x.category===ts.DiagnosticCategory.Error).length,0,'Updated Edge Function parses')

assert.match(migration,/request_count < 25/)
assert.match(migration,/premium is true/)
assert.doesNotMatch(migration,/interval '90 seconds'/)
assert.match(app,/onRateOccurrence=\{setRatingOccurrence\}/,'Star opens focused rating sheet instead of event details')
assert.match(app,/ratingLesson&&ratingOccurrence&&<BottomSheet title="Bewertung"/)
assert.ok(app.includes('className="learn-checkin-heading" aria-label="Bewertung der Veranstaltung"'),'Calendar rating uses the dashboard heading style')
assert.ok(app.includes('{ratingModule?.name||ratingOccurrence.offering.name}'),'Calendar rating names the actual module')
assert.ok(app.includes("ratingLesson.label} · {formatDate(ratingLesson.date,{day:'numeric',month:'short'})}"),'Calendar rating includes the lesson label and date')
assert.ok(app.includes('<span className="learn-eyebrow">Wie lief\'s?</span>'),'Calendar rating keeps the familiar check-in prompt')
assert.match(app,/canRate=\{canRateOccurrence\(ratingOccurrence\)\}/)
assert.match(component,/placeholder="Thema hinzufügen"/)
assert.doesNotMatch(component,/DNA-Replikation|Gilt nur für diese Vorlesung|Einschätzung jederzeit wieder ändern|lesson-feedback-heading/)
const starCss=fs.readFileSync('src/ui-polish.css','utf8')
assert.match(starCss,/\.course \.course-rating-star\{[\s\S]*?background:transparent;/)
assert.match(starCss,/\.course \.course-rating-star\.is-rated \{[\s\S]*?background:transparent;/)
const style=fs.readFileSync('src/styles.css','utf8')
assert.doesNotMatch(style,/\.course\.course-inactive::after/)
assert.match(app,/course-rating-star/)
assert.match(app,/role="menuitem"[\s\S]{0,150}Bewerten/)
assert.match(component,/lesson-feedback-rating-'\+item\.value/)
assert.match(component,/emoji:'😊'/)
const moduleEditor=fs.readFileSync('src/ModuleScheduleEditor.tsx','utf8')
assert.match(moduleEditor,/premium\?/)
assert.match(moduleEditor,/\?\?false/,'Default groups collapsed')
assert.match(moduleEditor,/module-quick-thinking/,'Premium analysis animation')
assert.doesNotMatch(moduleEditor,/Beispiel: /)
const wheel=fs.readFileSync('src/UniflowPicker.tsx','utf8')
assert.match(wheel,/function PickerWheel\(/)
assert.match(wheel,/scrollTo\(/)
assert.match(wheel,/Array\.from\(\{length:60\}/,'Minute wheel supports 60 precise steps')

console.log('✔ uniflow+: per-lecture topics, reversible check-ins, timed local advice, server auth/premium/quota and safe DeepSeek wiring')
