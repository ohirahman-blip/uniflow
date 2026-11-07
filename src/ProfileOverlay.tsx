import {GoalManager,type WorkspaceChange} from './StudyManagement'
import {useSwipeToDismiss} from './useSwipeToDismiss'
import {useEffect,useMemo,useRef,useState,type ReactNode} from 'react'
import {createPortal} from 'react-dom'
import {ArrowLeft,ChevronRight,GraduationCap,Layers2,Plus,Settings2,Target,UserRound,X} from 'lucide-react'
import UniflowPicker from './UniflowPicker'
import {semesterNumber,type AppData,type StudyModule} from './model'
import {scoreTotal} from './score'
type Section='home'|'modules'|'goals'|'settings'
type ModuleSort='semester'|'semester-desc'|'name'
export default function ProfileOverlay({initialSection='home',data,settings,onClose,onModule,onProfileChange,onMutate,onCreateModule}:{initialSection?:'home'|'modules';data:AppData;onMutate:WorkspaceChange;onCreateModule:()=>void;settings:ReactNode;onClose:()=>void;onModule:(module:StudyModule)=>void;onProfileChange:(name:string)=>void}){
  const [section,setSection]=useState<Section>(initialSection)
  const [moduleStatus,setModuleStatus]=useState<'all'|StudyModule['status']>('all')
  const [moduleSemester,setModuleSemester]=useState('all')
  const [moduleSort,setModuleSort]=useState<ModuleSort>('semester')
  const panel=useRef<HTMLElement>(null)
  const activeDegree=data.degrees.find(item=>item.id===data.activeDegreeId)
  const degreeSemesters=useMemo(()=>data.semesters.filter(item=>item.degreeId===data.activeDegreeId).sort((a,b)=>a.start.localeCompare(b.start)),[data.activeDegreeId,data.semesters])
  const activeStudyStart=activeDegree?.studyStartSemester||degreeSemesters[0]?.start
  const modulesByDegree=useMemo(()=>data.degrees.map(degree=>{
    const semesterStart=(module:StudyModule)=>module.semesterIds.map(id=>data.semesters.find(item=>item.id===id)?.start).filter((value):value is string=>!!value).sort()[0]||''
    const compareSemester=(a:StudyModule,b:StudyModule)=>{const left=semesterStart(a),right=semesterStart(b);if(!left)return right?1:a.name.localeCompare(b.name,'de');if(!right)return -1;const order=left.localeCompare(right);return (moduleSort==='semester-desc'?-order:order)||a.name.localeCompare(b.name,'de')}
    const modules=data.modules.filter(module=>module.degreeId===degree.id)
      .filter(module=>moduleStatus==='all'||module.status===moduleStatus)
      .filter(module=>moduleSemester==='all'||module.semesterIds.includes(moduleSemester))
      .sort((a,b)=>moduleSort==='name'?a.name.localeCompare(b.name,'de'):compareSemester(a,b))
    return {degree,modules}
  }).filter(group=>group.modules.length),[data.degrees,data.modules,data.semesters,moduleSemester,moduleSort,moduleStatus])
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
    {section==='modules'&&<div className="profile-modules">
      <div className="profile-module-toolbar">
        <div className="profile-module-filter-row" aria-label="Module sortieren und filtern">
          <UniflowPicker label="Status filtern" value={moduleStatus} onChange={value=>setModuleStatus(value as typeof moduleStatus)} options={[{value:'all',label:'Alle Status'},{value:'current',label:'Aktuell'},{value:'planned',label:'Geplant'},{value:'open',label:'Offen'},{value:'passed',label:'Bestanden'},{value:'failed',label:'Nicht bestanden'},{value:'recognized',label:'Anerkannt'}]}/>
          <UniflowPicker label="Semester filtern" value={moduleSemester} onChange={setModuleSemester} options={[{value:'all',label:'Alle Semester'},...degreeSemesters.map(item=>{const number=semesterNumber(activeStudyStart,item.start);return {value:item.id,label:number?`${number}. Fachsemester · ${item.name}`:item.name}})]}/>
          <UniflowPicker label="Module sortieren" value={moduleSort} onChange={value=>setModuleSort(value as ModuleSort)} options={[{value:'semester',label:'Semester aufsteigend'},{value:'semester-desc',label:'Semester absteigend'},{value:'name',label:'Name A–Z'}]}/>
        </div>
        <button type="button" className="profile-module-add" aria-label="Modul hinzufügen" title="Modul hinzufügen" onClick={onCreateModule}><Plus size={18}/></button>
      </div>
      {modulesByDegree.map(({degree,modules})=>{const studyStart=degree.studyStartSemester||data.semesters.filter(item=>item.degreeId===degree.id).map(item=>item.start).sort()[0];return <section key={degree.id}><h2><GraduationCap size={16}/>{degree.name}</h2>{modules.map(module=>{const semesters=module.semesterIds.map(id=>{const semester=data.semesters.find(item=>item.id===id);if(!semester)return null;const number=semesterNumber(studyStart,semester.start);return number?`${number}. Semester · ${semester.name}`:semester.name}).filter((value):value is string=>!!value).join(' · ');return <button key={module.id} onClick={()=>onModule(module)}><span><strong>{module.name}</strong><small>{semesters||'Ohne Semester'} · {module.credits} LP</small><small>{module.status==='passed'?'Bestanden':module.status==='recognized'?'Anerkannt':module.status==='failed'?'Nicht bestanden':module.status==='planned'?'Geplant':'Aktuell'}{module.grade?` · Note ${module.grade}`:''}</small></span><b>{scoreTotal(data.scoreEvents,module.id)}</b></button>})}</section>})}
      {modulesByDegree.length===0&&<p className="profile-modules-empty">Keine Module für diese Auswahl.</p>}
    </div>}
    {section==='goals'&&<GoalManager data={data} onMutate={onMutate}/>}
    {section==='settings'&&settings}</div>
  </section></div>,document.body)
}
