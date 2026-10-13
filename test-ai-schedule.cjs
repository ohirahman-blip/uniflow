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
const docs=fs.readFileSync('docs/DEEPSEEK_SETUP.md','utf8')
for(const [name,value] of [['editor',editor],['edge',edge]]){
 const parsed=ts.transpileModule(value,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext,
   jsx:ts.JsxEmit.ReactJSX},reportDiagnostics:true})
 assert.equal((parsed.diagnostics||[]).filter(d=>d.category===ts.DiagnosticCategory.Error).length,0,name+' parse')
}
assert.match(editor,/functions\.invoke\('uniflow-ai-schedule'/,'Real server-side AI invoked')
assert.match(editor,/parseAiSchedulePreview\(data\)/,'Server response validated')
assert.match(editor,/parseAiSchedulePreview\(preview\)/,'Editable response validated again before saving')
assert.match(editor,/setQuickError\(/,'Errors shown rather than silently falling back')
assert.match(editor,/module-fast-ai-slot/,'User can correct proposed schedule')
assert.doesNotMatch(editor,/previewTimer\.current=setTimeout/,'No fake AI delay')
assert.match(edge,/auth\.getUser\(token\)/)
assert.match(edge,/select\('premium'\)/)
assert.match(edge,/rpc\('uniflow_consume_ai_quota'\)/)
assert.match(edge,/Deno\.env\.get\('DEEPSEEK_API_KEY'\)/)
assert.match(edge,/https:\/\/api\.deepseek\.com\/chat\/completions/)
assert.match(edge,/response_format:\{type:'json_object'\}/)
assert.doesNotMatch(editor,/DEEPSEEK_API_KEY/,'No secret in browser code')
assert.match(docs,/supabase functions deploy uniflow-ai-schedule/)
console.log('✔ DeepSeek schedule: secure Edge Function, AI validation, editable preview, no fake analysis')
