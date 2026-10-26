const assert=require('node:assert/strict')
const fs=require('node:fs')
const path=require('node:path')
const ts=require('typescript')
const loaded=new Map()
function load(filename){
  const absolute=path.resolve(filename)
  if(loaded.has(absolute))return loaded.get(absolute)
  const compiled=ts.transpileModule(fs.readFileSync(absolute,'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2020,module:ts.ModuleKind.CommonJS},reportDiagnostics:true})
  assert.equal((compiled.diagnostics||[]).filter(item=>item.category===ts.DiagnosticCategory.Error).length,0,filename+' parses')
  const module={exports:{}};loaded.set(absolute,module.exports)
  new Function('module','exports','require',compiled.outputText)(module,module.exports,name=>name.startsWith('.')?load(path.resolve(path.dirname(absolute),name.endsWith('.ts')?name:name+'.ts')):require(name))
  return module.exports
}
const policy=load('src/ai-request-schedule.ts')
const start=Date.parse('2026-10-26T08:00:00Z')
const cached={signature:'a',generatedAt:new Date(start).toISOString()}
assert.equal(policy.shouldRefreshAdvice(null,'a',start),true)
assert.equal(policy.shouldRefreshAdvice(cached,'b',start+29*60*1000),false,'Changed context waits 30 minutes')
assert.equal(policy.shouldRefreshAdvice(cached,'b',start+30*60*1000),true)
assert.equal(policy.shouldRefreshAdvice(cached,'a',start+4*60*60*1000-1),false,'Unchanged context waits 4 hours')
assert.equal(policy.shouldRefreshAdvice(cached,'a',start+4*60*60*1000),true)
assert.equal(policy.shouldRefreshAdvice({...cached,retryAt:new Date(start+10*60*60*1000).toISOString()},'b',start+5*60*60*1000),false,'Backoff is independent of cache freshness')
assert.equal(policy.shouldRefreshAdvice({...cached,generatedAt:new Date(start+10000).toISOString()},'b',start),false,'Clock skew does not trigger a storm')
const context={today:'2026-10-26',localTime:'09:00',timeZone:'Europe/Berlin',progressRevision:'first',freeMinutes:90,nextLecture:{moduleId:'m',moduleName:'Mathe',topic:'Vorlesung',lessonKey:'k',date:'2026-10-26',time:'11:00',minutesUntil:120},previousWeak:null,pendingFeedback:null,otherWeak:[],exams:[]}
const signature=policy.aiAdviceSignature(context)
assert.equal(signature,policy.aiAdviceSignature({...context,localTime:'09:01',freeMinutes:89,nextLecture:{...context.nextLecture,minutesUntil:119}}),'Ordinary clock ticks reuse advice')
assert.notEqual(signature,policy.aiAdviceSignature({...context,progressRevision:'second'}),'A study edit invalidates the context')
const model=load('src/model.ts'),advice=load('src/study-advice.ts')
const moduleA={id:'m',degreeId:'d',name:'Mathe',shortName:'M',credits:6,color:'#fff',status:'current',grade:'',counted:true,hidden:false,semesterIds:['s']}
const semester={id:'s',degreeId:'d',name:'WS',start:'2026-10-01',end:'2027-03-31',lectureEnd:'2027-02-01',archived:false}
const data={...model.emptyData,modules:[moduleA]}
const revision=advice.adviceContext(data,semester,[moduleA],new Date(start)).progressRevision
assert.equal(revision,advice.adviceContext({...data,profile:'New name',theme:'light',lastUpdate:start+99},semester,[moduleA],new Date(start)).progressRevision,'Cosmetic edits do not trigger generation')
assert.notEqual(revision,advice.adviceContext({...data,learningSessions:[{id:'session',moduleId:'m',date:'2026-10-26',kind:'review',duration:30,rating:'understood',updatedAt:'2026-10-26T08:30:00Z'}]},semester,[moduleA],new Date(start)).progressRevision)
const hook=fs.readFileSync('src/usePremiumAdvice.ts','utf8'),app=fs.readFileSync('src/App.tsx','utf8')
assert.doesNotMatch(hook,/setInterval|recordAiDailyAttempt|AI_DAILY_LIMIT|sessionStorage\.removeItem/)
assert.match(app,/page==='overview'&&!profileOpen\)/,'Only visible Dashboard activates advice work')
assert.match(hook,/from\('uniflow_ai_advice_cache'\)/,'Read the shared cache before model work')
assert.match(hook,/localStorage\.setItem\(cacheKey/,'Reloads retain the last successful advice')
const sql=fs.readFileSync('supabase/migrations/20261027_uniflow_ai_cache.sql','utf8')
assert.match(sql,/for update/,'Concurrent devices lock the same cache row')
assert.match(sql,/lease_token=p_lease/,'Late generations cannot overwrite a newer reservation')
assert.match(sql,/interval '30 minutes'/);assert.match(sql,/interval '4 hours'/);assert.match(sql,/interval '15 seconds'/)
assert.doesNotMatch(sql,/request_count < 25|delete from/i)
assert.match(sql,/from public,anon,authenticated/,'Reservation functions are not callable by browser roles')
assert.match(sql,/user_id=\(select auth\.uid\(\)\)/,'Cache reads are scoped to the owner')
for(const filename of ['supabase/functions/uniflow-ai-advice/index.ts','supabase/functions/uniflow-ai-schedule/index.ts']){
  const source=fs.readFileSync(filename,'utf8')
  assert.match(source,/auth\.getUser\(token\)/);assert.match(source,/select\('premium'\)/)
  assert.doesNotMatch(source,/rpc\('uniflow_consume_ai_quota'\)/)
  assert.equal((ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext},reportDiagnostics:true}).diagnostics||[]).filter(item=>item.category===ts.DiagnosticCategory.Error).length,0,'Edge syntax')
}
console.log('AI cache policy: 30m/4h refresh, retry cooldown, learning revisions, shared cache and server-only leases passed; no API calls.')
