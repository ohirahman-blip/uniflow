const assert=require('node:assert/strict');
const fs=require('node:fs');
let ts;try{ts=require('typescript')}catch{ts=require('/opt/nvm/versions/node/v22.16.0/lib/node_modules/typescript')}
const src=fs.readFileSync('src/model.ts','utf8');
const app=fs.readFileSync('src/App.tsx','utf8');
const transpiled=ts.transpileModule(src,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS},reportDiagnostics:true});
const jsx=ts.transpileModule(app,{compilerOptions:{jsx:ts.JsxEmit.ReactJSX,module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022},reportDiagnostics:true});
for (const [name,result] of [['model',transpiled],['App',jsx]]){
  const problems=(result.diagnostics||[]).filter(x=>x.category===ts.DiagnosticCategory.Error)
  assert.equal(problems.length,0,`${name} TS parse: ${problems.map(d=>d.messageText).join('; ')}`)
}
const m={exports:{}};new Function('module','exports','require',transpiled.outputText)(m,m.exports,require);
const mod=m.exports;
const {emptyData,separateAssessments}=mod;
const d='2026-10-12';
const base={id:'old-hw',semesterId:'s',moduleId:'m',name:'Mathe',category:'Hausaufgabe',date:d,endDate:d,from:'18:00',to:'18:30',recurrence:'once',overrides:{},room:'',selected:true};
let norm=separateAssessments({...emptyData,offerings:[base]});
assert.equal(norm.offerings.length,0);
assert.equal(norm.assessments.length,1);
assert.equal(norm.assessments[0].type,'homework');
assert.equal(norm.assessments[0].date,d);
assert.equal(norm.assessments[0].from,undefined);
assert.deepEqual(separateAssessments(norm),norm);
const recurring={...base,id:'old-exam',category:'Klausur',name:'Physik',date:'2026-10-12',endDate:'2026-10-26',recurrence:'weekly',overrides:{'2026-10-19':{cancelled:true}}};
norm=separateAssessments({...emptyData,offerings:[recurring,base],assessments:[{id:'user',semesterId:'s',moduleId:'m',type:'exam',title:'Echt',date:d}]});
assert.equal(norm.assessments.length,4); // 2 exams + 1 homework + 1 existing
assert.equal(norm.assessments.filter(x=>x.type==='exam').length,3);
assert.ok(norm.assessments.some(x=>x.date==='2026-10-26'&&x.type==='exam'));
assert.ok(!norm.assessments.some(x=>x.date==='2026-10-19'&&x.type==='exam'));
assert.ok(app.includes('onPreviewAssessment={item=>setPreviewAssessmentId(item.id)}'),'Calendar must open deadline preview first');
assert.ok(app.includes('onEdit={()=>{setEditingAssessment(previewAssessment);setPreviewAssessmentId(null)}}'),'Preview Edit must open existing editor');
assert.ok(app.includes('onToggle={()=>mutate(d=>({...d,assessments:d.assessments.map(item=>'),'Completion checkbox saves through existing cloud mutation');
assert.ok(app.includes('onDelete={()=>{setDeletingAssessment(editingAssessment)'));
assert.ok(app.includes('onDelete={()=>{setDeleteProposal({occ:editingOffering'));
assert.ok(app.includes('onClick={()=>onNew({date,from,to})}'));
assert.ok(app.includes('walletRef'));
assert.ok(!app.includes('className="wallet-tip"'));
assert.ok(!app.includes('className="calendar-edge-hint"'));
console.log('✔ v0.8: type/JSX parse, separate assessment storage, one-time/recurring legacy migration, idempotence, dates, preservation, editing/deletion wiring, Wallet + single-tap');
