const fs = require('fs'), ts = (()=>{try{return require('typescript')}catch{return require('/opt/nvm/versions/node/v22.16.0/lib/node_modules/typescript')}})();
const assert = require('node:assert/strict');
const js=ts.transpileModule(fs.readFileSync(__dirname+'/src/model.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
const obj={exports:{}};new Function('module','exports','require',js)(obj,obj.exports,require);const m=obj.exports;
let checks=0;const check=(a,b,label)=>{assert.deepEqual(a,b,label);checks++};
const make=(id,mod,date,from,to,content,selected=true,recurrence='weekly')=>({id,semesterId:'winter',moduleId:mod,name:mod,category:'Vorlesung',contentId:content,contentLabel:'VL 01',date,endDate:'2027-02-15',from,to,selected,recurrence,overrides:{},room:'MA 041',organizer:id});
const win=make('win','m1','2026-10-05','10:00','12:00','vl1',true);
const nar=make('nar','m1','2026-10-06','10:00','12:00','vl1',false);
const kei=make('kei','m1','2026-10-07','14:00','16:00','vl1',false);
const other=make('other','m2','2026-10-06','10:00','12:00','vl1',true);
let offers=[win,nar,kei,other];
check(m.contentGroups(offers,'m1','winter').length,1,'one content grouping');
check(m.contentGroups(offers,'m1','winter')[0].offerings.map(o=>o.id),['win','nar','kei'],'three stable equivalent groups');
check(m.contentGroups(offers,'m2','winter').length,1,'other module remains separate');
const alt=m.candidateOccurrencesOn(offers,'2026-10-13',true).find(o=>o.offering.id==='nar');
const main=m.findMainForInactive(offers,alt);
check(main.offering.id,'win','prioritizes current selected equivalent group before other module occupying same slot');
check(m.occurrencesOn(offers,'2026-10-13').map(o=>o.offering.id),['other'],'inactive group does not appear as active');
check(m.linkedCandidates(offers,m.occurrenceInWeek(win,'2026-10-12',true)).filter(x=>x.kind==='group').length,2,'two other groups linked');
// A previously independent series can be linked by ID without moving or cloning it.
const old=make('old','m1','2026-10-08','08:00','10:00','old-content',false);
const linked=m.linkOfferingToContent([...offers,old],'old',win);
check(linked.length,5,'linking keeps total number of offerings');
check(linked.find(o=>o.id==='old').contentId,'vl1','relinked group shares topic ID');
check(m.contentGroups(linked,'m1','winter').length,1,'existing standalone group merges into content');
check(m.linkOfferingToContent([...offers,other],'other',win).find(o=>o.id==='other').contentId,'vl1','cross-module link does nothing');
// Same date/time in different teaching category is not linked.
const tut={...old,id:'tut',category:'Tutorium'};
check(m.linkOfferingToContent([...offers,tut],'tut',win).find(o=>o.id==='tut').contentId,'old-content','different category cannot be linked to lecture');
// Select a transparent group when no other event is main: no event is ever copied.
const free=make('free','m3','2026-10-07','17:00','19:00','free-topic',false);
check(m.findMainForInactive([...offers,free],m.occurrenceInWeek(free,'2026-10-12',true)),null,'ghost on free slot has no main');
const single=m.setOfferingAttendance([...offers,free],m.occurrenceInWeek(free,'2026-10-12',true),'single',true);
check(single.length,5,'single visit does not clone series');
check(m.occurrencesOn(single,'2026-10-14').some(x=>x.offering.id==='free'),true,'single visit visible this week');
check(m.occurrencesOn(single,'2026-10-21').some(x=>x.offering.id==='free'),false,'single visit not visible next week');
check(single.find(o=>o.id==='free').overrides['2026-10-14'].scope,'single','single exception marked correctly');
const future=m.setOfferingAttendance([...offers,free],m.occurrenceInWeek(free,'2026-10-12',true),'future',true);
check(future.length,5,'future visit preserves all permanent IDs');
check(m.occurrencesOn(future,'2026-10-14').some(x=>x.offering.id==='free'),true,'future visit active this week');
check(m.occurrencesOn(future,'2026-10-21').some(x=>x.offering.id==='free'),true,'future visit active next week');
check(future.find(o=>o.id==='free').overrides['2026-10-14'].scope,'future','future choice not mislabeled as one-off');
// Switch a same-content topic in conflict with another module; old series still exists.
const changed=m.chooseOffering(offers,m.occurrenceInWeek(win,'2026-10-12',true),alt,'single');
check(changed.length,4,'topic switch keeps four event IDs');
check(changed.find(o=>o.id==='win').overrides['2026-10-12'].scope,'single','one-time switch logged as exception');
check(changed.find(o=>o.id==='nar').overrides['2026-10-13'].selected,true,'other group selected');
check(changed.find(o=>o.id==='other').overrides['2026-10-13'].selected,false,'Tuesday collision hidden but preserved');
check(changed.find(o=>o.id==='other').id,'other','displaced group remains in pool');
// Stress repeated changes and reverted weeks, no new series ever.
let stress=offers;const original=offers.map(o=>o.id).sort();
for(let i=0;i<60;i++){
 const a=m.occurrenceInWeek(stress.find(o=>o.id===i%2?'win':'nar'),'2026-11-02',true);
 const b=m.occurrenceInWeek(stress.find(o=>o.id===i%2?'nar':'win'),'2026-11-02',true);
 stress=m.chooseOffering(stress,a,b,'single');
 check(stress.map(o=>o.id).sort(),original,'60 repeated group switches never clone series');
}
console.log(`✔ ${checks} v0.7 assertions: topics, ghost visits, linking, collision, exceptions, stable IDs`);
