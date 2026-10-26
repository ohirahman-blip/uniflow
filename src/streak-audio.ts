import {useEffect} from 'react'

let context:AudioContext|undefined
const soundFiles={streak:'/audio/swoosh-fire.mp3',success:'/audio/success.wav'} as const
type Sound=keyof typeof soundFiles
const bytes=new Map<Sound,Promise<ArrayBuffer>>()
const decoded=new Map<Sound,Promise<AudioBuffer>>()
const playing=new Set<AudioBufferSourceNode>()
function loadBytes(sound:Sound){
  let promise=bytes.get(sound)
  if(!promise){
    promise=fetch(soundFiles[sound]).then(response=>{
      if(!response.ok)throw new Error('Sound unavailable')
      return response.arrayBuffer()
    }).catch(error=>{bytes.delete(sound);throw error})
    bytes.set(sound,promise)
  }
  return promise
}
function loadBuffer(sound:Sound){
  if(!context)return Promise.reject(new Error('Audio not unlocked'))
  const audio=context
  let promise=decoded.get(sound)
  if(!promise){
    promise=loadBytes(sound).then(value=>audio.decodeAudioData(value.slice(0))).catch(error=>{decoded.delete(sound);throw error})
    decoded.set(sound,promise)
  }
  return promise
}
function stopSounds(){
  for(const source of playing){try{source.stop()}catch{/* Already ended. */}}
  playing.clear()
}

export function useStreakAudio(enabled:boolean){
  useEffect(()=>{
    if(!enabled){stopSounds();return}
    for(const sound of ['streak','success'] as const)void loadBytes(sound).catch(()=>{/* Sound must never block the app. */})
    const unlock=()=>{
      try{
        const Constructor=window.AudioContext||(window as typeof window&{webkitAudioContext?:typeof AudioContext}).webkitAudioContext
        if(!Constructor)return
        context??=new Constructor()
        if(context.state==='suspended')void context.resume().catch(()=>{})
        for(const sound of ['streak','success'] as const)void loadBuffer(sound).catch(()=>{})
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

export const playStreakSound=()=>playSound('streak')
export const playSuccessSound=()=>playSound('success')
function playSound(sound:Sound){
  let cancelled=false
  let source:AudioBufferSourceNode|undefined
  const audio=context
  if(audio?.state==='running'){
    void loadBuffer(sound).then(buffer=>{
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
