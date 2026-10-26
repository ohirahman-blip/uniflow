// Execute the real handlers with fake Supabase/provider clients. No network.
const assert=require('node:assert/strict')
const fs=require('node:fs')
const ts=require('typescript')
const crypto=require('node:crypto')
function compile(filename){return ts.transpileModule(fs.readFileSync(filename,'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText}
const policy={exports:{}}
new Function('module','exports',compile('supabase/functions/_shared/advice-policy.ts'))(policy,policy.exports)
const context={today:'2026-10-26',localTime:'12:00',timeZone:'Europe/Berlin',progressRevision:'r1',freeMinutes:90,nextLecture:{moduleId:'m',moduleName:'Mathe',topic:'VL',lessonKey:'lesson',date:'2026-10-26',time:'14:00',minutesUntil:120},previousWeak:null,pendingFeedback:null,otherWeak:[],exams:[]}
const recommendation={title:'Wiederholen',message:'Schau dir deine Notizen an.',kind:'prepare',minutes:15,moduleId:'m',lessonKey:'lesson'}
async function scenario(name,options={}){
  const calls=[],providerCalls=[]
  let handler
  const env={SUPABASE_URL:'https://test.invalid',SUPABASE_ANON_KEY:'fake-public',SUPABASE_SERVICE_ROLE_KEY:'fake-server-only',DEEPSEEK_API_KEY:'fake-provider'}
  const createClient=(_url,key)=>({
    auth:{getUser:async()=>({data:{user:options.auth===false?null:{id:'verified-user'}},error:null})},
    from:table=>{const chain={select:()=>chain,eq:()=>chain,maybeSingle:async()=>({data:table==='account_directory'?{premium:options.premium!==false}:null,error:null}),single:async()=>({data:{generated_at:'2026-10-26T12:00:00Z'},error:null})};return chain},
    rpc:async(name,args)=>{
      assert.equal(key,'fake-server-only','Reservations never use the browser client')
      assert.equal(args.p_user_id,'verified-user','Never trust a user ID from the body')
      calls.push({name,args})
      if(name==='uniflow_acquire_ai_schedule')return {data:options.scheduleAllowed!==false,error:null}
      if(name==='uniflow_acquire_ai_advice')return {data:options.reservation||{status:'generate'},error:null}
      if(name==='uniflow_finish_ai_advice')return {data:true,error:null}
      throw new Error('Unexpected RPC: '+name)
    }
  })
  const provider=async(url,init)=>{
    assert.equal(url,'https://api.deepseek.com/chat/completions')
    providerCalls.push(JSON.parse(init.body))
    return options.providerFailure?new Response('upstream unavailable',{status:500}):Response.json({choices:[{message:{content:JSON.stringify(recommendation)}}]})
  }
  new Function('require','module','exports','Deno','fetch','crypto',compile('supabase/functions/'+name+'/index.ts'))(dependency=>dependency.startsWith('npm:')?{createClient}:policy.exports,{exports:{}},{},{env:{get:key=>env[key]},serve:callback=>{handler=callback}},provider,crypto)
  const body=name==='uniflow-ai-advice'?{context,userId:'forged-other-user'}:{text:'Montag von 10 bis 12 Uhr',moduleName:'Mathe',userId:'forged-other-user'}
  const response=await handler(new Request('https://test.invalid/functions/'+name,{method:'POST',headers:{authorization:'Bearer fake-jwt',origin:'http://localhost:5173','content-type':'application/json'},body:JSON.stringify(body)}))
  return {status:response.status,payload:await response.json(),calls,providerCalls}
}
;(async()=>{
  for(const name of ['uniflow-ai-advice','uniflow-ai-schedule']){
    const denied=await scenario(name,{auth:false});assert.equal(denied.status,401);assert.equal(denied.calls.length,0);assert.equal(denied.providerCalls.length,0)
    const free=await scenario(name,{premium:false});assert.equal(free.status,403);assert.equal(free.providerCalls.length,0)
  }
  const cached=await scenario('uniflow-ai-advice',{reservation:{status:'cached',recommendation,signature:'saved',generatedAt:'2026-10-26T10:00:00Z'}})
  assert.equal(cached.status,200);assert.equal(cached.payload.cached,true);assert.equal(cached.providerCalls.length,0,'A cache hit never calls the model')
  const pending=await scenario('uniflow-ai-advice',{reservation:{status:'pending',recommendation,generatedAt:'2026-10-26T10:00:00Z',retryAt:'2026-10-26T12:05:00Z'}})
  assert.equal(pending.status,200);assert.equal(pending.providerCalls.length,0,'A second device reuses the in-flight reservation')
  const fresh=await scenario('uniflow-ai-advice')
  assert.equal(fresh.status,200);assert.equal(fresh.providerCalls.length,1);assert.equal(fresh.payload.generatedAt,'2026-10-26T12:00:00Z')
  const saved=fresh.calls.find(call=>call.name==='uniflow_finish_ai_advice')
  assert.equal(saved.args.p_recommendation.title,recommendation.title)
  assert.ok(saved.args.p_lease);assert.ok(saved.args.p_signature)
  const failure=await scenario('uniflow-ai-advice',{providerFailure:true})
  assert.equal(failure.status,502)
  assert.equal(failure.calls.find(call=>call.name==='uniflow_finish_ai_advice').args.p_recommendation,null,'Failure releases/backoffs without replacing cached advice')
  const throttle=await scenario('uniflow-ai-schedule',{scheduleAllowed:false})
  assert.equal(throttle.status,429);assert.equal(throttle.payload.error,'SCHEDULE_RATE_LIMIT');assert.equal(throttle.payload.retryAfterSeconds,15);assert.equal(throttle.providerCalls.length,0)
  console.log('Real AI handlers with mocked clients: auth/premium, cached/pending zero-model paths, verified ownership, successful persistence and failure release passed; no API calls.')
})().catch(error=>{console.error(error);process.exitCode=1})
