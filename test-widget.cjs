const assert = require('node:assert/strict')
const fs = require('node:fs')
let ts; try { ts = require('typescript') } catch { ts = require('/opt/nvm/versions/node/v22.16.0/lib/node_modules/typescript') }
const load = (file, requireFn = require) => {
  const src = fs.readFileSync(file, 'utf8')
  const result = ts.transpileModule(src, { compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS }, reportDiagnostics: true })
  assert.equal(result.diagnostics.filter(d => d.category === ts.DiagnosticCategory.Error).length, 0)
  const module = { exports: {} }
  new Function('module', 'exports', 'require', result.outputText)(module, module.exports, requireFn)
  return module.exports
}
const m = load('src/model.ts')
const widget = load('src/widgetData.ts', id => id === './model' ? m : require(id))
const offer = { id:'lecture', semesterId:'s', moduleId:'m', name:'Informatik', category:'Vorlesung', date:'2026-10-12', endDate:'2026-10-26', from:'09:00', to:'11:00', recurrence:'weekly', overrides:{}, selected:true, room:'MA 041', onlineLink:'https://example.com' }
const data = { ...m.emptyData, activeSemesterId:'s', offerings:[offer] }
const now = (at) => new Date(at)
assert.equal(widget.nextWidgetAppointment(data, now('2026-10-12T08:30:00')).startsAt, '2026-10-12T09:00')
assert.equal(widget.nextWidgetAppointment(data, now('2026-10-12T09:30:00')).ongoing, true)
assert.equal(widget.nextWidgetAppointment(data, now('2026-10-12T11:01:00')).date, '2026-10-19')
assert.equal(widget.nextWidgetAppointment(data, now('2026-10-12T09:30:00')).place, 'MA 041 + Online')
assert.equal(widget.nextWidgetAppointment({ ...data, activeSemesterId:'different' }, now('2026-10-12T08:00:00')), null)
const paused = m.suspendOffering([offer], m.occurrenceAtOrigin(offer,'2026-10-12'), 'single')
assert.equal(widget.nextWidgetAppointment({...data,offerings:paused}, now('2026-10-12T08:30:00')).date,'2026-10-19')
const restored = m.setOfferingAttendance(paused, m.occurrenceAtOrigin(paused[0],'2026-10-12',true), 'single', true)
assert.equal(widget.nextWidgetAppointment({...data,offerings:restored}, now('2026-10-12T08:30:00')).date,'2026-10-12')
assert.equal(Object.keys(restored[0].overrides).length, 0)
console.log('✔ widget-data and single-pause revocation')
