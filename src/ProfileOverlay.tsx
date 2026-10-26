import {GoalManager,type WorkspaceChange} from './StudyManagement'
import {useSwipeToDismiss} from './useSwipeToDismiss'
import {useEffect,useRef,useState,type ReactNode} from 'react'
import {createPortal} from 'react-dom'
import {ArrowLeft,ChevronRight,GraduationCap,Layers2,Settings2,Target,UserRound,X} from 'lucide-react'
import type {AppData,StudyModule} from './model'
import {scoreTotal} from './score'
type Section='home'|'modules'|'goals'|'settings'
export default function ProfileOverlay({data,settings,onClose,onModule,onProfileChange,onMutate,onCreateModule}:{data:AppData;onMutate:WorkspaceChange;onCreateModule:()=>void;settings:ReactNode;onClose:()=>void;onModule:(module:StudyModule)=>void;onProfileChange:(name:string)=>void}){
  const [section,setSection]=useState<Section>('home')
  const panel=useRef<HTMLElement>(null)
  useSwipeToDismiss(panel,onClose)
  useEffect(()=>{
    const previousFocus=document.activeElement as HTMLElement|null
    panel.current?.querySelector<HTMLButtonElement>('button')?.focus()
    const close=(event:KeyboardEvent)=>{
      if(document.querySelector('.sheet-backdrop'))return
      if(event.key==='Escape'){event.stopPropagation();onClose()}
      if(event.key==='Tab'&&panel.current){
        const fields=Array.from(panel.current.querySelectorAll<HTMLElement>('button:not(:disabled),input:not(:disabled),select:not(:disabled),a[href],[tabindex="0"]')).filter(element=>element.getClientRects().length>0)
        const first=fields[0],last=fields[fields.length-1]
        if(event.shiftKey&&document.activeElement===first){event.preventDefault();last?.focus()}
        else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first?.focus()}
      }
    }
    window.addEventListener('keydown',close)
    const overflow=document.body.style.overflow;document.body.style.overflow='hidden'
    return()=>{window.removeEventListener('keydown',close);document.body.style.overflow=overflow;previousFocus?.focus()}
  },[onClose])
  return createPortal(<div className="profile-backdrop" onPointerDown={event=>{if(event.target===event.currentTarget)onClose()}}><section ref={panel} className="profile-panel" role="dialog" aria-modal="true" aria-label="Dein Profil">
    <header>{section!=='home'?<button aria-label="Zur Profilübersicht" onClick={()=>setSection('home')}><ArrowLeft size={20}/></button>:<UserRound size={20}/>}<h1>{section==='home'?'Dein Profil':section==='modules'?'Alle Module':section==='goals'?'Deine Ziele':'Einstellungen'}</h1><button aria-label="Profil schließen" onClick={onClose}><X size={20}/></button></header>
    <div className="profile-body">{section==='home'&&<><label className="profile-name"><span>Dein Name</span><input value={data.profile} onChange={event=>onProfileChange(event.target.value)} placeholder="Dein Name"/></label><div className="profile-menu">{([{id:'modules',icon:Layers2,title:'Module & Semester',detail:`${data.modules.length} Module · dein gesamtes Studium`},{id:'goals',icon:Target,title:'Ziele & Fortschritt',detail:'Leistungspunkte und persönliche Ziele'},{id:'settings',icon:Settings2,title:'Einstellungen',detail:'Studium, Mitteilungen, Semester und Daten'}] as const).map(item=><button key={item.id} onClick={()=>setSection(item.id)}><item.icon size={20}/><span><strong>{item.title}</strong><small>{item.detail}</small></span><ChevronRight size={17}/></button>)}</div></>}
    {section==='modules'&&<div className="profile-modules"><button className="study-add-module" onClick={onCreateModule}>+ Modul hinzufügen</button>{data.degrees.map(degree=><section key={degree.id}><h2><GraduationCap size={16}/>{degree.name}</h2>{data.modules.filter(module=>module.degreeId===degree.id).map(module=><button key={module.id} onClick={()=>onModule(module)}><i style={{background:module.color}}/><span><strong>{module.name}</strong><small>{module.semesterIds.map(id=>data.semesters.find(semester=>semester.id===id)?.name).filter(Boolean).join(' · ')||'Ohne Semester'} · {module.credits} LP</small><small>{module.status==='passed'?'Bestanden':module.status==='recognized'?'Anerkannt':module.status==='failed'?'Nicht bestanden':module.status==='planned'?'Geplant':'Aktuell'}{module.grade?` · Note ${module.grade}`:''}</small></span><b>{scoreTotal(data.scoreEvents,module.id)}</b></button>)}</section>)}</div>}
    {section==='goals'&&<GoalManager data={data} onMutate={onMutate}/>}
    {section==='settings'&&settings}</div>
  </section></div>,document.body)
}
