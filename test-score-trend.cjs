const assert=require('node:assert/strict'),fs=require('node:fs'),ts=require('typescript'),React=require('react')
const {renderToStaticMarkup}=require('react-dom/server'),cache=new Map()
function load(name){
  if(cache.has(name))return cache.get(name)
  const exports={};cache.set(name,exports)
  const filename='src/'+name+(fs.existsSync('src/'+name+'.tsx')?'.tsx':'.ts')
  const code=ts.transpileModule(fs.readFileSync(filename,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020,jsx:ts.JsxEmit.ReactJSX}}).outputText
  new Function('exports','require',code)(exports,id=>id.endsWith('.css')?{}:id.startsWith('./')?load(id.slice(2)):require(id))
  return exports
}
const {emptyData}=load('model'),{scoreTrend}=load('score-trend')
const semester={id:'s',start:'2026-10-01',end:'2027-03-31'}
const event=(id,occurredAt,points,extra={})=>({id,moduleId:'a',occurredAt,points,type:'study-minutes',...extra})
const data={...emptyData,assessments:[{id:'one',title:'Klausur A',moduleId:'a',semesterId:'s',type:'exam',date:'2027-02-10'},{id:'last',title:'Klausur B',moduleId:'b',semesterId:'s',type:'exam',date:'2027-02-20'}],scoreEvents:[
event('bonus','2026-09-20T12:00:00Z',100),event('one','2026-10-02T12:00:00Z',120),event('two','2026-10-05T12:00:00Z',80),
event('reversed','2026-10-05T12:00:00Z',200,{reversedAt:'2026-10-06'}),event('foreign','2026-10-05T12:00:00Z',999,{moduleId:'b'}),event('future','2026-12-01T12:00:00Z',500)]}
const before=JSON.stringify(data),trend=scoreTrend(data,'a',semester,'2026-10-29')
assert.equal(trend.start,semester.start);assert.equal(trend.end,'2027-02-20')
assert.equal(trend.total,300)
assert.equal(trend.points[0].value,100,'Carry-in keeps graph aligned with total module score')
assert.equal(trend.points[trend.points.length-1].date,'2026-10-29')
assert.ok(trend.points.every(point=>point.date<='2026-10-29'),'Never forecast future points')
assert.equal(trend.x(trend.end),1)
assert.equal(scoreTrend({...data,assessments:[]},'a',semester,'2026-10-29').end,semester.end)
assert.deepEqual(scoreTrend(data,'a',semester,'2026-09-29').points,[])
assert.equal(JSON.stringify(data),before,'Graph does not mutate source history')
assert.equal(scoreTrend({...data,scoreEvents:[...data.scoreEvents,data.scoreEvents[1]]},'a',semester,'2026-10-29').total,300,'Duplicate events do not double-count')
const html=renderToStaticMarkup(React.createElement(load('ScoreTrend').default,{data,moduleId:'a',semester}))
assert.ok(html.includes('Score-Verlauf')&&html.includes('<polyline')&&html.includes('Bis zur letzten Prüfung'))
assert.ok(!fs.readFileSync('src/ModuleLearningHome.tsx','utf8').includes('PixelScoreScene'))
assert.ok(!fs.readFileSync('src/study-game.css','utf8').includes('StudyPixel'))
console.log('PASS: real cumulative module scores, semester/last-exam range, carry-in, reversals, no future values, duplicates, SSR and no gaming score')
