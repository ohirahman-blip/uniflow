import {useEffect,useRef,useState} from 'react'

export default function AnimatedScore({value,storageKey}:{value:number;storageKey:string}){
  const [display,setDisplay]=useState(()=>{try{const previous=sessionStorage.getItem(storageKey);return previous===null?value:Number(previous)||value}catch{return value}})
  const [rising,setRising]=useState(false)
  const displayRef=useRef(display)
  useEffect(()=>{
    const from=displayRef.current
    try{sessionStorage.setItem(storageKey,String(value))}catch{/* Animation memory is optional. */}
    if(value<=from||window.matchMedia('(prefers-reduced-motion: reduce)').matches){displayRef.current=value;setDisplay(value);setRising(false);return}
    let frame=0,start:number|undefined
    const duration=Math.min(1500,800+Math.log2(value-from+1)*45)
    setRising(true)
    const tick=(time:number)=>{
      if(start===undefined)start=time
      const progress=Math.min(1,(time-start)/duration),eased=progress<.5?4*progress**3:1-(-2*progress+2)**3/2
      const next=Math.round(from+(value-from)*eased)
      displayRef.current=next;setDisplay(next)
      if(progress<1)frame=requestAnimationFrame(tick);else setRising(false)
    }
    frame=requestAnimationFrame(tick)
    return()=>cancelAnimationFrame(frame)
  },[value,storageKey])
  return <span className={'mlh-score-number'+(rising?' is-rising':'')}><i aria-hidden="true">+</i><strong>{display.toLocaleString('de-DE')}</strong></span>
}
