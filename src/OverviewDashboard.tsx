import type {StudyDayBundle,StudyPlan} from './adaptive-study-plan'
import type {StudyAdvice} from './study-advice'
import DashboardTimer from './DashboardTimer'
import type {StudyTimerState} from './study-timer'
import {lessonKeyForOccurrence,type LearningSession,type StudyTask} from './learning'
import {useEffect,useRef,useState,type CSSProperties} from 'react'
import {createPortal} from 'react-dom'
import {BookOpenCheck,CalendarDays,Check,ClipboardList,Clock3,GraduationCap,Plus,Trash2,Users,X} from 'lucide-react'
import {addDays,dateString,formatDate,fromDate,isAssessment,minutes,occurrencesOn,selectedAssessment,weekStart,type AppData,type Assessment,type Occurrence} from './model'
import StudyUtilities from './StudyUtilities'
import UniflowPicker from './UniflowPicker'
type WelcomeTarget='learning'|'tasks'|'calendar'|'friends'
const welcomePrompts=[
  {id:'hello' as const},
  {id:'learning' as const,possessive:'deinen',label:'Lernplan',icon:BookOpenCheck,color:'#a98ad7'},
  {id:'tasks' as const,possessive:'deine',label:'offenen Aufgaben',icon:ClipboardList,color:'#e88772'},
  {id:'calendar' as const,possessive:'deinen',label:'Stundenplan',icon:CalendarDays,color:'#6f9ee8'},
  {id:'friends' as const,possessive:'deine',label:'Freunde',icon:Users,color:'#63b98d'}
]
type Props={studyPlan:StudyPlan;onStudyPlan:(bundle:StudyDayBundle)=>void;aiGeneratedAt:string|null;aiStale:boolean;advice:StudyAdvice|null;aiEnabled:boolean;aiWorking:boolean;aiError:string;onTimerChange:(timer:StudyTimerState|undefined)=>void;onSession:(session:Omit<LearningSession,'id'|'updatedAt'>)=>void;data:AppData;onProfile:()=>void;onStreak:()=>void;onAddTask:(moduleId:string,title:string,dueDate?:string)=>void;onToggleTask:(task:StudyTask)=>void;onDeleteTask:(task:StudyTask)=>void;onGoal:(goal:number)=>void;onAssessment:(assessment:Assessment)=>void;onLearning:(moduleId?:string)=>void;onNavigate:(page:'calendar'|'friends')=>void;onLiveCheckin:(occurrence:Occurrence,rating?:'understood'|'partial'|'struggling')=>void}
function dashboardInk(color:string){const hex=color.replace('#',''),full=hex.length===3?hex.split('').map(value=>value+value).join(''):hex;if(!/^[0-9a-f]{6}$/i.test(full))return'#17171a';const values=[0,2,4].map(index=>parseInt(full.slice(index,index+2),16)/255).map(value=>value<=.04045?value/12.92:((value+.055)/1.055)**2.4);return values[0]*.2126+values[1]*.7152+values[2]*.0722>.179?'#17171a':'#fff'}
type AttendanceState='free'|'future'|'complete'|'open'
export default function OverviewDashboard({studyPlan,onStudyPlan,data,onProfile,onStreak,onAddTask,onToggleTask,onDeleteTask,onAssessment,onLearning,onNavigate,onTimerChange,onSession,onLiveCheckin}:Props){
  const [clock,setClock]=useState(()=>new Date()),[title,setTitle]=useState(''),[moduleId,setModuleId]=useState(''),[dueDate,setDueDate]=useState(''),[adding,setAdding]=useState(false),[attendanceOpen,setAttendanceOpen]=useState(false)
  const [livePhase,setLivePhase]=useState<'attendance'|'confirm'|'confirmed'|'rating'|'rated'>('attendance'),[liveChoices,setLiveChoices]=useState(false),[liveFeedback,setLiveFeedback]=useState('')
  const [liveScrolled,setLiveScrolled]=useState(false)
  const [welcomeScrolled,setWelcomeScrolled]=useState(false)
  const [welcomeIndex,setWelcomeIndex]=useState(0),[welcomeLeaving,setWelcomeLeaving]=useState(false)
  const [learningSpotlight,setLearningSpotlight]=useState(false)
  const liveTimer=useRef(0)
  const learningSpotlightTimer=useRef(0),learningSpotlightUsed=useRef(false)
  const dashboardRef=useRef<HTMLElement|null>(null)
  useEffect(()=>{const timer=window.setInterval(()=>setClock(new Date()),30000);return()=>clearInterval(timer)},[])
  useEffect(()=>()=>window.clearTimeout(learningSpotlightTimer.current),[])
  useEffect(()=>{if(!attendanceOpen)return;const previous=document.body.style.overflow;document.body.style.overflow='hidden';const close=(event:KeyboardEvent)=>{if(event.key==='Escape')setAttendanceOpen(false)};window.addEventListener('keydown',close);return()=>{document.body.style.overflow=previous;window.removeEventListener('keydown',close)}},[attendanceOpen])
  useEffect(()=>{if(!adding)return;const previous=document.body.style.overflow;document.body.style.overflow='hidden';const close=(event:KeyboardEvent)=>{if(event.key==='Escape')setAdding(false)};window.addEventListener('keydown',close);return()=>{document.body.style.overflow=previous;window.removeEventListener('keydown',close)}},[adding])
  const day=dateString(clock)
  const tasks=data.studyTasks||[],pending=tasks.filter(task=>!task.completedAt).sort((a,b)=>(a.dueDate||'9999').localeCompare(b.dueDate||'9999')||a.createdAt.localeCompare(b.createdAt))
  const upcoming=data.assessments.filter(item=>!item.completed&&(!item.date||item.date>=day)&&selectedAssessment(item,data.assessments)).sort((a,b)=>(a.date||'9999').localeCompare(b.date||'9999')||(a.from||'').localeCompare(b.from||''))
  const homework=upcoming.find(item=>item.type==='homework'),exam=upcoming.find(item=>item.type==='exam')
  const moduleFor=(id?:string)=>data.modules.find(module=>module.id===id)
  const teachingOfferings=data.offerings.filter(item=>!isAssessment(item.category)&&item.category!=='Freies Lernen')
  const todayOccurrences=occurrencesOn(teachingOfferings,day).filter(item=>!item.cancelled).sort((a,b)=>a.from.localeCompare(b.from))
  const nowMinutes=clock.getHours()*60+clock.getMinutes()
  const activeLecture=todayOccurrences.find(item=>minutes(item.from)<=nowMinutes&&minutes(item.to)>nowMinutes)
  const hasActiveLecture=!!activeLecture
  let nextLesson=todayOccurrences.find(item=>minutes(item.from)>nowMinutes)
  if(!nextLesson)for(let offset=1;offset<=60&&!nextLesson;offset++)nextLesson=occurrencesOn(teachingOfferings,addDays(day,offset)).filter(item=>!item.cancelled).sort((a,b)=>a.from.localeCompare(b.from))[0]
  const nextColor=moduleFor(nextLesson?.offering.moduleId)?.color||'#e8e8eb'
  const checkins=new Map((data.learningCheckins||[]).map(item=>[item.key,item]))
  const activeCheckin=activeLecture?checkins.get(lessonKeyForOccurrence(activeLecture)):undefined
  useEffect(()=>{
    window.clearTimeout(liveTimer.current)
    setLiveChoices(false);setLiveFeedback('')
    setLivePhase(activeCheckin&&(activeCheckin.attended??activeCheckin.rating!=='absent')?(activeCheckin.understandingSelected===false?'rating':'rated'):'attendance')
    return()=>window.clearTimeout(liveTimer.current)
  },[activeLecture?.key])
  useEffect(()=>{
    if(!activeLecture){setLiveScrolled(false);return}
    const update=()=>setLiveScrolled(current=>current?window.scrollY>4:window.scrollY>18)
    update();window.addEventListener('scroll',update,{passive:true})
    return()=>window.removeEventListener('scroll',update)
  },[activeLecture?.key])
  useEffect(()=>{
    if(activeLecture){setWelcomeScrolled(false);return}
    const update=()=>setWelcomeScrolled(current=>current?window.scrollY>4:window.scrollY>18)
    update();window.addEventListener('scroll',update,{passive:true})
    return()=>window.removeEventListener('scroll',update)
  },[hasActiveLecture])
  useEffect(()=>{
    const root=dashboardRef.current
    if(!root||window.matchMedia('(prefers-reduced-motion: reduce)').matches)return
    let settleTimer=0,animationFrame=0,animating=false,lastY=window.scrollY,lastAt=performance.now(),velocity=0
    const stopAnimation=()=>{if(animationFrame)cancelAnimationFrame(animationFrame);animationFrame=0;animating=false}
    const settle=()=>{
      settleTimer=0
      const elapsed=performance.now()-lastAt
      if(animating||(Math.abs(velocity)>.6&&elapsed<190))return
      const selector=':scope>.mlh-running-timer,:scope>.overview-now-grid,:scope>.overview-learning-map,.overview-live-next'
      const maxY=Math.max(0,(document.scrollingElement?.scrollHeight||document.documentElement.scrollHeight)-window.innerHeight)
      const currentY=window.scrollY
      const targets=[...root.querySelectorAll<HTMLElement>(selector)].map(element=>Math.max(0,Math.min(maxY,currentY+element.getBoundingClientRect().top-16)))
      if(!targets.length)return
      const targetY=targets.reduce((nearest,target)=>Math.abs(target-currentY)<Math.abs(nearest-currentY)?target:nearest,targets[0])
      const distance=targetY-currentY,limit=Math.min(110,window.innerHeight*.13)
      if(Math.abs(distance)<4||Math.abs(distance)>limit)return
      const startedAt=performance.now(),duration=Math.min(380,Math.max(240,210+Math.abs(distance)))
      animating=true
      const animate=(now:number)=>{
        const progress=Math.min(1,(now-startedAt)/duration),eased=1-(1-progress)**4
        window.scrollTo(0,currentY+distance*eased)
        if(progress<1)animationFrame=requestAnimationFrame(animate)
        else{animationFrame=0;animating=false;lastY=window.scrollY;lastAt=performance.now();velocity=0}
      }
      animationFrame=requestAnimationFrame(animate)
    }
    const onScroll=()=>{
      if(animating)return
      const now=performance.now(),nextY=window.scrollY,deltaTime=Math.max(1,now-lastAt)
      velocity=(nextY-lastY)/deltaTime;lastY=nextY;lastAt=now
      window.clearTimeout(settleTimer)
      settleTimer=window.setTimeout(settle,150)
    }
    const cancel=()=>{window.clearTimeout(settleTimer);settleTimer=0;stopAnimation()}
    window.addEventListener('scroll',onScroll,{passive:true})
    window.addEventListener('pointerdown',cancel,{passive:true})
    window.addEventListener('touchstart',cancel,{passive:true})
    window.addEventListener('wheel',cancel,{passive:true})
    return()=>{window.clearTimeout(settleTimer);stopAnimation();window.removeEventListener('scroll',onScroll);window.removeEventListener('pointerdown',cancel);window.removeEventListener('touchstart',cancel);window.removeEventListener('wheel',cancel)}
  },[])
  useEffect(()=>{
    if(activeLecture){setWelcomeIndex(0);setWelcomeLeaving(false);return}
    let swapTimer=0
    const cycle=window.setInterval(()=>{
      setWelcomeLeaving(true)
      window.clearTimeout(swapTimer)
      swapTimer=window.setTimeout(()=>{setWelcomeIndex(current=>(current+1)%welcomePrompts.length);setWelcomeLeaving(false)},260)
    },4300)
    return()=>{window.clearInterval(cycle);window.clearTimeout(swapTimer)}
  },[hasActiveLecture])
  const attendanceFor=(date:string):{events:number;attended:number;state:AttendanceState}=>{const events=occurrencesOn(teachingOfferings,date).filter(item=>!item.cancelled),attended=events.filter(event=>{const checkin=checkins.get(lessonKeyForOccurrence(event));return !!checkin&&(checkin.attended??checkin.rating!=='absent')}).length;return{events:events.length,attended,state:events.length===0?'free':date>day?'future':attended>0?'complete':'open'}}
  const weekDays=Array.from({length:7},(_,index)=>{const date=addDays(weekStart(day),index);return{date,...attendanceFor(date)}})
  const universityDaysThisWeek=weekDays.filter(item=>item.date<=day&&item.events>0),visitedThisWeek=universityDaysThisWeek.filter(item=>item.attended>0).length
  const activeSemester=data.semesters.find(item=>item.id===data.activeSemesterId),semesterStart=activeSemester?.start||addDays(day,-90),semesterEnd=activeSemester?.end||addDays(day,90)
  const monthStarts:string[]=[]
  for(let cursor=fromDate(`${semesterStart.slice(0,7)}-01`),limit=0;dateString(cursor)<=`${semesterEnd.slice(0,7)}-01`&&limit<18;limit++){monthStarts.push(dateString(cursor));cursor=new Date(cursor);cursor.setMonth(cursor.getMonth()+1)}
  const attendanceMonths=monthStarts.map(first=>{const next=fromDate(first);next.setMonth(next.getMonth()+1);const count=Number(addDays(dateString(next),-1).slice(8)),leading=(fromDate(first).getDay()+6)%7;return{first,label:formatDate(first,{month:'long',year:'numeric'}),cells:Array.from({length:leading+count},(_,index)=>index<leading?null:addDays(first,index-leading))}})
  const dailyStudyBundles=studyPlan.bundles.filter(bundle=>bundle.date===day).sort((a,b)=>a.moduleId.localeCompare(b.moduleId)||a.id.localeCompare(b.id))
  const openStudyBundles=dailyStudyBundles.filter(bundle=>!bundle.completed),completedStudyBundles=dailyStudyBundles.filter(bundle=>bundle.completed)
  const learningModuleIds=new Set(openStudyBundles.map(bundle=>bundle.moduleId))
  const linkedLearningTasks=pending.filter(task=>learningModuleIds.has(task.moduleId)&&(!task.dueDate||task.dueDate===day)),linkedLearningTaskIds=new Set(linkedLearningTasks.map(task=>task.id))
  const generalPending=pending.filter(task=>!linkedLearningTaskIds.has(task.id)),todaysTasks=generalPending.filter(task=>task.dueDate===day),dashboardTasks=(todaysTasks.length?todaysTasks:generalPending).slice(0,5)
  useEffect(()=>{
    if(!openStudyBundles.length||learningSpotlightUsed.current)return
    const firstStop=dashboardRef.current?.querySelector<HTMLElement>('.overview-learning-stop .overview-learning-card')
    if(!firstStop)return
    const observer=new IntersectionObserver(entries=>{
      if(!entries.some(entry=>entry.isIntersecting)||learningSpotlightUsed.current)return
      learningSpotlightUsed.current=true
      setLearningSpotlight(true)
      window.clearTimeout(learningSpotlightTimer.current)
      learningSpotlightTimer.current=window.setTimeout(()=>setLearningSpotlight(false),2200)
      observer.disconnect()
    },{threshold:.62,rootMargin:'0px 0px -10% 0px'})
    observer.observe(firstStop)
    return()=>observer.disconnect()
  },[openStudyBundles.length])
  const renderTask=(task:StudyTask)=>{const module=data.modules.find(item=>item.id===task.moduleId);return <article key={task.id} className={'overview-task'+(task.completedAt?' is-complete':'')} style={{'--task-color':module?.color||'#b5a0c9'} as CSSProperties}><button role="checkbox" aria-checked={!!task.completedAt} aria-label={`${task.title}${task.completedAt?' wieder öffnen':' erledigen'}`} onClick={()=>onToggleTask(task)}><i>{task.completedAt&&<Check size={13}/>}</i><span><strong>{task.title}</strong><small>{module?.name||'Allgemein'}{task.dueDate?` · ${formatDate(task.dueDate,{day:'numeric',month:'short'})}`:''}</small></span>{!task.completedAt&&<b>+{task.points||20}</b>}</button><button aria-label={`${task.title} löschen`} onClick={()=>onDeleteTask(task)}><Trash2 size={16}/></button></article>}
  const renderStudyBundle=(bundle:StudyDayBundle,index:number)=>{const module=moduleFor(bundle.moduleId),color=module?.color||'#9b8eaa',linkedTasks=linkedLearningTasks.filter(task=>task.moduleId===bundle.moduleId);return <article key={bundle.id} className={'overview-learning-stop'+(bundle.completed?' is-complete':'')+(index===0&&learningSpotlight?' is-arrival-highlight':'')} style={{'--study-color':color} as CSSProperties}><div className="overview-learning-node"><i>{bundle.completed?<Check size={13}/>:index+1}</i></div><div className="overview-learning-card"><button className="overview-learning-main" type="button" disabled={bundle.completed} onClick={()=>onStudyPlan(bundle)}><span className="overview-learning-copy"><small>{module?.name||'Allgemeines Lernen'}</small><strong>{bundle.items.map(item=>item.label).join(' · ')}</strong><b><Clock3 size={13}/>{bundle.completed?'Heute gelernt':`ca. ${Math.round(bundle.minutes)} Minuten`}</b></span><span className="overview-learning-action">{bundle.completed?<Check size={17}/>:<BookOpenCheck size={17}/>}</span></button>{linkedTasks.length>0&&<div className="overview-learning-linked">{linkedTasks.map(task=><button key={task.id} role="checkbox" aria-checked={false} onClick={()=>onToggleTask(task)}><i/><span>{task.title}</span><b>+{task.points||20}</b></button>)}</div>}</div></article>}
  const attendanceStrip=<section className="overview-attendance" role="button" tabIndex={0} aria-label="Gesamte Anwesenheit öffnen" onClick={()=>setAttendanceOpen(true)} onKeyDown={event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();setAttendanceOpen(true)}}}><header><span>Deine Woche</span><strong>{universityDaysThisWeek.length?`${visitedThisWeek} von ${universityDaysThisWeek.length} Uni-Tagen`:'Bisher keine Uni-Termine'}</strong></header><div>{weekDays.map(item=><div key={item.date} className={`is-${item.state}${item.date===day?' is-today':''}`}><span>{formatDate(item.date,{weekday:'short'}).slice(0,2)}</span><i>{item.state==='free'||item.state==='complete'?<Check size={14}/>:null}</i><small>{item.state==='free'?'frei':item.attended?'besucht':item.events?'nicht besucht':'frei'}</small></div>)}</div></section>
  const nextEventCard=<button className="overview-current-event" style={{'--current-color':nextColor,'--current-ink':dashboardInk(nextColor)} as CSSProperties} disabled={!nextLesson} onClick={()=>nextLesson&&onLearning(nextLesson.offering.moduleId)}><CalendarDays size={25}/><span><small>Nächste Veranstaltung</small><strong>{nextLesson?(moduleFor(nextLesson.offering.moduleId)?.name||nextLesson.offering.name):'Keine weitere Veranstaltung'}</strong>{nextLesson&&<><b>{nextLesson.offering.room||'Raum noch offen'}</b><time>{nextLesson.date!==day?`${formatDate(nextLesson.date,{weekday:'short',day:'numeric',month:'short'})} · `:''}{nextLesson.from}–{nextLesson.to}</time></>}</span></button>
  const upcomingStack=<div className="overview-upcoming-stack">{([{kind:'exam',icon:GraduationCap,label:'Nächste Prüfung',item:exam},{kind:'homework',icon:BookOpenCheck,label:'Nächste Hausaufgabe',item:homework}] as const).map(entry=><button className="overview-upcoming" key={entry.kind} disabled={!entry.item} onClick={()=>entry.item&&onAssessment(entry.item)}><entry.icon size={20}/><span><small>{entry.label}</small><strong>{entry.item?.title||'Nichts offen'}</strong>{entry.item&&<b><span>{moduleFor(entry.item.moduleId)?.name||'Modul'}</span><time>{entry.item.date?formatDate(entry.item.date,{day:'numeric',month:'short'}):'Ohne Termin'}</time></b>}</span></button>)}</div>
  const activeModule=moduleFor(activeLecture?.offering.moduleId),activeTitle=activeModule?.name||activeLecture?.offering.name||'deiner Veranstaltung',activeColor=activeModule?.color||'#e8e8eb'
  const liveSubtitle=activeLecture?`Von ${activeLecture.from} bis ${activeLecture.to}${activeLecture.offering.room?` im Raum ${activeLecture.offering.room}`:''}`:''
  const requestLiveAttendance=()=>{setLivePhase('confirm');window.clearTimeout(liveTimer.current);liveTimer.current=window.setTimeout(()=>setLivePhase('attendance'),3000)}
  const confirmLiveAttendance=()=>{if(!activeLecture)return;onLiveCheckin(activeLecture);setLivePhase('confirmed');setLiveFeedback('Ich bin da');window.clearTimeout(liveTimer.current);liveTimer.current=window.setTimeout(()=>{setLiveFeedback('');setLivePhase('rating')},3000)}
  const revealLiveRating=()=>{setLiveChoices(true);window.clearTimeout(liveTimer.current);liveTimer.current=window.setTimeout(()=>setLiveChoices(false),3000)}
  const rateLive=(rating:'understood'|'partial'|'struggling')=>{if(!activeLecture)return;onLiveCheckin(activeLecture,rating);setLiveChoices(false);setLivePhase('rated');setLiveFeedback(rating==='understood'?'Gut':rating==='partial'?'Teilweise':'Gar nicht');window.clearTimeout(liveTimer.current);liveTimer.current=window.setTimeout(()=>setLiveFeedback(''),3000)}
  const attendanceHeading=<>Bist du schon in <button style={{color:activeColor}} onClick={livePhase==='attendance'?requestLiveAttendance:undefined}>{activeTitle}?</button></>
  const attendanceHeadingVisible=livePhase==='attendance'||livePhase==='confirm'||livePhase==='confirmed'||liveFeedback==='Ich bin da'
  const liveHeading=attendanceHeadingVisible?attendanceHeading:liveFeedback?<span className="overview-live-feedback" style={{color:activeColor}}>{liveFeedback}</span>:<>Wie läuft <button style={{color:activeColor}} onClick={revealLiveRating}>{activeTitle}?</button></>
  const liveHeadingKey=attendanceHeadingVisible?'attendance':liveFeedback?`feedback-${liveFeedback}`:'rating'
  const attendanceConfirm=livePhase==='confirm'||liveFeedback==='Ich bin da'
  const goToWelcomeTarget=(target:WelcomeTarget)=>{
    if(target==='calendar'||target==='friends'){onNavigate(target);return}
    const element=dashboardRef.current?.querySelector<HTMLElement>(target==='learning'?'.overview-learning-map':'.overview-tasks-focus')
    if(element)window.scrollTo({top:Math.max(0,window.scrollY+element.getBoundingClientRect().top-16),behavior:'smooth'})
  }
  const welcomePrompt=welcomePrompts[welcomeIndex],WelcomeIcon=welcomePrompt.id==='hello'?null:welcomePrompt.icon
  return <main ref={dashboardRef} className={'screen overview-dashboard overview-dashboard-clean'+(activeLecture?' has-live-lecture':'')}><StudyUtilities days={data.streakDays} onProfile={onProfile} onStreak={onStreak}/>{activeLecture&&<section className="overview-live-page" aria-label="Laufende Veranstaltung"><div className={'overview-live-hero'+(liveScrolled?' is-greeting':'')}><h1><span key={liveHeadingKey} className="overview-live-heading-copy">{liveHeading}</span></h1><p>{liveSubtitle}</p>{attendanceConfirm?<div className="overview-live-ratings overview-live-attendance-confirm"><button className={liveFeedback==='Ich bin da'?'is-confirmed':''} disabled={liveFeedback==='Ich bin da'} onClick={confirmLiveAttendance}>Ich bin da</button></div>:liveChoices&&<div className="overview-live-ratings"><button onClick={()=>rateLive('understood')}>Gut</button><button onClick={()=>rateLive('partial')}>Teilweise</button><button onClick={()=>rateLive('struggling')}>Gar nicht</button></div>}</div>{attendanceStrip}<div className="overview-live-next">{nextEventCard}</div></section>}<DashboardTimer data={data} onChange={onTimerChange} onSession={onSession}/>{!activeLecture&&<header className={'overview-welcome'+(welcomeScrolled?' is-compact':'')}><h1 key={welcomePrompt.id} className={'overview-welcome-rotator'+(welcomePrompt.id==='hello'?' is-hello':' is-destination')+(welcomeLeaving?' is-leaving':'')}>{welcomePrompt.id==='hello'?(data.profile?`Hallo, ${data.profile}.`:'Hallo.'):<button type="button" className="overview-welcome-action" style={{'--welcome-color':welcomePrompt.color} as CSSProperties} onClick={()=>goToWelcomeTarget(welcomePrompt.id)}><span>Schauen wir uns {welcomePrompt.possessive} <strong><span>{welcomePrompt.label}</span>{WelcomeIcon&&<i aria-hidden="true"><WelcomeIcon size={22}/></i>}</strong> an.</span></button>}</h1><p>{formatDate(day,{weekday:'long',day:'numeric',month:'long'})}</p></header>}
    {!activeLecture&&attendanceStrip}
    <section className={'overview-now-grid'+(activeLecture?' is-secondary-only':'')} aria-label="Heute und demnächst">{!activeLecture&&nextEventCard}{upcomingStack}</section>
    <section className="overview-learning-map" aria-label="Dein täglicher Lernplan"><header><div><BookOpenCheck size={18}/><span><small>Deine Route für heute</small><h2>Täglicher Lernplan</h2></span></div>{dailyStudyBundles.length>0&&<strong>{Math.round(openStudyBundles.reduce((sum,bundle)=>sum+bundle.minutes,0))} Min. offen</strong>}</header>{dailyStudyBundles.length>0?<><div className="overview-learning-route">{openStudyBundles.map(renderStudyBundle)}</div>{completedStudyBundles.length>0&&<details className="overview-learning-completed"><summary>{completedStudyBundles.length} abgeschlossen</summary><div className="overview-learning-route">{completedStudyBundles.map((bundle,index)=>renderStudyBundle(bundle,openStudyBundles.length+index))}</div></details>}</>:<div className="overview-learning-empty"><i><Check size={17}/></i><span><strong>{studyPlan.preferences.enabled?'Heute ist deine Lernroute frei.':'Der Lernplan ist pausiert.'}</strong><small>{studyPlan.preferences.enabled?'Kein Tagespaket offen – Zeit zum Durchatmen.':'Du kannst ihn in den Einstellungen wieder einschalten.'}</small></span></div>}</section>
    <section className="overview-tasks overview-tasks-focus"><header><h2><ClipboardList size={18}/>{todaysTasks.length?'Heute fällig':'Offene Aufgaben'}</h2><button onClick={()=>setAdding(true)} aria-expanded={adding} aria-haspopup="dialog"><Plus size={17}/>Aufgabe</button></header><div>{dashboardTasks.map(renderTask)}</div>{!dashboardTasks.length&&<p className="overview-quiet">Keine offenen To-dos.</p>}</section>
    {adding&&createPortal(<div className="mlh-overlay overview-task-overlay" onPointerDown={event=>{if(event.target===event.currentTarget)setAdding(false)}}><section className="mlh-sheet overview-task-dialog" role="dialog" aria-modal="true" aria-label="Aufgabe hinzufügen"><i className="mlh-sheet-handle" aria-hidden="true"/><header><h2>Aufgabe hinzufügen</h2><button type="button" aria-label="Schließen" onClick={()=>setAdding(false)}><X size={19}/></button></header><form className="overview-new-task" onSubmit={event=>{event.preventDefault();if(!title.trim())return;onAddTask(moduleId,title.trim(),dueDate||undefined);setTitle('');setDueDate('');setAdding(false)}}><label>Aufgabe<input autoFocus value={title} onChange={event=>setTitle(event.target.value)} placeholder="Was möchtest du erledigen?"/></label><label>Modul · optional<UniflowPicker label="Modul zuordnen" value={moduleId} onChange={setModuleId} options={[{value:'',label:'Allgemein – ohne Modul'},...data.modules.filter(module=>!module.hidden).map(module=>({value:module.id,label:module.name}))]}/></label><label>Termin · optional<UniflowPicker kind="date" label="Aufgabentermin" value={dueDate} onChange={setDueDate}/></label><button type="submit">Aufgabe hinzufügen</button></form></section></div>,document.body)}
    {attendanceOpen&&createPortal(<div className="overview-attendance-overlay" onPointerDown={event=>{if(event.target===event.currentTarget)setAttendanceOpen(false)}}><section className="overview-attendance-fullscreen" role="dialog" aria-modal="true" aria-label="Anwesenheit im Semester"><header><div><small>{activeSemester?.name||'Aktuelles Semester'}</small><h2>Deine Uni-Routine</h2></div><button aria-label="Monatsansicht schließen" onClick={()=>setAttendanceOpen(false)}><X size={21}/></button></header><div className="overview-attendance-legend"><span className="is-complete">Uni besucht oder frei</span><span className="is-open">Nicht besucht oder zukünftig</span></div><div className="overview-attendance-months">{attendanceMonths.map(month=><article key={month.first}><h3>{month.label}</h3><div className="overview-month-weekdays">{['Mo','Di','Mi','Do','Fr','Sa','So'].map(label=><span key={label}>{label}</span>)}</div><div className="overview-month-grid">{month.cells.map((date,index)=>{if(!date)return <i key={`empty-${index}`}/>;const attendance=attendanceFor(date);return <div key={date} className={`is-${attendance.state}${date===day?' is-today':''}`} title={`${formatDate(date,{day:'numeric',month:'long'})}: ${attendance.events?attendance.attended?'Uni besucht':'Nicht besucht':'Keine Veranstaltung'}`}><span>{Number(date.slice(8))}</span>{attendance.state==='free'||attendance.state==='complete'?<Check size={12}/>:null}</div>})}</div></article>)}</div></section></div>,document.body)}
  </main>
}
