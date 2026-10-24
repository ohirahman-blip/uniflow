import {useEffect,useRef,type RefObject} from 'react'
/** Pull a mobile sheet down from its header, or from content already scrolled to the top. */
export function useSwipeToDismiss<T extends HTMLElement>(ref:RefObject<T|null>,onClose:()=>void,enabled=true){
  const close=useRef(onClose)
  close.current=onClose
  useEffect(()=>{
    const sheet=ref.current
    if(!enabled||!sheet)return
    let gesture:{id:number;x:number;y:number;time:number;distance:number;active:boolean}|null=null,suppressClickUntil=0
    sheet.classList.add('uf-swipe-sheet')
    const reset=()=>{gesture=null;sheet.classList.remove('uf-sheet-dragging');sheet.style.removeProperty('--sheet-swipe-y')}
    const start=(event:TouchEvent)=>{
      if(!window.matchMedia('(max-width:720px)').matches||event.touches.length!==1)return
      const target=event.target instanceof Element?event.target:null
      if(!target||target.closest('input,textarea,select,[contenteditable="true"],.uf-wheel-list,[role="slider"]'))return
      if(target.closest('[role="dialog"]')!==sheet)return
      for(let element:Element|null=target;element;element=element.parentElement){
        if(element instanceof HTMLElement&&element.scrollHeight>element.clientHeight+1&&/auto|scroll|overlay/.test(getComputedStyle(element).overflowY)&&element.scrollTop>1)return
        if(element===sheet)break
      }
      const touch=event.touches[0]
      gesture={id:touch.identifier,x:touch.clientX,y:touch.clientY,time:performance.now(),distance:0,active:false}
    }
    const move=(event:TouchEvent)=>{
      if(!gesture)return
      if(event.touches.length!==1){reset();return}
      const touch=Array.from(event.touches).find(item=>item.identifier===gesture?.id)
      if(!touch){reset();return}
      const dx=touch.clientX-gesture.x,dy=touch.clientY-gesture.y
      if(!gesture.active){
        if(Math.max(Math.abs(dx),Math.abs(dy))<10)return
        if(dy<=0||Math.abs(dx)>dy*.8){reset();return}
        if(!event.cancelable){reset();return}
        gesture.active=true;sheet.classList.add('uf-sheet-dragging')
      }
      event.preventDefault()
      gesture.distance=Math.max(0,dy)
      sheet.style.setProperty('--sheet-swipe-y',Math.min(gesture.distance,window.innerHeight*.75)+'px')
    }
    const end=(event:TouchEvent)=>{
      if(!gesture||!Array.from(event.changedTouches).some(touch=>touch.identifier===gesture?.id))return
      const current=gesture,elapsed=Math.max(1,performance.now()-current.time)
      if(current.active)suppressClickUntil=performance.now()+350
      const dismiss=current.active&&(current.distance>=80||(current.distance>=36&&current.distance/elapsed>.7))
      reset()
      if(dismiss)close.current()
    }
    const preventClick=(event:MouseEvent)=>{if(performance.now()<suppressClickUntil){event.preventDefault();event.stopPropagation()}}
    sheet.addEventListener('touchstart',start,{passive:true})
    sheet.addEventListener('touchmove',move,{passive:false})
    sheet.addEventListener('touchend',end)
    sheet.addEventListener('touchcancel',reset)
    sheet.addEventListener('click',preventClick,true)
    return()=>{reset();sheet.classList.remove('uf-swipe-sheet');sheet.removeEventListener('touchstart',start);sheet.removeEventListener('touchmove',move);sheet.removeEventListener('touchend',end);sheet.removeEventListener('touchcancel',reset);sheet.removeEventListener('click',preventClick,true)}
  },[ref,enabled])
}
