import {useEffect,useId} from 'react'
import {createPortal} from 'react-dom'
import './streak-flame.css'
import {playStreakSound} from './streak-audio'
export default function StreakCelebration({count,onClose,soundEnabled=true}:{count:number;onClose:()=>void;soundEnabled?:boolean}){
  const clipId=useId()
  useEffect(()=>{if(soundEnabled)return playStreakSound()},[soundEnabled])
  useEffect(()=>{
    const timer=window.setTimeout(onClose,2300)
    const escape=(event:KeyboardEvent)=>{if(event.key==='Escape')onClose()}
    window.addEventListener('keydown',escape)
    return()=>{window.clearTimeout(timer);window.removeEventListener('keydown',escape)}
  },[onClose])
  return createPortal(<div className={'streak-celebration'+(count>=7?' is-purple':'')} role="status" onClick={onClose}>
    <div className="streak-aura" aria-hidden="true"/>
    <div className="streak-fire" aria-hidden="true">
      <svg className="streak-fire-art" viewBox="0 0 200 250" focusable="false">
        <defs><clipPath id={clipId}><path d="M102 10C111 54 160 66 148 111C165 103 170 89 170 80C204 128 201 192 159 222C127 246 75 246 43 220C3 188 8 137 29 105C27 135 43 148 54 151C44 103 94 76 102 10Z"/></clipPath></defs>
        <path className="fire-silhouette" d="M102 10C111 54 160 66 148 111C165 103 170 89 170 80C204 128 201 192 159 222C127 246 75 246 43 220C3 188 8 137 29 105C27 135 43 148 54 151C44 103 94 76 102 10Z"/>
        <g clipPath={`url(#${clipId})`}>
          <g className="fire-layer fire-layer-outer"><path d="M102 10C111 54 160 66 148 111C165 103 170 89 170 80C204 128 201 192 159 222C127 246 75 246 43 220C3 188 8 137 29 105C27 135 43 148 54 151C44 103 94 76 102 10Z"/></g>
          <g className="fire-layer fire-layer-middle"><path d="M105 65C109 108 146 122 133 157C151 145 156 130 157 119C183 161 172 207 143 229C118 246 82 247 59 225C32 200 36 169 51 145C51 170 63 181 70 183C59 141 99 119 105 65Z"/></g>
          <g className="fire-layer fire-layer-core"><path d="M102 134C108 163 134 171 128 192C140 185 143 177 144 170C159 207 135 239 106 244C77 247 58 226 66 204C71 216 79 219 84 216C73 189 99 174 102 134Z"/></g>
        </g>
      </svg>
      <div className="fire-embers"><i/><i/><i/><i/><i/><i/></div>
    </div>
    <strong>{count}</strong><span>{count===0?'Sammle heute deine ersten Punkte':count===1?'Deine Serie beginnt':`${count} Tage in Folge`}</span>{count>=7&&<b>1,5× auf neue Punkte</b>}
  </div>,document.body)
}
