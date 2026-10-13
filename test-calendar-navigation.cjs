const assert = require('node:assert/strict')
const fs = require('node:fs')
const ts = require('typescript')

const compile = path => ts.transpileModule(fs.readFileSync(path,'utf8'),{
  compilerOptions:{target:ts.ScriptTarget.ES2020,module:ts.ModuleKind.CommonJS},
  reportDiagnostics:true
}).outputText
const model = {exports:{}}
new Function('module','exports','require',compile('src/model.ts'))(model,model.exports,require)
const nav = {exports:{}}
new Function('module','exports','require',compile('src/calendar-navigation.ts'))(
  nav,nav.exports,id=>id==='./model'?model.exports:require(id)
)
const {weekHeaderDates,weekdayIndex,twoDayStarts,alignCalendarStart,adjacentCalendarPage,datesForCalendarPage}=nav.exports
const {weekStart,addDays}=model.exports
const monday='2026-10-12'

for(const cutoff of [4,5,6]){
  const header=weekHeaderDates(monday,cutoff)
  assert.equal(header.length,cutoff+1,'Header uses configured weekday count')
  assert.equal(header[header.length-1],addDays(monday,cutoff))
  const starts=twoDayStarts(cutoff)
  assert.equal(starts[0],0)
  assert.equal(starts[starts.length-1],cutoff-1)
  for(let i=0;i<=cutoff;i++){
    const date=addDays(monday,i)
    assert.deepEqual(Array.from(datesForCalendarPage(date,'week',cutoff)),Array.from(header))
    assert.deepEqual(Array.from(datesForCalendarPage(date,'day',cutoff)),[date])
    const days=datesForCalendarPage(date,'two',cutoff)
    assert.equal(days.length,2)
    assert.equal(weekStart(days[0]),monday,'Two-day view must stay within one week')
    assert.equal(weekStart(days[1]),monday,'Second day must stay within the week')
    assert.ok(days.includes(date),'Tapped day must appear in the two-day window')
    assert.ok(weekdayIndex(days[1])<=cutoff,'Two-day view cannot display a hidden weekend day')
  }
  for(const mode of ['day','two','week']){
    let date=alignCalendarStart(monday,mode,cutoff)
    const pages=mode==='day'?cutoff+1:mode==='week'?1:starts.length
    for(let i=0;i<pages+2;i++){
      const next=adjacentCalendarPage(date,mode,1,cutoff)
      assert.notEqual(next,date,'Navigation must advance')
      assert.equal(adjacentCalendarPage(next,mode,-1,cutoff),date,'Back arrow must reverse forward navigation')
      const days=datesForCalendarPage(next,mode,cutoff)
      assert.ok(days.every(d=>weekdayIndex(d)<=cutoff),'No hidden weekend days should appear')
      date=next
    }
  }
  const weekend=addDays(monday,6)
  if(cutoff<6){
    assert.equal(alignCalendarStart(weekend,'day',cutoff),addDays(monday,7),'Hidden Sunday should lead to next Monday')
  }
}
assert.equal(adjacentCalendarPage('2026-10-16','day',1,4),'2026-10-19','Friday -> Monday when cutoff Friday')
assert.equal(adjacentCalendarPage('2026-10-16','day',1,5),'2026-10-17','Friday -> Saturday when cutoff Saturday')
assert.equal(adjacentCalendarPage('2026-10-17','day',1,5),'2026-10-19','Saturday -> Monday when cutoff Saturday')
assert.deepEqual(Array.from(datesForCalendarPage('2026-10-16','two',4)),['2026-10-15','2026-10-16'])
assert.deepEqual(Array.from(datesForCalendarPage('2026-10-17','two',5)),['2026-10-16','2026-10-17'])
for (const cutoff of [4,5,6]) {
  assert.deepEqual(Array.from(datesForCalendarPage('2026-10-12','two',cutoff)),['2026-10-12','2026-10-13'])
  assert.equal(adjacentCalendarPage('2026-10-12','two',1,cutoff),'2026-10-13','Two-day swipe advances one day')
  assert.equal(adjacentCalendarPage('2026-10-13','two',-1,cutoff),'2026-10-12','Two-day swipe returns one day')
  assert.deepEqual(Array.from(datesForCalendarPage('2026-10-13','two',cutoff)),['2026-10-13','2026-10-14'])
}
console.log('✔ calendar week cutoff: one-day sliding two-day windows, weekend skips, reversible navigation')
