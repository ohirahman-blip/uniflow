const fs=require('fs');
const ts=(()=>{try{return require('typescript')}catch{return require('/opt/nvm/versions/node/v22.16.0/lib/node_modules/typescript')}})();
const assert=require('node:assert/strict');
const compiled=ts.transpileModule(fs.readFileSync(__dirname+'/src/model.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
const runtime={exports:{}};new Function('module','exports','require',compiled)(runtime,runtime.exports,require);
const m=runtime.exports;
let tests=0;function check(actual,expected,msg){assert.deepEqual(actual,expected,msg);tests++}
const make=(id,moduleId,date,selected,content='vl1')=>({id,semesterId:'winter',moduleId,name:moduleId,category:'Vorlesung',date,endDate:'2027-02-15',from:'10:00',to:'12:00',recurrence:'weekly',selected,contentId:content,contentLabel:'VL 01',room:'MA 041',organizer:id,overrides:{}})
const win=make('winkert','analysis','2026-10-05',true),nar=make('narben','analysis','2026-10-06',false),other=make('other','programmieren','2026-10-06',true);
const base=[win,nar,other];
const w=m.occurrenceInWeek(win,'2026-10-12',true),n=m.occurrenceInWeek(nar,'2026-10-12',true);
let switched=m.chooseOffering(base,w,n,'single',false);
check(switched.length,3,'single swap keeps all 3 series');
check(switched.find(o=>o.id==='winkert').overrides['2026-10-12'].changeId,switched.find(o=>o.id==='narben').overrides['2026-10-13'].changeId,'one switch is linked across dates');
check(switched.find(o=>o.id==='other').overrides['2026-10-13'].changeId,switched.find(o=>o.id==='winkert').overrides['2026-10-12'].changeId,'conflict has same change ID');
check(m.occurrencesOn(switched,'2026-10-13').map(o=>o.offering.id),['narben'],'temporary new group active on target date');
let restored=m.undoSingleChoice(switched,m.occurrenceInWeek(switched.find(o=>o.id==='narben'),'2026-10-12',true));
check(restored.length,3,'undo never adds or deletes offering');
check(m.occurrencesOn(restored,'2026-10-12').map(o=>o.offering.id),['winkert'],'undo brings original Monday group back');
check(m.occurrencesOn(restored,'2026-10-13').map(o=>o.offering.id),['other'],'undo restores other Tuesday module');
check(Object.values(restored).every(o=>Object.values(o.overrides).length===0),true,'undo removes linked one-time exceptions');
const paused=m.suspendOffering(base,w,'single');
check(paused.length,3,'suspension does not create a new alternative');
check(m.occurrencesOn(paused,'2026-10-12').some(o=>o.offering.id==='winkert'),false,'suspended class is not active');
check(m.candidateOccurrencesOn(paused,'2026-10-12',true).some(o=>o.offering.id==='winkert'),true,'suspended class stays visible as inactive');
check(m.occurrencesOn(paused,'2026-10-19').some(o=>o.offering.id==='winkert'),true,'single pause does not affect following week');
restored=m.undoSingleChoice(paused,m.occurrenceInWeek(paused.find(o=>o.id==='winkert'),'2026-10-12',true));
check(m.occurrencesOn(restored,'2026-10-12').some(o=>o.offering.id==='winkert'),true,'undo restores suspended attendance');
const future=m.suspendOffering(base,w,'future');
check(m.occurrencesOn(future,'2026-10-12').some(o=>o.offering.id==='winkert'),false,'future pause begins at selected date');
check(m.occurrencesOn(future,'2026-10-19').some(o=>o.offering.id==='winkert'),false,'future pause repeats');
check(m.occurrencesOn(future,'2026-10-05').some(o=>o.offering.id==='winkert'),true,'future pause leaves past active');
const moved=m.moveOccurrence(base,'winkert','2026-10-12','2026-10-15','14:00','16:00','single');
check(moved.length,3,'moving once does not clone offering');
check(m.occurrencesOn(moved,'2026-10-15').some(o=>o.offering.id==='winkert'),true,'original moved occurrence present at new time');
check(m.occurrencesOn(moved,'2026-10-12').some(o=>o.offering.id==='winkert'),false,'original time no duplicate');
const moveOcc=m.occurrenceAtOrigin(moved[0],'2026-10-12',true);
const suspendedMoved=m.suspendOffering(moved,moveOcc,'single');
const undoPause=m.undoSingleChoice(suspendedMoved,m.occurrenceAtOrigin(suspendedMoved[0],'2026-10-12',true));
check(m.occurrenceAtOrigin(undoPause[0],'2026-10-12',true).date,'2026-10-15','undo pause retains a prior one-off move');
check(m.removeOfferingGroup(switched,'narben').map(o=>o.id),['winkert','other'],'hard deletion removes ONLY selected teaching group');
check(m.contentGroups(m.removeOfferingGroup(switched,'narben'),'analysis','winter')[0].offerings.length,1,'deleted group never reappears in module groups');
let stress=base;
for(let i=0;i<40;i++){
 const a=m.occurrenceInWeek(stress.find(o=>o.id===(i%2?'narben':'winkert')),'2026-11-02',true)
 const b=m.occurrenceInWeek(stress.find(o=>o.id===(i%2?'winkert':'narben')),'2026-11-02',true)
 stress=m.chooseOffering(stress,a,b,'single');
 check(stress.map(o=>o.id).join('|'),'winkert|narben|other','repeat swaps preserve immutable group IDs')
}
console.log(`✔ ${tests} v0.7.1 assertions: suspend, restore, undo grouped selection, move, delete, 40 back/forth switches`)
