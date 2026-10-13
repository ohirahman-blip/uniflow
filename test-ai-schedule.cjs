const assert=require('node:assert/strict')
const fs=require('node:fs')
const ts=require('typescript')
const source=fs.readFileSync('src/ai-schedule.ts','utf8')
const transpiled=ts.transpileModule(source,{
  compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS},
  reportDiagnostics:true
})
assert.equal((transpiled.diagnostics||[]).filter(d=>d.category===ts.DiagnosticCategory.Error).length,0)
const mod={exports:{}}
new Function('module','exports',transpiled.outputText)(mod,mod.exports)
const {parseAiSchedulePreview}=mod.exports
const input={preview:{topics:[
  {label:'VL 01',category:'Vorlesung',slots:[
    {day:0,from:'08:00',duration:120,room:'MA 041'},
    {day:2,from:'10:30',duration:90,room:'MA 043'}]},
  {label:'Ü 01',category:'Übung',slots:[
    {day:4,from:'14:00',duration:120,room:''}]}
],errors:[]}}
const output=parseAiSchedulePreview(input)
assert.equal(output.topics.length,2)
assert.equal(output.topics[0].slots.length,2,'Explicit options kept together')
assert.equal(output.topics[1].category,'Übung')
assert.equal(output.topics[0].slots[1].from,'10:30')
for(const invalid of [
  {day:7,from:'08:00',duration:120,room:''},
  {day:0,from:'25:00',duration:120,room:''},
  {day:0,from:'23:00',duration:120,room:''},
  {day:0,from:'08:00',duration:0,room:''},
  {day:0,from:'08:00',duration:120,room:17},
]){
 const x=JSON.parse(JSON.stringify(input))
 x.preview.topics[0].slots[0]=invalid
 assert.throws(()=>parseAiSchedulePreview(x),'Invalid AI output cannot be imported')
}
const forbidden=JSON.parse(JSON.stringify(input))
forbidden.preview.topics[0].category='System Admin'
assert.throws(()=>parseAiSchedulePreview(forbidden),'Model cannot create arbitrary categories')
assert.throws(()=>parseAiSchedulePreview({preview:{topics:[],errors:[]}}))
const editor=fs.readFileSync('src/ModuleScheduleEditor.tsx','utf8')
const edge=fs.readFileSync('supabase/functions/uniflow-ai-schedule/index.ts','utf8')
const adviceEdge=fs.readFileSync('supabase/functions/uniflow-ai-advice/index.ts','utf8')
const docs=fs.readFileSync('docs/DEEPSEEK_SETUP.md','utf8')
const errorsModule=ts.transpileModule(fs.readFileSync('src/ai-errors.ts','utf8'),{
 compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS},reportDiagnostics:true
})
assert.equal((errorsModule.diagnostics||[]).filter(d=>d.category===ts.DiagnosticCategory.Error).length,0)
const errorsExports={exports:{}}
new Function('module','exports',errorsModule.outputText)(errorsExports,errorsExports.exports)
const errorFn=errorsExports.exports
assert.match(errorFn.aiFailureText('MODEL_INVALID',502,400),/DEEPSEEK_MODEL/)
assert.match(errorFn.aiFailureText('PREMIUM_REQUIRED',403),/uniflow\+/)
assert.match(errorFn.aiFailureText('MODEL_RATE_LIMIT',502,429),/429/)
Promise.all([
 errorFn.describeAiRequestError({name:'FunctionsFetchError',message:'Failed to send a request to the Edge Function'},'uniflow-ai-schedule')
   .then(message=>assert.match(message,/CORS-Fehler/)),
 errorFn.describeAiRequestError({context:new Response(JSON.stringify({error:'MODEL_INVALID',upstreamStatus:400}),{
   status:502,headers:{'content-type':'application/json'}})},'uniflow-ai-schedule')
   .then(message=>assert.match(message,/DEEPSEEK_MODEL/))
]).catch(error=>{console.error(error);process.exitCode=1})
for(const [name,value] of [['editor',editor],['edge',edge]]){
 const parsed=ts.transpileModule(value,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext,
   jsx:ts.JsxEmit.ReactJSX},reportDiagnostics:true})
 assert.equal((parsed.diagnostics||[]).filter(d=>d.category===ts.DiagnosticCategory.Error).length,0,name+' parse')
}
assert.match(editor,/functions\.invoke\('uniflow-ai-schedule'/,'Real server-side AI invoked')
assert.match(editor,/parseAiSchedulePreview\(data\)/,'Server response validated')
assert.match(editor,/parseAiSchedulePreview\(preview\)/,'Editable response validated again before saving')
assert.match(editor,/setQuickError\(/,'Errors shown rather than silently falling back')
assert.match(editor,/describeAiRequestError\(error,'uniflow-ai-schedule'\)/,'Supabase failures translated to actionable hints')
assert.doesNotMatch(editor,/module-fast-ai-disclosure/,'No explanatory text below AI input')
assert.match(edge,/model:Deno\.env\.get\('DEEPSEEK_MODEL'\)\?\.trim\(\)\|\|'deepseek-v4-flash'/,'Current model for extraction')
assert.match(edge,/MODEL_AUTH_ERROR|MODEL_RATE_LIMIT|MODEL_PAYMENT_REQUIRED/,'HTTP provider failures are classified')
assert.match(adviceEdge,/MODEL_AUTH_ERROR|MODEL_RATE_LIMIT|MODEL_PAYMENT_REQUIRED/,'Both edge functions expose precise codes')
assert.match(editor,/module-fast-ai-slot/,'User can correct proposed schedule')
assert.match(editor,/<textarea ref=\{quickInputRef\} rows=\{1\}/,'Quick input starts at one line')
assert.match(editor,/useLayoutEffect\(\(\)=>\{resizeQuickInput\(\)\},\[quickText\]\)/,'Quick input grows when its value changes')
assert.match(editor,/field\.scrollHeight/,'Quick input measures its natural content height')
assert.match(editor,/onToggle=\{e=>\{if\(e\.currentTarget\.open\)requestAnimationFrame\(resizeQuickInput\)\}\}/,'Textarea remeasured when disclosure opens')
const scheduleCss=fs.readFileSync('src/module-schedule.css','utf8')
assert.match(scheduleCss,/\.module-fast-quick textarea \{[^\n]*resize:none;[^\n]*overflow-y:hidden;/,'No manual resize handle')
assert.match(scheduleCss,/\.module-fast \.module-fast-quick textarea\{[^\n]*border-radius:16px;[^\n]*min-height:44px\}/,'Rounded single-line input')

assert.doesNotMatch(editor,/previewTimer\.current=setTimeout/,'No fake AI delay')
assert.match(edge,/new Response\(null,\{status:204,headers:headers\(req\)\}\)/,'Schedule preflight must have no body')
assert.match(adviceEdge,/new Response\(null,\{status:204,headers:cors\(req\)\}\)/,'Advice preflight must have no body')
assert.match(edge,/auth\.getUser\(token\)/)
assert.match(edge,/select\('premium'\)/)
assert.match(edge,/rpc\('uniflow_consume_ai_quota'\)/)
assert.match(edge,/Deno\.env\.get\('DEEPSEEK_API_KEY'\)/)
assert.match(edge,/https:\/\/api\.deepseek\.com\/chat\/completions/)
assert.match(edge,/response_format:\{type:'json_object'\}/)
assert.doesNotMatch(editor,/DEEPSEEK_API_KEY/,'No secret in browser code')
assert.match(docs,/supabase functions deploy uniflow-ai-schedule/)
console.log('✔ DeepSeek schedule: secure Edge Function, AI validation, editable preview, no fake analysis')
