const assert=require('node:assert/strict')
const fs=require('node:fs')
const ts=require('typescript')
const compile=(path,jsx=false)=>{
  const result=ts.transpileModule(fs.readFileSync(path,'utf8'),{
    compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020,
      jsx:jsx?ts.JsxEmit.ReactJSX:ts.JsxEmit.None},reportDiagnostics:true
  })
  assert.equal((result.diagnostics||[]).filter(x=>x.category===ts.DiagnosticCategory.Error).length,0,
    path+' should parse')
  return result.outputText
}
const model={exports:{}}
new Function('module','exports','require',compile('src/model.ts'))(model,model.exports,require)
const month={exports:{}}
new Function('module','exports','require',compile('src/calendar-month.ts'))(
  month,month.exports,id=>id==='./model'?model.exports:require(id))
const {calendarMonthDates,shiftCalendarMonth}=month.exports
const october=calendarMonthDates('2026-10-13')
assert.equal(october.length,35)
assert.equal(october[0],'2026-09-28')
assert.equal(october[34],'2026-11-01')
assert.deepEqual(calendarMonthDates('2027-02-19').slice(0,7),
  ['2027-02-01','2027-02-02','2027-02-03','2027-02-04','2027-02-05','2027-02-06','2027-02-07'])
assert.equal(calendarMonthDates('2027-02-19').length,28)
assert.equal(shiftCalendarMonth('2026-01-31',1),'2026-02-28')
assert.equal(shiftCalendarMonth('2028-01-31',1),'2028-02-29')
assert.equal(shiftCalendarMonth('2026-12-13',1),'2027-01-13')
assert.equal(shiftCalendarMonth('2026-03-30',-1),'2026-02-28')
assert.equal(shiftCalendarMonth('2026-10-13',-1),'2026-09-13')
assert.equal(shiftCalendarMonth(shiftCalendarMonth('2026-10-13',1),-1),'2026-10-13')
compile('src/CalendarMonthOverview.tsx',true)
compile('src/MailPrototype.tsx',true)
compile('src/App.tsx',true)
const app=fs.readFileSync('src/App.tsx','utf8')
const strip=fs.readFileSync('src/calendar-week-strip.css','utf8')
const calendar=fs.readFileSync('src/CalendarMonthOverview.tsx','utf8')
const mail=fs.readFileSync('src/MailPrototype.tsx','utf8')
const ui=fs.readFileSync('src/ui-polish.css','utf8')
assert.match(app,/setAnchor\(current=>addDays\(current,direction\*7\)\)/,'Week strip changes anchor by seven days')
assert.match(app,/onPointerDown=\{onWeekDown\} onPointerUp=\{onWeekUp\}/,'Week accepts touch gestures')
assert.match(app,/onWheel=\{onWeekWheel\}/,'Week accepts horizontal trackpad scrolling')
assert.match(app,/onClickCapture=\{e=>\{if\(Date\.now\(\)<suppressWeekTap\.current\)/,'Swipe cannot accidentally select a day')
assert.match(app,/monthOpen\?<CalendarMonthOverview/,'Month view replaces rather than overlays timetable')
assert.match(app,/onSelectDate=\{date=>\{setAnchor\(date\);setMode\('day'\);setMonthOpen\(false\)\}\}/,'Selecting a month date drills into synced timetable')
assert.match(app,/if\(monthOpen\)\{\s*setAnchor\(current=>shiftCalendarMonth/,'Toolbar arrows navigate displayed month')
assert.match(app,/className="uf-week-strip-month" onClick=\{\(\)=>setMonthOpen\(true\)\}/,'Month label opens month overview')
assert.match(strip,/\.uf-week-strip-viewport\{touch-action:pan-y/,'Vertical page scrolling remains possible')
assert.match(calendar,/if\(item\.semesterId!==semesterId\)continue/,'Month uses only active semester')
assert.match(calendar,/byDate\.get\(date\)/,'Month shows actual assessment dates')
assert.doesNotMatch(calendar,/offerings|occurrencesOn|renderDay/,'Month contains no teaching timetable')
assert.match(app,/\{page === 'mail' && <MailPrototype\/>\}/,'Mail is its own page')
assert.match(app,/id: 'mail', name: 'Mail', icon: Mail/,'Mail is a bottom navigation destination')
assert.match(ui,/repeat\(5,minmax\(0,1fr\)\)/,'All five mobile tabs fit')
assert.match(mail,/Schreibe etwas/,'Chat composer provided')
assert.match(mail,/onClick=\{showSubject\}/,'Send opens subject prompt, does not actually send')
assert.match(mail,/className="mail-disabled-send" disabled/,'Final send action is disabled')
assert.match(mail,/setNames\(prev=>/,'Per-sender display name can be renamed')
assert.match(mail,/type="file" multiple/,'Attachments can be selected for local draft')
assert.doesNotMatch(mail,/supabase|fetch\(|\.send\(|IMAPClient|nodemailer/,'Prototype has no mail transport')
console.log('✔ Month navigation, assessment-only view, synced week gestures and safe Mail UI')
