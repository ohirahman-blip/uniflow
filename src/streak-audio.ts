import {useEffect} from 'react'

let context:AudioContext|undefined
let bytes:Promise<ArrayBuffer>|undefined
let decoded:Promise<AudioBuffer>|undefined
const playing=new Set<AudioBufferSourceNode>()
function loadBytes(){
  if(!bytes)bytes=fetch('/audio/swoosh-fire.mp3').then(response=>{
    if(!response.ok)throw new Error('Sound unavailable')
    return response.arrayBuffer()
  }).catch(error=>{bytes=undefined;throw error})
  return bytes
}
function loadBuffer(){
  if(!context)return Promise.reject(new Error('Audio not unlocked'))
  const audio=context
  if(!decoded)decoded=loadBytes().then(value=>audio.decodeAudioData(value.slice(0))).catch(error=>{decoded=undefined;throw error})
  return decoded
}
function stopSounds(){
  for(const source of playing){try{source.stop()}catch{/* Already ended. */}}
  playing.clear()
}

export function useStreakAudio(enabled:boolean){
  useEffect(()=>{
    if(!enabled){stopSounds();return}
    void loadBytes().catch(()=>{/* Sound must never block the app. */})
    const unlock=()=>{
      try{
        const Constructor=window.AudioContext||(window as typeof window&{webkitAudioContext?:typeof AudioContext}).webkitAudioContext
        if(!Constructor)return
        context??=new Constructor()
        if(context.state==='suspended')void context.resume().catch(()=>{})
        void loadBuffer().catch(()=>{})
      }catch{/* Unsupported or blocked audio remains silent. */}
    }
    const onVisibility=()=>{if(document.hidden)stopSounds()}
    window.addEventListener('pointerdown',unlock,{capture:true,passive:true})
    window.addEventListener('keydown',unlock,true)
    document.addEventListener('visibilitychange',onVisibility)
    return()=>{
      window.removeEventListener('pointerdown',unlock,true)
      window.removeEventListener('keydown',unlock,true)
      document.removeEventListener('visibilitychange',onVisibility)
      stopSounds()
    }
  },[enabled])
}

export function playStreakSound(){
  let cancelled=false
  let source:AudioBufferSourceNode|undefined
  const audio=context
  if(audio?.state==='running'){
    void loadBuffer().then(buffer=>{
      if(cancelled||document.hidden||audio.state!=='running')return
      stopSounds()
      source=audio.createBufferSource()
      source.buffer=buffer
      const gain=audio.createGain()
      gain.gain.value=.65
      source.connect(gain);gain.connect(audio.destination)
      playing.add(source)
      source.onended=()=>{if(source)playing.delete(source);source?.disconnect();gain.disconnect()}
      source.start(audio.currentTime+.12)
    }).catch(()=>{/* Visual celebration still works without sound. */})
  }
  return()=>{cancelled=true;if(source){playing.delete(source);try{source.stop()}catch{/* Already ended. */}}}
}
