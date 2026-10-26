const assert=require('node:assert/strict')
const fs=require('node:fs')
const ts=require('typescript')
const vm=require('node:vm')
const cache=new Map()
function load(name){
  if(cache.has(name))return cache.get(name)
  const exports={}
  cache.set(name,exports)
  const code=ts.transpileModule(fs.readFileSync('src/'+name+'.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText
  new Function('exports','require',code)(exports,id=>id.startsWith('./')?load(id.slice(2)):require(id))
  return exports
}
const {rewardPoints}=load('learning-reward')
const {makeScoreEvent}=load('score')
const {applyScoreAwards}=load('streaks')
const {emptyData,today,addDays}=load('model')
const event=(id,basePoints,groupId='reward')=>makeScoreEvent({id,moduleId:'m',type:'study-minutes',basePoints,groupId,occurredAt:new Date().toISOString(),sourceId:id})
assert.equal(rewardPoints(undefined,'reward'),0)
const base={...emptyData,streakDays:Array.from({length:6},(_,i)=>addDays(today(),-i-1))}
const awarded=applyScoreAwards(base,{...base,scoreEvents:[event('minutes',60),event('lecture',100),event('exercise',50)]})
assert.equal(rewardPoints(awarded.scoreEvents,'reward'),315,'Show all newly awarded points including the seventh-day boost')
assert.equal(rewardPoints([...awarded.scoreEvents,event('other',900,'unrelated'),{...event('reversed',50),reversedAt:new Date().toISOString()}],'reward'),315,'Exclude other groups and reversed awards')
assert.equal(rewardPoints(applyScoreAwards(emptyData,{...emptyData,scoreEvents:[event('plain',60)]}).scoreEvents,'reward'),60)
const sound=fs.readFileSync('public/audio/success.wav')
assert.equal(sound.toString('ascii',0,4),'RIFF')
assert.equal(sound.toString('ascii',8,12),'WAVE')
assert.ok(sound.length<100000,'Success sound stays compact')

let cleanup,loads=0,starts=0,stops=0
const listeners={}
class AudioContext{
  constructor(){this.state='suspended';this.currentTime=2;this.destination={}}
  resume(){this.state='running';return Promise.resolve()}
  decodeAudioData(){return Promise.resolve({})}
  createGain(){return{gain:{value:0},connect(){},disconnect(){}}}
  createBufferSource(){return{connect(){},disconnect(){},start(at){assert.equal(at,2.12);starts++},stop(){stops++;this.onended?.()}}}
}
const windowMock={AudioContext,addEventListener(key,fn){listeners[key]=fn},removeEventListener(key){delete listeners[key]}}
const documentMock={hidden:false,addEventListener(key,fn){listeners[key]=fn},removeEventListener(key){delete listeners[key]}}
const audio={}
const code=ts.transpileModule(fs.readFileSync('src/streak-audio.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText
vm.runInNewContext(code,{exports:audio,require:()=>({useEffect:fn=>{cleanup=fn()}}),window:windowMock,document:documentMock,fetch:async()=>{loads++;return{ok:true,arrayBuffer:async()=>new ArrayBuffer(4)}}})
const flush=()=>new Promise(resolve=>setImmediate(resolve))
;(async()=>{
  audio.useStreakAudio(false);assert.equal(loads,0)
  audio.playSuccessSound()();assert.equal(starts,0)
  audio.useStreakAudio(true);listeners.pointerdown();await flush();assert.equal(loads,2)
  const cancel=audio.playSuccessSound();cancel();await flush();assert.equal(starts,0)
  audio.playSuccessSound();await flush();assert.equal(starts,1)
  audio.playStreakSound();await flush();assert.equal(starts,2);assert.equal(stops,1,'Celebrations cannot play over one another')
  documentMock.hidden=true;listeners.visibilitychange();assert.equal(stops,2)
  audio.playSuccessSound();await flush();assert.equal(starts,2)
  cleanup();assert.deepEqual(Object.keys(listeners),[])
  console.log('PASS: awarded totals, multiplier, reversed/group isolation, WAV asset, mute, gesture unlock, audio cancellation, no overlapping audio, hidden-tab silence and cleanup')
})().catch(error=>{console.error(error);process.exit(1)})
