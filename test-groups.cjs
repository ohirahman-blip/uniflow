const fs=require('fs'), ts=(function(){try{return require('typescript')}catch{return require('/opt/nvm/versions/node/v22.16.0/lib/node_modules/typescript')}})(),assert=require('node:assert/strict');
const js=ts.transpileModule(fs.readFileSync(__dirname+'/src/model.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
const m={exports:{}};new Function('module','exports','require',js)(m,m.exports,require);const x=m.exports;
let checks=0;function eq(a,b,msg){assert.deepEqual(a,b,msg);checks++}
const mk=(id,moduleId,day,from,to,contentId,selected=true,recurrence='weekly')=>({id,semesterId:'semester',moduleId,name:moduleId,category:'Vorlesung',date:day,endDate:'2027-02-15',from,to,recurrence,selected,contentId,room:id,organizer:id,overrides:{}});
const winkert=mk('winkert','M1','2026-10-05','10:00','12:00','VL1',true);
const narben=mk('narben','M1','2026-10-06','10:00','12:00','VL1',false);
const keipert=mk('keipert','M1','2026-10-07','08:00','10:00','VL1',false);
const other=mk('M2VL1','M2','2026-10-06','10:00','12:00','VL1',true);
let offers=[winkert,narben,keipert,other];const initialIds=offers.map(o=>o.id).sort();
const candidates=x.linkedCandidates(offers,x.occurrencesOn(offers,'2026-10-05')[0]);
eq(candidates.filter(c=>c.kind==='group').length,2,'all three same content groups found');
eq(x.sameContent(winkert,other),false,'content labels across modules are not equivalent');
eq(x.linkedCandidates(offers,x.occurrencesOn(offers,'2026-10-06')[0]).some(c=>c.kind==='slot'&&c.occ.offering.id==='narben'),true,'Narben both group for M1 and slot alt for M2');
// Switching back and forth must NOT clone a series.
for(let i=0;i<30;i++){
  const week='2026-10-12';
  const sourceId=i%2===0?'winkert':'narben',targetId=i%2===0?'narben':'winkert';
  const source=x.occurrenceInWeek(offers.find(o=>o.id===sourceId),week,true);
  const target=x.occurrenceInWeek(offers.find(o=>o.id===targetId),week,true);
  offers=x.chooseOffering(offers,source,target,'future');
  eq(offers.map(o=>o.id).sort(),initialIds,'same permanent group IDs');
  eq(offers.length,4,'no extra rows after reverse switch');
  const selectedGroup=offers.flatMap(o=>['2026-10-12','2026-10-13'].flatMap(d=>x.occurrencesOn([o],d))).filter(o=>o.offering.moduleId==='M1');
  eq(selectedGroup.length,1,'exactly one selected M1 group after replacement');
  const concurrent=offers.flatMap(o=>x.occurrencesOn([o],'2026-10-13'));
  eq(new Set(concurrent.map(o=>o.key)).size,concurrent.length,'no repeated occurrence keys');
}
// Both visits, neither group hidden. Tuesday competitor is kept when requested.
offers=[winkert,narben,keipert,other];
const mo=x.occurrenceInWeek(offers.find(o=>o.id==='winkert'),'2026-10-19',true),tu=x.occurrenceInWeek(offers.find(o=>o.id==='narben'),'2026-10-19',true);
offers=x.chooseOffering(offers,mo,tu,'single',true);
eq(x.occurrencesOn(offers,'2026-10-19').some(o=>o.offering.id==='winkert'),true,'both keeps original group');
eq(x.occurrencesOn(offers,'2026-10-20').some(o=>o.offering.id==='narben'),true,'both adds chosen group');
eq(x.occurrencesOn(offers,'2026-10-20').some(o=>o.offering.id==='M2VL1'),true,'both keeps parallel other-module class');
eq(x.occurrencesOn(offers,'2026-10-27').some(o=>o.offering.id==='narben'),false,'single choice does not alter next week');
// Moving a future series repeatedly never makes a clone.
const one=[winkert];const first=x.moveOccurrence(one,'winkert','2026-10-12','2026-10-15','14:00','16:00','future');
eq(first.length,1,'future move does not split into cloned offerings');
eq(x.occurrencesOn(first,'2026-10-15')[0].from,'14:00','future move changes date and time');
eq(x.occurrencesOn(first,'2026-10-05').length,1,'past stays fixed');
const second=x.moveOccurrence(first,'winkert','2026-10-19','2026-10-21','08:00','10:00','future');
eq(second.length,1,'second future move stays same offering');
eq(x.occurrencesOn(second,'2026-10-15').length,1,'previous interval remains');
eq(x.occurrencesOn(second,'2026-10-21').length,1,'second interval moves');
eq(x.occurrencesOn(second,'2026-10-22').length,0,'old shift not duplicated');
// Recurrence mismatch leaves source active in unavailable weeks.
const fortnight=mk('bi','M1','2026-10-06','10:00','12:00','VL1',false,'biweekly');
const changed=x.chooseOffering([winkert,fortnight],x.occurrenceInWeek(winkert,'2026-10-05',true),x.occurrenceInWeek(fortnight,'2026-10-05',true),'future');
eq(x.occurrencesOn(changed,'2026-10-05').length,0,'initial week switched');
eq(x.occurrencesOn(changed,'2026-10-12').length,1,'non-repeating gap stays available');
console.log(`✔ ${checks} assertions: fixed group IDs, 30 back/forth switches, both visits, module clash, single/future, repeated drags`)
