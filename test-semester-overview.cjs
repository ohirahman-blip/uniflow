const assert=require('node:assert/strict'),fs=require('node:fs'),ts=require('typescript')
const {renderToStaticMarkup}=require('react-dom/server'),React=require('react')
const cache=new Map()
function load(name){
  if(cache.has(name))return cache.get(name)
  const exports={};cache.set(name,exports)
  const filename=fs.existsSync('src/'+name+'.tsx')?'src/'+name+'.tsx':'src/'+name+'.ts'
  const code=ts.transpileModule(fs.readFileSync(filename,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020,jsx:ts.JsxEmit.ReactJSX}}).outputText
  new Function('exports','require',code)(exports,id=>id.endsWith('.css')?{}:id.startsWith('./')?load(id.slice(2)):require(id))
  return exports
}
const {emptyData,today,addDays}=load('model')
const {studyPreferences}=load('adaptive-study-plan')
const reference=today(),noop=()=>{}
const subject={id:'a',name:'Informatik',shortName:'INF',degreeId:'d',semesterIds:['s'],status:'current',color:'#abc',credits:6}
const data={...emptyData,activeDegreeId:'d',activeSemesterId:'s',modules:[subject,{...subject,id:'b',name:'Fremdmodul'}],semesters:[{id:'s',degreeId:'d',start:addDays(reference,-10),end:addDays(reference,60),lectureEnd:addDays(reference,30)}],
  offerings:[{id:'o',semesterId:'s',moduleId:'a',name:'Vorlesung',category:'Vorlesung',organizer:'Prof. Muster',date:addDays(reference,1),endDate:addDays(reference,1),from:'10:00',to:'12:00',recurrence:'once',selected:true,overrides:{},room:'HE 101'}],
  assessments:[{id:'exam',semesterId:'s',moduleId:'a',type:'exam',title:'Eigene Klausur',date:addDays(reference,30)},{id:'foreign',semesterId:'s',moduleId:'b',type:'exam',title:'Fremde Klausur',date:addDays(reference,29)}]}
const bundle=(i,moduleId='a')=>({id:'bundle'+i,date:addDays(reference,i),moduleId,examId:'exam',minutes:30,items:[{key:'lesson'+i,label:'Vorlesung '+(i+1),minutes:30,target:1}]})
const plan={reference,preferences:studyPreferences(data),notices:[],lessons:[],bundles:[...Array.from({length:10},(_,i)=>bundle(i)),{...bundle(0,'b'),id:'foreign-bundle',items:[{key:'foreign',label:'Fremder Stoff',minutes:30,target:1}]}]}
const moduleHtml=renderToStaticMarkup(React.createElement(load('ModuleStudyPlan').default,{timeline:true,data,module:subject,plan,onChange:noop,onStudy:noop,onExamOpen:noop}))
assert.ok(moduleHtml.includes('Vorlesung 10'),'Full plan is shown, not only seven packages')
assert.ok(moduleHtml.includes('study-learning-timeline')&&moduleHtml.includes('study-plan-axis-now'))
assert.ok(moduleHtml.includes('Eigene Klausur'))
assert.ok(!moduleHtml.includes('Fremde Klausur')&&!moduleHtml.includes('Fremder Stoff'),'Learning timeline isolates the current module')
assert.ok(moduleHtml.includes('Zeitraum ohne Lernpakete zusammengefasst'),'Empty intervals are compressed')
const rows=load('study-plan-timeline').learningTimelineRows(plan,'a',data.assessments,data.semesters[0].start)
assert.equal(rows[0].intensity,0)
assert.equal(rows.at(-1).intensity,2,'Color strengthens toward the exam')
assert.ok(rows.some(row=>row.gap&&row.to))
assert.ok(rows.every(row=>row.exams.every(exam=>exam.moduleId==='a')))
const listPlan={...plan,lessons:[{key:'lesson0',moduleId:'a',label:'Vorlesung 1',occurrence:{date:reference}}]}
const listHtml=renderToStaticMarkup(React.createElement(load('ModuleStudyPlan').default,{timeline:true,data,module:subject,plan:listPlan,onChange:noop,onStudy:noop,onExamOpen:noop}))
assert.ok(listHtml.includes('study-scope-list-row')&&listHtml.includes('Prüfungsstoff')&&listHtml.includes('Mittel'))
assert.ok(!listHtml.includes('type="number"'),'Scope has difficulty choices, not time quotas')
const examHtml=renderToStaticMarkup(React.createElement(load('ExamTimeline').default,{display:'timeline',data,semester:data.semesters[0],module:subject,onOpen:noop,onToggle:noop}))
assert.ok(examHtml.includes('Eigene Klausur')&&examHtml.includes('Fremde Klausur'),'Exam view keeps the comparison')
assert.ok(!examHtml.includes('mlh-exam-cards'),'Checkbox cards are not duplicated in the comparison timeline')
const dashboardHtml=renderToStaticMarkup(React.createElement(load('OverviewDashboard').default,{data,studyPlan:plan,onStudyPlan:noop,onProfile:noop,onStreak:noop,onAddTask:noop,onToggleTask:noop,onDeleteTask:noop,onGoal:noop,onAssessment:noop,onCalendar:noop,onTimerChange:noop,onSession:noop,advice:null,aiEnabled:false,aiWorking:false,aiError:'',aiGeneratedAt:null,aiStale:false}))
assert.ok(dashboardHtml.includes('Dein Lernplan heute')&&dashboardHtml.includes('Vorlesung 1')&&dashboardHtml.includes('Fremder Stoff'),'Today includes all relevant module packages')
assert.ok(!dashboardHtml.includes('Vorlesung 10'),'Future packages do not leak into the dashboard')
const card=dashboardHtml.slice(dashboardHtml.indexOf('overview-next-lesson'),dashboardHtml.indexOf('Nächste Hausaufgabe'))
assert.ok(card.indexOf('Informatik')<card.indexOf('HE 101'))
assert.ok(card.indexOf('HE 101')<card.indexOf('Prof. Muster'),'Room/module precede secondary lecturer info')
assert.ok(card.includes('overview-lesson-secondary'))
console.log('PASS: complete module-only learning timeline, monthly/today markers, own exam, cross-module exam comparison, no duplicate exam cards, dashboard today-only packages and room/module hierarchy')
