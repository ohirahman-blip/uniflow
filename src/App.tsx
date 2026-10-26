import {SemesterAssignment} from './StudyManagement'
import {useSwipeToDismiss} from './useSwipeToDismiss'
import { createPortal } from 'react-dom'
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent, type WheelEvent as ReactWheelEvent, type ReactNode } from 'react'
import { ArrowLeft, ArrowRight, BookOpen, CalendarDays, Check, ChevronDown, Clock3, Download, Grip, Info, Plus, LayoutGrid, RotateCcw, Search, Settings2, Trash2, PauseCircle, Upload, X, LogOut, RefreshCw, Layers2, CalendarCheck2, ClipboardList, GraduationCap, PenLine, Sparkles, Star, Focus, ChevronLeft, ChevronRight, House } from 'lucide-react'
import { acronym, candidateOccurrencesOn, occurrenceAtOrigin, selectedAssessment, setOfferingAttendance, suspendOffering, undoSingleChoice, removeOfferingGroup, findMainForInactive, sameContent, linkedCandidates, chooseOffering, intersects, isAssessment, separateAssessments, addDays, colors, currentSemesterDates, emptyData, examVisibilityEnd, formatDate, fromDate, loadData, migrateLegacy, minutes, moveOccurrence, nextSemesterDates, occurrencesOn, overlaps, semesterFromStart, STORE, timeString, today, uid, upsertAssessment, weekStart, weekday, type Alternative, type Assessment, type AppData, type CalendarView, type CreditGoal, type Degree, type Occurrence, type Offering, type Repeat, type Semester, type StudyModule } from './model'
import { supabase, signOutApple, sendEmailCode, verifyEmailCode, fetchCatalog, fetchAdminAccounts, isAdmin, cloudSave, cloudLoad, updatePremium, fetchOwnPremium, type UniversityRow, type DegreeCatalogRow, type ModuleCatalogRow, type AccountRow } from './supabase'
import type { User } from '@supabase/supabase-js'
import ModuleScheduleEditor from './ModuleScheduleEditor'
import StartupSplash from './StartupSplash'
import { configurePushPreferences } from './push-notifications'
import CalendarMonthOverview from './CalendarMonthOverview'
import { shiftCalendarMonth } from './calendar-month'
import {initialCalendarDay,rememberCalendarDay} from './calendar-preferences'
import { adjacentCalendarPage, alignCalendarStart, datesForCalendarPage, twoDayRail, weekHeaderDates } from './calendar-navigation'
import UniflowPicker from './UniflowPicker'
import ModuleLearningHome from './ModuleLearningHome'
import OverviewDashboard from './OverviewDashboard'
import StudyUtilities from './StudyUtilities'
import ProfileOverlay from './ProfileOverlay'
import StreakCelebration from './StreakCelebration'
import {applyScoreAwards,streakCount} from './streaks'
import { adviceContext } from './study-advice'
import { usePremiumAdvice } from './usePremiumAdvice'
import { journeyFor, pastLessons, lessonForOccurrence, canRateOccurrence, type Journey, type LearningRating, type LearningSession, type LearningCheckin, type LessonTopic, type StudyTask } from './learning'
import { SCORE_RULES, attendancePoints, learnedPoints, understandingPoints, makeScoreEvent, normalizeBigUpdate, numberedLessons, upsertScoreEvent, type NumberedLesson } from './score'
import './styles.css'
import './calendar-week-strip.css'
import './ui-polish.css'
import './onboarding-refine.css'
import './premium-ai.css'
import './brand-theme.css'
import './dark-refinement.css'
import './form-controls.css'
import './bigupdate-social.css'
import './dashboard-update.css'
import './appearance-update.css'

type Page = 'overview' | 'dashboard' | 'calendar' | 'modules' | 'settings' | 'admin'
const pageFromUrl = (userId?: string): Page => {
  let saved: string | null = null
  try { if(userId)saved=localStorage.getItem('uniflow-last-page:'+userId) } catch { /* Storage may be unavailable. */ }
  const requested = new URLSearchParams(window.location.search).get('page') || saved
  return requested === 'calendar'||requested==='overview' ? requested : 'dashboard'
}
/** Entitlements are checked elsewhere; this component is only a visual mark. */
function BrandMark({premium,page,compact=false}:{premium:boolean;page:Page;compact?:boolean}){
  return <span aria-label={premium?'uniflow Plus':'uniflow'} className={'uf-brandmark '+(premium?'uf-brandmark--plus':'uf-brandmark--free')+(compact?' uf-brandmark--compact':'')}>
    <span className="uf-logo-word">uniflow</span>
    {premium?<span className="uf-logo-plus" key={page} aria-hidden="true"/>:<span className="uf-logo-dot" aria-hidden="true">.</span>}
  </span>
}
type NewEntry = { date: string; from: string; to: string; category?: string; recurrence?: Repeat }
type MoveProposal = { occ: Occurrence; date: string; from: string; to: string }
type ToastState = { id: string; text: string; action?: () => void; actionLabel?: string }
const programs = ['Informatik', 'Wirtschaftsinformatik', 'Betriebswirtschaftslehre', 'Maschinenbau', 'Elektrotechnik', 'Mathematik', 'Psychologie', 'Medizin', 'Rechtswissenschaften', 'Architektur', 'Biologie', 'Lehramt', 'Wirtschaftsingenieurwesen', 'Geographie', 'Design']
const universities = ['Technische Universität Berlin', 'Humboldt-Universität zu Berlin', 'Freie Universität Berlin', 'Berliner Hochschule für Technik', 'HTW Berlin', 'Universität der Künste Berlin', 'Universität Potsdam', 'Technische Universität München', 'Ludwig-Maximilians-Universität München', 'Universität Hamburg', 'Universität zu Köln', 'RWTH Aachen', 'Technische Universität Dresden', 'Universität Leipzig']
const weekNames = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So']
const formDate = (iso: string) => formatDate(iso, { day: 'numeric', month: 'long', year: 'numeric' })
const placeLabel = (offering: Offering) => [offering.room?.trim(), offering.onlineLink?.trim() ? 'Online' : ''].filter(Boolean).join(' + ')
const onlineHref = (link: string) => /^https?:\/\//i.test(link.trim()) ? link.trim() : `https://${link.trim()}`
const singleVisitLabel = (occ: Occurrence) => {
  if (occ.cancelled) return 'Fällt aus'
  if (occ.offering.recurrence === 'once') return 'Einmalig'
  const change = occ.offering.overrides?.[occ.origin]
  if (!change || change.scope === 'future') return ''
  const changedAttendance = change.selected !== undefined && change.selected !== occ.offering.selected
  const changedDate = !!change.date && change.date !== occ.origin
  const changedTime = (!!change.from && change.from !== occ.offering.from) || (!!change.to && change.to !== occ.offering.to)
  return changedAttendance || changedDate || changedTime ? 'Ausnahme' : ''
}
const ensureCredits = (txt: string) => Math.max(0, Number(txt.replace(',', '.')) || 0)
const getDefaultCredits = (level: string) => level === 'Master' ? 120 : 180
function IconButton({ children, onClick, label, disabled }: { children: ReactNode; onClick: () => void; label: string; disabled?: boolean }) { return <button className="icon-button" onClick={onClick} aria-label={label} title={label} disabled={disabled}>{children}</button> }
function BottomSheet({ children, onClose, title, footer, compactHeader = false, headerAction }: { children: ReactNode; onClose: () => void; title: string; footer?: ReactNode; compactHeader?: boolean; headerAction?:ReactNode }) { const sheet=useRef<HTMLDivElement>(null);useSwipeToDismiss(sheet,onClose);useEffect(() => { const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }; window.addEventListener('keydown', onKey); return () => window.removeEventListener('keydown', onKey) }, [onClose]); return createPortal(<div className="sheet-backdrop" onPointerDown={e => { if (e.target === e.currentTarget) onClose() }}><div ref={sheet} className="sheet" role="dialog" aria-modal="true" aria-label={title}><div className="sheet-handle" /><header className={"sheet-header "+(compactHeader?"sheet-header-compact":"")}><h2>{title}</h2>{headerAction??<IconButton onClick={onClose} label="Schließen"><X size={20} /></IconButton>}</header><div className="sheet-body">{children}</div>{footer && <footer className="sheet-footer">{footer}</footer>}</div></div>, document.body) }
function useOutsideDismiss(open: boolean, onDismiss: () => void) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const dismiss = (event: globalThis.PointerEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) onDismiss()
    }
    const esc = (event: KeyboardEvent) => { if (event.key === 'Escape') onDismiss() }
    document.addEventListener('pointerdown', dismiss, true)
    document.addEventListener('keydown', esc)
    return () => { document.removeEventListener('pointerdown', dismiss, true); document.removeEventListener('keydown', esc) }
  }, [open, onDismiss])
  return ref
}
function DateControl({value,onChange,min,max}:{value:string;onChange:(v:string)=>void;min?:string;max?:string}) {
  const [open,setOpen]=useState(false),[month,setMonth]=useState(()=>value.slice(0,7))
  const wrap=useOutsideDismiss(open,()=>setOpen(false))
  const base=fromDate(`${month}-01`), first=(base.getDay()+6)%7,last=new Date(base.getFullYear(),base.getMonth()+1,0).getDate()
  const cellDates=Array.from({length:first+last},(_,i)=>i<first?null:`${month}-${String(i-first+1).padStart(2,'0')}`)
  const shift=(num:number)=>{const date=new Date(base.getFullYear(),base.getMonth()+num,1);setMonth(`${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}`)}
  return <div className="custom-date" ref={wrap}><button className="date-trigger" type="button" aria-expanded={open} onClick={()=>{setMonth(value.slice(0,7));setOpen(v=>!v)}}>{formDate(value)}<ChevronDown size={17}/></button>
    {open&&<div className="date-panel"><div className="date-panel-head"><button type="button" onClick={()=>shift(-1)} aria-label="Vorheriger Monat"><ArrowLeft size={17}/></button><strong>{base.toLocaleDateString('de-DE',{month:'long',year:'numeric'})}</strong><button type="button" onClick={()=>shift(1)} aria-label="Nächster Monat"><ArrowRight size={17}/></button></div><div className="date-grid">{weekNames.map(d=><span key={d}>{d}</span>)}{cellDates.map((d,i)=>d?<button type="button" key={d} className={d===value?'picked':''} disabled={(!!min&&d<min)||(!!max&&d>max)} onClick={()=>{onChange(d);setOpen(false)}}>{Number(d.slice(-2))}</button>:<span key={`blank-${i}`}/>)}</div></div>}
  </div>
}
type Catalog = { universities: UniversityRow[]; degrees: DegreeCatalogRow[]; modules: ModuleCatalogRow[] }
const emptyCatalog: Catalog = { universities: [], degrees: [], modules: [] }
function isValidWorkspace(value: unknown): value is AppData {
  if (!value || typeof value !== 'object') return false
  const item = value as Partial<AppData>
  return Array.isArray(item.degrees) && Array.isArray(item.semesters) && Array.isArray(item.modules) && Array.isArray(item.offerings)
}
function normalizeWorkspace(value: AppData): AppData {
  const offers = value.offerings.map(o => ({ ...o, organizer: o.organizer || '', contentId: o.contentId || o.familyId || o.id, overrides: o.overrides || {} }))
  const legacy = Array.isArray(value.alternatives) ? value.alternatives : []
  for (const a of legacy) {
    if (offers.some(o => o.id === a.id)) continue
    const parent = offers.find(o => o.id === a.parentOfferingId || o.familyId === a.parentOfferingId)
    if (!parent) continue
    // Older alternatives were metadata, not real events. Upgrade exactly once.
    offers.push({ id: a.id, familyId: undefined,
      contentId: a.kind === 'group' ? (parent.contentId || parent.id) : a.id,
      semesterId: parent.semesterId, moduleId: a.moduleId, name: a.name,
      category: a.category, date: a.date, endDate: a.recurrence === 'once' || !a.recurrence ? a.date : a.endDate || parent.endDate,
      from: a.from, to: a.to, recurrence: a.recurrence || 'once',
      overrides: {}, room: a.room, organizer: '', selected: false })
  }
  const theme=value.theme==='light'?'light':'dark'
  return normalizeBigUpdate(separateAssessments({ ...emptyData, ...value, firstHour:0,lastHour:24,theme, themePreferenceVersion:1, weekEndDay: value.weekEndDay ?? 4,
    alternatives: [], creditGoals:Array.isArray(value.creditGoals)?value.creditGoals:[], offerings: offers, assessments: Array.isArray(value.assessments) ? value.assessments : [] }))
}
const EMAIL_OTP_LENGTH = 8

function AuthScreen() {
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [stage, setStage] = useState<'email' | 'code'>('email')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [cooldown, setCooldown] = useState(0)
  useEffect(() => {
    if (cooldown <= 0) return
    const timer = window.setTimeout(() => setCooldown(value => Math.max(0, value - 1)), 1000)
    return () => window.clearTimeout(timer)
  }, [cooldown])
  const requestCode = async () => {
    const address = email.trim().toLowerCase()
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(address)) { setError('Bitte gib eine gültige E-Mail-Adresse ein.'); return }
    if (cooldown > 0) return
    setBusy(true); setError('')
    try {
      await sendEmailCode(address)
      setEmail(address); setStage('code'); setCode(''); setCooldown(60)
    } catch (e) { setError(e instanceof Error ? e.message : 'Code konnte nicht gesendet werden.') }
    finally { setBusy(false) }
  }
  const checkCode = async () => {
    if (code.length !== EMAIL_OTP_LENGTH || !/^\d+$/.test(code)) { setError(`Gib bitte den ${EMAIL_OTP_LENGTH}-stelligen Code ein.`); return }
    setBusy(true); setError('')
    try { await verifyEmailCode(email, code) }
    catch (e) { setError(e instanceof Error ? e.message : 'Der Code ist ungültig oder abgelaufen.') }
    finally { setBusy(false) }
  }
  return <main className="onboarding auth-screen"><div className="aurora" aria-hidden="true"/><div className="onboard-stage">
    <div className="onboard-top"><div className="wordmark">uniflow<span className="wordmark-dot">.</span></div>{stage === 'code' && <button type="button" className="onboard-back" onClick={() => { setStage('email');setCode('');setError('') }} aria-label="E-Mail ändern"><ArrowLeft size={21}/></button>}</div>
    <div className="intro-copy auth-intro" key={stage}><span className="step-counter">DEIN KONTO</span><h1>{stage === 'email' ? <>Dein Studium.<br/>Dein Flow.</> : <>Fast<br/>geschafft.</>}</h1><p>{stage === 'email' ? 'Melde dich mit deiner E-Mail an. Ganz ohne Passwort.' : <>Wir haben einen Bestätigungscode an<br/><strong>{email}</strong> geschickt.</>}</p></div>
    <form className="onboard-bottom auth-form" onSubmit={e => { e.preventDefault();void (stage === 'email' ? requestCode() : checkCode()) }}>
      {stage === 'email' ? <label className="auth-field"><span>E-Mail-Adresse</span><input type="email" name="email" autoComplete="email" autoCapitalize="off" autoCorrect="off" required placeholder="name@beispiel.de" value={email} onChange={e => setEmail(e.target.value)}/></label>
      : <label className="auth-field"><span>Dein {EMAIL_OTP_LENGTH}-stelliger Code</span><span className="auth-otp-control">
          {/* A single native input supports continuous typing, pasting and iPhone autofill. */}
          <input className="auth-otp-input" type="text" name="otp" aria-label="Achtstelliger Bestätigungscode"
            autoComplete="one-time-code" inputMode="numeric" pattern={`[0-9]{${EMAIL_OTP_LENGTH}}`} maxLength={EMAIL_OTP_LENGTH}
            autoFocus value={code}
            onChange={e => setCode(e.target.value.replace(/\D/g, '').slice(0, EMAIL_OTP_LENGTH))}
            onPaste={e => { const pasted=e.clipboardData.getData('text'); if (pasted) { e.preventDefault(); setCode(pasted.replace(/\D/g, '').slice(0, EMAIL_OTP_LENGTH)) } }}/>
          <span className="auth-otp-grid" aria-hidden="true">
            {Array.from({length:EMAIL_OTP_LENGTH},(_,index)=><span key={index} className={'auth-otp-box'+(code[index]?' is-filled':'')+(index===code.length?' is-next':'')}>{code[index]||''}</span>)}
          </span>
        </span></label>}
      {error && <p className="auth-error" role="alert">{error}</p>}
      <button type="submit" className="onboard-next" disabled={busy || (stage === 'code' && code.length !== EMAIL_OTP_LENGTH)}>{busy ? 'Bitte warten …' : stage === 'email' ? 'Code anfordern' : 'Anmelden'} <ArrowRight size={20}/></button>
      {stage === 'code' && <button type="button" className="auth-secondary" disabled={busy || cooldown > 0} onClick={() => void requestCode()}>{cooldown > 0 ? `Neuen Code in ${cooldown} s anfordern` : 'Neuen Code senden'}</button>}
      {stage === 'email' && <p className="auth-secondary auth-apple-choice"> Apple-Anmeldung folgt später</p>}
      {stage === 'code' && <p className="auth-footnote">Du findest den Code in deiner E-Mail. Bitte prüfe auch den Spam-Ordner.</p>}
    </form>
  </div></main>
}
function AdminPanel({ user, notice, onBack }: { user: User; notice: (text: string) => void; onBack: () => void }) {
  const [accounts, setAccounts] = useState<AccountRow[]>([])
  const [accountSearch, setAccountSearch] = useState('')
  const [universityRows, setUniversityRows] = useState<UniversityRow[]>([])
  const [degreeRows, setDegreeRows] = useState<DegreeCatalogRow[]>([])
  const [moduleRows, setModuleRows] = useState<ModuleCatalogRow[]>([])
  const [newUniversity, setNewUniversity] = useState('')
  const [newDegree, setNewDegree] = useState('')
  const [universityId, setUniversityId] = useState('')
  const [level, setLevel] = useState<'Bachelor' | 'Master'>('Bachelor')
  const [credits, setCredits] = useState('180')
  const [newModule, setNewModule] = useState('')
  const [moduleCredits, setModuleCredits] = useState('6')
  const [degreeId, setDegreeId] = useState('')
  const [editingDegree, setEditingDegree] = useState<DegreeCatalogRow|null>(null)
  const [editingCatalogModule, setEditingCatalogModule] = useState<ModuleCatalogRow|null>(null)
  const [loading, setLoading] = useState(true)
  const [accountsError, setAccountsError] = useState('')
  const [catalogError, setCatalogError] = useState('')
  const refresh = async () => {
    if (!supabase) return
    setLoading(true)
    // A missing SQL migration must not block the separate catalog editor.
    const [directory, catalog] = await Promise.allSettled([fetchAdminAccounts(), fetchCatalog()])
    if (directory.status === 'fulfilled') {
      setAccounts(directory.value)
      setAccountsError('')
    } else {
      const err = directory.reason as {message?:string;details?:string;hint?:string;code?:string} | null; const message = [err?.message,err?.details,err?.hint,err?.code].filter(Boolean).join(' | ') || String(directory.reason)
      setAccountsError(message)
    }
    if (catalog.status === 'fulfilled') {
      setUniversityRows(catalog.value.universities)
      setDegreeRows(catalog.value.degrees)
      setModuleRows(catalog.value.modules)
      setCatalogError('')
    } else {
      const message = catalog.reason instanceof Error ? catalog.reason.message : String(catalog.reason)
      setCatalogError(message)
    }
    setLoading(false)
  }
  useEffect(() => { void refresh() }, [])
  const action = async (work: () => Promise<unknown>) => { try { await work(); await refresh(); notice('Gespeichert.') } catch(e) { notice(e instanceof Error?e.message:'Speichern fehlgeschlagen.') } }
  const askRemove = (name: string, actionFn: () => Promise<unknown>) => { if (window.confirm(`${name} aus dem Katalog löschen? Betroffene Zuordnungen werden ebenfalls gelöscht.`)) void action(actionFn) }
  if (!supabase) return null
  const sb = supabase
  return <div className="screen secondary-screen admin-screen"><button className="admin-mobile-back" onClick={onBack}><ArrowLeft size={17}/> Zurück zu Mehr</button><div className="page-title-row"><div><span className="overline">NUR FÜR ADMINS</span><h1>Administration.</h1><p>Studienkatalog und Premiumrechte · {user.email || 'Administrator'}</p></div></div>
    {loading && <p>Lade Verwaltung …</p>}
    {catalogError&&<div className="admin-error" role="alert"><strong>Studienkatalog konnte nicht geladen werden.</strong><small>{catalogError}</small><button onClick={()=>void refresh()}>Erneut versuchen</button></div>}
    <section className="settings-section"><h2>Konten ({accounts.length})</h2>
    {accountsError&&<div className="admin-error" role="alert"><strong>Konten konnten nicht geladen werden.</strong><p>{accountsError}</p><small>Prüfe, ob die zusätzliche SQL-Migration „20261012_uniflow_admin_repair.sql“ ausgeführt wurde und dein Konto die Rolle admin besitzt.</small><button onClick={()=>void refresh()}>Erneut versuchen</button></div>}<p className="quiet-copy">Nur E-Mail, Registrierungsdatum und Premiumrechte. Studiengang, Noten, Module und Stundenplan bleiben privat.</p><label className="admin-search"><Search size={18}/><input type="search" placeholder="E-Mail suchen" value={accountSearch} onChange={e=>setAccountSearch(e.target.value)}/></label>{accounts.filter(a=>a.email.toLowerCase().includes(accountSearch.trim().toLowerCase())).map(a=><div className="admin-list-row" key={a.user_id}><span><strong>{a.email}</strong><small>{new Date(a.created_at).toLocaleDateString('de-DE')}</small></span>{a.premium&&<BrandMark premium page="admin" compact/>}<button onClick={()=>void action(()=>updatePremium(a.user_id,!a.premium))}>{a.premium?'Premium entfernen':'Premium vergeben'}</button></div>)}</section>
    <section className="settings-section"><h2>Hochschulen</h2><form className="admin-form" onSubmit={e=>{e.preventDefault();if(newUniversity.trim())void action(async()=>{const {error}=await sb.from('university_catalog').insert({name:newUniversity.trim()});if(error)throw error;setNewUniversity('')})}}><input placeholder="Name der Hochschule" value={newUniversity} onChange={e=>setNewUniversity(e.target.value)}/><button type="submit">Hinzufügen</button></form>{universityRows.map(u=><div className="admin-list-row" key={u.id}><strong>{u.name}</strong><button onClick={()=>{const name=window.prompt('Neuer Hochschulname',u.name);if(name?.trim())void action(async()=>{const {error}=await sb.from('university_catalog').update({name:name.trim()}).eq('id',u.id);if(error)throw error})}}>Bearbeiten</button><button onClick={()=>askRemove(u.name,async()=>{const {error}=await sb.from('university_catalog').delete().eq('id',u.id);if(error)throw error})}>Löschen</button></div>)}</section>
    <section className="settings-section"><h2>Studiengänge nach Hochschule und Abschluss</h2><form className="admin-form" onSubmit={e=>{e.preventDefault();if(newDegree.trim()&&universityId)void action(async()=>{const {error}=await sb.from('degree_catalog').insert({university_id:universityId,name:newDegree.trim(),level,target_credits:+credits||180});if(error)throw error;setNewDegree('')})}}><UniflowPicker label="Hochschule" value={universityId} placeholder="Hochschule" onChange={setUniversityId} options={[{value:'',label:'Hochschule wählen'},...universityRows.map(u=>({value:u.id,label:u.name}))]}/><UniflowPicker label="Abschluss" value={level} onChange={value=>setLevel(value as 'Bachelor'|'Master')} options={[{value:'Bachelor',label:'Bachelor'},{value:'Master',label:'Master'}]}/><input placeholder="Studiengang" value={newDegree} onChange={e=>setNewDegree(e.target.value)} required/><input type="number" min="1" value={credits} onChange={e=>setCredits(e.target.value)} aria-label="LP-Ziel"/><button type="submit">Hinzufügen</button></form>{degreeRows.map(d=><div className="admin-list-row" key={d.id}><span><strong>{d.name} · {d.level}</strong><small>{universityRows.find(u=>u.id===d.university_id)?.name} · {d.target_credits} LP</small></span><button onClick={()=>setEditingDegree(d)}>Bearbeiten</button><button onClick={()=>askRemove(d.name,async()=>{const {error}=await sb.from('degree_catalog').delete().eq('id',d.id);if(error)throw error})}>Löschen</button></div>)}</section>
    <section className="settings-section"><h2>Module je Studiengang</h2><form className="admin-form" onSubmit={e=>{e.preventDefault();if(newModule.trim()&&degreeId)void action(async()=>{const {error}=await sb.from('module_catalog').insert({degree_catalog_id:degreeId,name:newModule.trim(),credits:+moduleCredits||0});if(error)throw error;setNewModule('')})}}><UniflowPicker label="Studiengang" value={degreeId} placeholder="Studiengang auswählen" onChange={setDegreeId} options={[{value:'',label:'Studiengang auswählen'},...degreeRows.map(d=>({value:d.id,label:d.name+' · '+d.level+' · '+(universityRows.find(u=>u.id===d.university_id)?.name||'')}))]}/><input placeholder="Modul" value={newModule} onChange={e=>setNewModule(e.target.value)}/><input type="number" min="0" step="0.5" value={moduleCredits} onChange={e=>setModuleCredits(e.target.value)} aria-label="LP"/><button type="submit">Hinzufügen</button></form>{moduleRows.filter(m=>!degreeId||m.degree_catalog_id===degreeId).map(m=><div className="admin-list-row" key={m.id}><span><strong>{m.name}</strong><small>{m.credits} LP · {degreeRows.find(d=>d.id===m.degree_catalog_id)?.name}</small></span><button onClick={()=>setEditingCatalogModule(m)}>Bearbeiten</button><button onClick={()=>askRemove(m.name,async()=>{const {error}=await sb.from('module_catalog').delete().eq('id',m.id);if(error)throw error})}>Löschen</button></div>)}</section>
    {editingDegree && <AdminDegreeEdit row={editingDegree} universities={universityRows} onClose={()=>setEditingDegree(null)} onSave={payload=>void action(async()=>{const {error}=await sb.from('degree_catalog').update(payload).eq('id',editingDegree.id);if(error)throw error;setEditingDegree(null)})}/>}
    {editingCatalogModule && <AdminModuleEdit row={editingCatalogModule} degrees={degreeRows} universities={universityRows} onClose={()=>setEditingCatalogModule(null)} onSave={payload=>void action(async()=>{const {error}=await sb.from('module_catalog').update(payload).eq('id',editingCatalogModule.id);if(error)throw error;setEditingCatalogModule(null)})}/>}
  </div>
}

function AdminDegreeEdit({row,universities,onClose,onSave}:{row:DegreeCatalogRow;universities:UniversityRow[];onClose:()=>void;onSave:(v:{name:string;university_id:string;level:string;target_credits:number})=>void}) {
  const [name,setName]=useState(row.name),[uni,setUni]=useState(row.university_id),[level,setLevel]=useState(row.level),[credits,setCredits]=useState(row.target_credits)
  return <BottomSheet title="Studiengang bearbeiten" onClose={onClose} footer={<button className="primary-action" onClick={()=>{if(name.trim()&&uni)onSave({name:name.trim(),university_id:uni,level,target_credits:credits})}}>Speichern</button>}><div className="editor-field"><span className="field-label">Studiengang</span><input className="line-input" value={name} onChange={e=>setName(e.target.value)}/></div><div className="editor-field"><span className="field-label">Hochschule</span><UniflowPicker label="Hochschule" value={uni} onChange={setUni} options={universities.map(u=>({value:u.id,label:u.name}))}/></div><div className="editor-field"><span className="field-label">Abschluss</span><div className="inline-toggle">{['Bachelor','Master'].map(x=><button key={x} className={level===x?'selected':''} onClick={()=>setLevel(x)}>{x}</button>)}</div></div><div className="editor-field"><span className="field-label">LP-Ziel</span><input className="line-input" type="number" min="1" max="480" value={credits} onChange={e=>setCredits(+e.target.value)}/></div></BottomSheet>
}
function AdminModuleEdit({row,degrees,universities,onClose,onSave}:{row:ModuleCatalogRow;degrees:DegreeCatalogRow[];universities:UniversityRow[];onClose:()=>void;onSave:(v:{name:string;degree_catalog_id:string;credits:number})=>void}) {
  const [name,setName]=useState(row.name),[degree,setDegree]=useState(row.degree_catalog_id),[credits,setCredits]=useState(row.credits)
  return <BottomSheet title="Katalogmodul bearbeiten" onClose={onClose} footer={<button className="primary-action" onClick={()=>{if(name.trim()&&degree)onSave({name:name.trim(),degree_catalog_id:degree,credits})}}>Speichern</button>}><div className="editor-field"><span className="field-label">Modul</span><input className="line-input" value={name} onChange={e=>setName(e.target.value)}/></div><div className="editor-field"><span className="field-label">Studiengang / Abschluss</span><UniflowPicker label="Studiengang" value={degree} onChange={setDegree} options={degrees.map(d=>({value:d.id,label:d.name+' · '+d.level+' · '+(universities.find(u=>u.id===d.university_id)?.name||'')}))}/></div><div className="editor-field"><span className="field-label">LP</span><input className="line-input" type="number" min="0" max="100" step="0.5" value={credits} onChange={e=>setCredits(+e.target.value)}/></div></BottomSheet>
}

function Onboarding({ onDone, onInfo, catalog, onSignOut }: { onDone: (data: AppData) => void; onInfo: (message: string) => void; catalog: Catalog; onSignOut: () => void }) {
  const [step, setStep] = useState(1), [name, setName] = useState(''), [degree, setDegree] = useState(''), [level, setLevel] = useState<'Bachelor' | 'Master'>('Bachelor'), [university, setUniversity] = useState(''), [programText, setProgramText] = useState(''), [uniText, setUniText] = useState(''), [semester, setSemester] = useState<'current' | 'next'>('current'), [mods, setMods] = useState<{ id: string; name: string; credits: string }[]>([]), [moduleInput, setModuleInput] = useState(''), [creditInput, setCreditInput] = useState('6')
  const catalogDegree = catalog.degrees.find(d => d.name === degree && d.level === level && catalog.universities.find(u=>u.id===d.university_id)?.name===university)
  const suggestedPrograms = catalog.degrees.length ? Array.from(new Set(catalog.degrees.filter(d=>d.level===level && (!university || catalog.universities.find(u=>u.id===d.university_id)?.name===university)).map(d=>d.name))) : programs
  const suggestedUniversities = catalog.degrees.length && degree ? catalog.universities.filter(u=>catalog.degrees.some(d=>d.university_id===u.id && d.level===level && d.name===degree)).map(u=>u.name) : catalog.universities.length ? catalog.universities.map(u=>u.name) : universities
  const suggestedModules = catalog.modules.filter(m => m.degree_catalog_id === catalogDegree?.id && !mods.some(x=>x.name.toLowerCase()===m.name.toLowerCase()))
  const chosenDates = semester === 'current' ? currentSemesterDates() : nextSemesterDates()
  function addMod() { const val = moduleInput.trim(); if (!val) return; if (mods.some(x => x.name.toLowerCase() === val.toLowerCase())) { onInfo('Dieses Modul steht bereits in der Liste.'); return } setMods(s => [...s, { id: uid(), name: val, credits: creditInput }]); setModuleInput(''); setCreditInput('6') }
  function finish() { const degreeId = uid(), semesterId = uid(); const newDegree: Degree = { id: degreeId, name: degree, level, university, targetCredits: catalogDegree?.target_credits || getDefaultCredits(level) }; const newSem: Semester = { id: semesterId, degreeId, ...chosenDates, archived: false }; const newMods: StudyModule[] = mods.map((m, i) => ({ id: uid(), degreeId, name: m.name, shortName: acronym(m.name), credits: ensureCredits(m.credits), color: colors[i % colors.length], emoji: '', status: 'current', grade: '', counted: true, hidden: false, semesterIds: [semesterId] })); const now=new Date().toISOString(); onDone({ ...emptyData, profile: name.trim(), degrees: [newDegree], activeDegreeId: degreeId, semesters: [newSem], activeSemesterId: semesterId, modules: newMods, scoreEvents:newMods.map(module=>makeScoreEvent({id:`module-created:${module.id}`,moduleId:module.id,type:'module-created',basePoints:SCORE_RULES.moduleCreated,occurredAt:now,sourceId:module.id,label:'Startbonus'})), lastUpdate: Date.now() }) }
  function forward() { if (step === 1 && !name.trim()) return; if (step === 2 && (!degree.trim() || !university.trim())) return; if (step === 4) { finish(); return } setStep(s => s + 1) }
  const canGo = step !== 1 || !!name.trim(); const canNext = step !== 2 || !!(degree.trim() && university.trim())
  return <main className="onboarding" key="onboarding"><div className="aurora" aria-hidden="true" /><div className="onboard-stage"><div className="onboard-top"><div className="onboard-brand-row">{step > 1 && step < 5 && <button className="onboard-back inline-back" onClick={() => setStep(s => s - 1)} aria-label="Zurück"><ArrowLeft size={20} /></button>}<div className="wordmark">uniflow<span className="wordmark-dot">.</span></div></div><button className="onboard-signout" onClick={onSignOut}>Abmelden</button></div>
    <div key={step} className="onboard-step-motion">
    {step === 1 && <div className="onboard-copy"><span className="step-counter">01 / 04</span><h1><span className="onboard-title-line"><span>Wie heißt</span></span><span className="onboard-title-line"><span>du?</span></span></h1><p>Damit sich uniflow nach dir anfühlt.</p><input autoFocus className="hero-input" placeholder="Dein Vorname" value={name} maxLength={36} onChange={e => setName(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && name.trim()) forward() }} /></div>}
    {step === 2 && <div className="onboard-copy degree-copy"><span className="step-counter">02 / 04</span><h1><span className="onboard-title-line"><span>Was studierst</span></span><span className="onboard-title-line"><span>du, {name.trim()}?</span></span></h1><p>Und an welcher Hochschule?</p><div className="selection-group"><span className="field-label">Abschluss</span><div className="inline-toggle">{(['Bachelor', 'Master'] as const).map(l => <button key={l} className={level === l ? 'selected' : ''} onClick={() => setLevel(l)}>{l}</button>)}</div></div><div className="suggestion-wrap"><span className="field-label">Studiengang</span><input className="line-input" value={degree || programText} onChange={e => { setDegree(''); setProgramText(e.target.value) }} placeholder="Studiengang suchen" /><div className="suggestions">{suggestedPrograms.filter(p => p.toLowerCase().includes((degree || programText).toLowerCase())).slice(0, degree ? 0 : 5).map(p => <button key={p} onClick={() => { setDegree(p); setProgramText('') }}>{p}<ArrowRight size={15} /></button>)}{!degree && programText.trim() && !suggestedPrograms.some(p => p.toLowerCase() === programText.toLowerCase()) && <button className="suggest-custom" onClick={() => { setDegree(programText.trim()); setProgramText('') }}>„{programText}“ verwenden<Plus size={15} /></button>}</div></div><div className="suggestion-wrap"><span className="field-label">Hochschule</span><input className="line-input" value={university || uniText} onChange={e => { setUniversity(''); setUniText(e.target.value) }} placeholder="Hochschule suchen" /><div className="suggestions">{suggestedUniversities.filter(u => u.toLowerCase().includes((university || uniText).toLowerCase())).slice(0, university ? 0 : 4).map(u => <button key={u} onClick={() => { setUniversity(u); setUniText('') }}>{u}<ArrowRight size={15} /></button>)}{!university && uniText.trim() && !suggestedUniversities.some(u => u.toLowerCase() === uniText.toLowerCase()) && <button onClick={() => { setUniversity(uniText.trim()); setUniText('') }}>„{uniText}“ verwenden<Plus size={15} /></button>}</div></div><p className="micro-note">{catalogDegree ? `${catalogDegree.target_credits} LP laut uniflow-Katalog · im Profil änderbar` : `LP-Ziel vorläufig ${getDefaultCredits(level)} LP. Unbekannte Kombinationen kannst du manuell eintragen.`}</p></div>}
    {step === 3 && <div className="onboard-copy"><span className="step-counter">03 / 04</span><h1><span className="onboard-title-line"><span>Welches</span></span><span className="onboard-title-line"><span>Semester?</span></span></h1><p>Wir beginnen dort, wo du gerade stehst.</p><div className="semester-choices">{([{ key: 'current', data: currentSemesterDates(), caption: 'Jetzt' }, { key: 'next', data: nextSemesterDates(), caption: 'Als Nächstes' }] as const).map(x => <button key={x.key} className={'semester-choice ' + (semester === x.key ? 'chosen' : '')} onClick={() => setSemester(x.key)}><span className="tiny-overline">{x.caption}</span><strong>{x.data.name}</strong><small>{formDate(x.data.start)} – {formDate(x.data.end)}</small>{semester === x.key && <Check size={21} />}</button>)}</div><p className="micro-note">Die Semestergrenzen sind zunächst Standardwerte. Offizielle Vorlesungszeiten kannst du später anpassen.</p></div>}
    {step === 4 && <div className="onboard-copy modules-copy"><span className="step-counter">04 / 04</span><h1><span className="onboard-title-line"><span>Deine Module.</span></span></h1><p>Trag einfach die Module ein, die du dieses Semester hast.</p><form className="onboard-add" onSubmit={e => { e.preventDefault(); addMod() }}><input value={moduleInput} onChange={e => setModuleInput(e.target.value)} placeholder="Modulname" /><input value={creditInput} type="number" min="0" max="90" step="0.5" onChange={e => setCreditInput(e.target.value)} aria-label="Leistungspunkte" /><span>LP</span><button type="submit" aria-label="Modul hinzufügen"><Plus size={22} /></button></form>{suggestedModules.length>0 && <div className="onboard-module-suggestions"><span className="field-label">Vorschläge für deinen Studiengang</span>{suggestedModules.filter(m=>m.name.toLowerCase().includes(moduleInput.toLowerCase())).slice(0,5).map(m=><button key={m.id} onClick={()=>{setModuleInput(m.name);setCreditInput(String(m.credits))}}>{m.name} <small>{m.credits} LP</small></button>)}</div>}<div className="onboard-module-list">{mods.length === 0 && <p>Du kannst Module auch später hinzufügen.</p>}{mods.map(m => <div key={m.id}><span>{m.name}</span><span>{m.credits} LP</span><button onClick={() => setMods(x => x.filter(i => i.id !== m.id))} aria-label={`${m.name} entfernen`}><X size={18} /></button></div>)}</div></div>}
    </div>
    <div className="onboard-bottom"><button className="onboard-next" disabled={!canGo || !canNext} onClick={forward}>{step === 1 ? "Los geht's" : step === 4 ? 'Zum Stundenplan' : 'Weiter'}<ArrowRight size={20} /></button>{step === 1 && <p className="onboarding-logged-in">Dein Konto ist bereits angemeldet.</p>}</div>
  </div></main>
}
function EntryEditor({ initial, modules, semester, onSave, onClose, onCreateModule }: { initial: NewEntry; modules: StudyModule[]; semester: Semester; onSave: (o: Offering) => void; onClose: () => void; onCreateModule: (name: string, credits: number) => string }) {
  const [moduleId,setModuleId]=useState(modules[0]?.id||'')
  const [picker,setPicker]=useState(!modules.length)
  const [draftModule,setDraftModule]=useState('')
  const [draftCredits,setDraftCredits]=useState('6')
  const [search,setSearch]=useState('')
  const [entryDate,setEntryDate]=useState(initial.date)
  const [from,setFrom]=useState(initial.from)
  const [to,setTo]=useState(initial.to)
  const [repeat,setRepeat]=useState<Repeat>(initial.recurrence||(initial.category&&isAssessment(initial.category)?'once':'weekly'))
  const [category,setCategory]=useState(initial.category||'Vorlesung')
  const [content,setContent]=useState('')
  const [end,setEnd]=useState(semester.lectureEnd)
  const [room,setRoom]=useState('')
  const [onlineLink,setOnlineLink]=useState('')
  const [organizer,setOrganizer]=useState('')
  const [err,setErr]=useState('')
  const current=modules.find(m=>m.id===moduleId)
  const categoryChoices=['Vorlesung','Übung','Tutorium','Seminar','Praktikum','Freies Lernen']
  const categoryOptions=[...(!categoryChoices.includes(category)?[category]:[]),...categoryChoices]
  const setEntryDay=(day:number)=>{
    let next=addDays(weekStart(entryDate),day)
    if(next<semester.start)next=addDays(semester.start,(day-weekday(semester.start)+7)%7)
    if(next<=semester.end)setEntryDate(next)
  }
  const save=()=>{
    const kind=category.trim()
    if(!kind)return setErr('Bitte gib eine Veranstaltungsart an.')
    if(!moduleId&&kind!=='Freies Lernen')return setErr('Bitte wähle zuerst ein Modul.')
    if(entryDate<semester.start||entryDate>semester.end)return setErr('Das Datum liegt außerhalb des Semesters.')
    if(minutes(to)<=minutes(from))return setErr('Das Ende muss nach dem Beginn liegen.')
    if(repeat!=='once'&&end<entryDate)return setErr('Das Wiederholungsende liegt vor dem ersten Termin.')
    onSave({
      id:uid(),semesterId:semester.id,moduleId:moduleId||'',
      name:current?.name||kind,category:kind,
      ...(content.trim()?{contentLabel:content.trim()}:{}),
      date:entryDate,endDate:repeat==='once'?entryDate:end,
      from,to,recurrence:repeat,overrides:{},room,
      onlineLink:onlineLink.trim(),organizer,selected:true
    })
  }
  return <BottomSheet title="Neuer Termin" onClose={onClose} footer={<button className="primary-action" onClick={save}>Hinzufügen <ArrowRight size={19}/></button>}>
    <div className="uf-entry-form">
      <div className="uf-entry-grid">
        <div className="uf-entry-field"><span className="field-label">{repeat==='once'?'Datum':'Wochentag'}</span>{repeat==='once'?<UniflowPicker kind="date" label="Datum" value={entryDate} min={semester.start} max={semester.end} onChange={setEntryDate}/>:<UniflowPicker label="Wochentag" value={String(weekday(entryDate))} options={['Montags','Dienstags','Mittwochs','Donnerstags','Freitags','Samstags','Sonntags'].map((label,index)=>({value:String(index),label}))} onChange={value=>setEntryDay(Number(value))}/>}</div>
        <div className="uf-entry-field"><span className="field-label">Modul</span>
          <button type="button" className="uf-entry-module-choice" aria-expanded={picker} onClick={()=>setPicker(v=>!v)}><span>{current?.name||'Modul auswählen'}</span><ChevronDown size={17}/></button>
          {picker&&<div className="module-dropdown"><label className="search-field"><Search size={17}/><input placeholder="Module suchen" value={search} onChange={e=>setSearch(e.target.value)}/></label><div className="module-pick-list">
            {modules.filter(m=>m.name.toLowerCase().includes(search.toLowerCase())).map(m=><button type="button" key={m.id} onClick={()=>{setModuleId(m.id);setPicker(false)}}><span className="color-mark" style={{background:m.color}}/>{m.name}{m.id===moduleId&&<Check size={16}/>}</button>)}
            <button type="button" onClick={()=>{setModuleId('');setCategory('Freies Lernen');setPicker(false)}}><BookOpen size={16}/> Ohne Modul (Freies Lernen)</button>
          </div>
          <form className="quick-new-module" onSubmit={e=>{e.preventDefault();if(!draftModule.trim())return;const id=onCreateModule(draftModule.trim(),ensureCredits(draftCredits));setModuleId(id);setDraftModule('');setPicker(false)}}>
            <input placeholder="+ Neues Modul" value={draftModule} onChange={e=>setDraftModule(e.target.value)}/>
            <input type="number" aria-label="Leistungspunkte" min="0" step="0.5" value={draftCredits} onChange={e=>setDraftCredits(e.target.value)}/><span>LP</span>
            <button type="submit" aria-label="Modul erstellen"><Plus size={18}/></button>
          </form></div>}
        </div>
      </div>
      <div className="uf-entry-grid">
        <div className="uf-entry-field"><span className="field-label">Inhalt <span className="optional">optional</span></span><input className="line-input" placeholder="z. B. Vorlesung Teil 1" value={content} onChange={e=>setContent(e.target.value)}/></div>
        <div className="uf-entry-field"><span className="field-label">Art</span><UniflowPicker label="Veranstaltungsart" value={category} allowCustom options={categoryOptions.map(value=>({value,label:value}))} onChange={setCategory}/></div>
      </div>
      <div className="uf-entry-grid">
        <div className="uf-entry-field"><span className="field-label">Beginn</span><UniflowPicker kind="time" label="Beginn" value={from} onChange={setFrom}/></div>
        <div className="uf-entry-field"><span className="field-label">Ende</span><UniflowPicker kind="time" label="Ende" value={to} onChange={setTo}/></div>
      </div>
      <div className="uf-entry-grid">
        <div className="uf-entry-field"><span className="field-label">Wiederholung</span><UniflowPicker label="Wiederholung" value={repeat} onChange={value=>setRepeat(value as Repeat)} options={[{value:'once',label:'Einmalig'},{value:'weekly',label:'Wöchentlich'},{value:'biweekly',label:'Alle 2 Wochen'}]}/></div>
        {repeat!=='once'&&<div className="uf-entry-field"><span className="field-label">Ab</span><UniflowPicker kind="date" label="Ab" value={entryDate} min={semester.start} max={end} onChange={setEntryDate}/></div>}
      </div>
      {repeat!=='once'&&<div className="uf-entry-grid"><div className="uf-entry-field"><span className="field-label">Bis</span><UniflowPicker kind="date" label="Bis" value={end} min={entryDate} max={semester.end} onChange={setEnd}/></div></div>}
      <div className="uf-entry-grid">
        <div className="uf-entry-field"><span className="field-label">Raum</span><input className="line-input room-input" placeholder="z. B. MA 041" value={room} onChange={e=>setRoom(e.target.value)}/></div>
        <div className="uf-entry-field"><span className="field-label">Lehrperson</span><input className="line-input" placeholder="Name" value={organizer} onChange={e=>setOrganizer(e.target.value)}/></div>
        <div className="uf-entry-field uf-entry-full"><span className="field-label">Online-Link</span><input className="line-input" type="url" inputMode="url" placeholder="https://..." value={onlineLink} onChange={e=>setOnlineLink(e.target.value)}/></div>
      </div>
      {err&&<div className="inline-error" role="alert">{err}</div>}
    </div>
  </BottomSheet>
}
/** Unlike a scheduled teaching event, an assessment lives on a calendar date
 * and never has a recurring group, attendance or a Wallet stack. */
function AssessmentEditor({initial,existing,modules,semester,onSave,onClose,onDelete}:{
  initial:{date:string;from:string;to:string;type:'exam'|'homework';moduleId?:string};
  existing?:Assessment;modules:StudyModule[];semester:Semester;
  onSave:(a:Assessment)=>void;onClose:()=>void;onDelete?:()=>void
}) {
  const [type,setType]=useState<'exam'|'homework'>(existing?.type||initial.type)
  const [title,setTitle]=useState(existing?.title||'')
  const [date,setDate]=useState(existing?.date||initial.date||today())
  const [hasDeadline,setHasDeadline]=useState(existing?!!existing.date:true)
  const [notes,setNotes]=useState(existing?.notes||'')
  const [moduleId,setModuleId]=useState(existing?.moduleId||initial.moduleId||modules[0]?.id||'')
  const [picker,setPicker]=useState(false)
  const [hasTime,setHasTime]=useState(!!(existing ? existing.from : initial.type==='exam'))
  const [from,setFrom]=useState(existing?.from||initial.from)
  const [to,setTo]=useState(existing?.to||initial.to)
  const [completed,setCompleted]=useState(existing?.completed||false)
  const [err,setErr]=useState('')
  const chosen=modules.find(m=>m.id===moduleId)
  const save=()=>{
    if (!title.trim()) return setErr('Gib bitte einen Titel ein.')
    if ((type==='exam'||hasDeadline)&&!date) return setErr('Wähle bitte ein Datum aus.')
    if ((type==='exam'||hasDeadline)&&hasTime && minutes(to)<=minutes(from)) return setErr('Das Ende muss nach dem Beginn liegen.')
    onSave({id:existing?.id||uid(),semesterId:existing?.semesterId||semester.id,moduleId,type,title:title.trim(),date:type==='exam'||hasDeadline?date:'',notes:notes.trim()||undefined,
      from:(type==='exam'||hasDeadline)&&hasTime?from:undefined,to:(type==='exam'||hasDeadline)&&hasTime?to:undefined,completed,componentId:existing?.componentId,selected:existing?.selected,weight:existing?.weight})
  }
  return <BottomSheet title={existing?'Eintrag bearbeiten':type==='exam'?'Neue Prüfung':'Neue Hausaufgabe'} onClose={onClose}
    footer={<button className="primary-action" onClick={save}>{existing?'Speichern':'Hinzufügen'}<Check size={18}/></button>}>
    <div className="uf-entry-form">
    <div className="editor-field"><span className="field-label">Art</span><UniflowPicker label="Eintragsart" value={type} options={[{value:'exam',label:'Prüfung'},{value:'homework',label:'Hausaufgabe'}]} onChange={value=>{setType(value as 'exam'|'homework');setHasTime(value==='exam')}}/></div>
    <div className="editor-field"><span className="field-label">Titel</span><input autoFocus className="line-input" value={title} placeholder={type==='exam'?'z. B. Analysis 1 – Prüfung':'z. B. Übungsblatt 4 abgeben'} onChange={e=>setTitle(e.target.value)}/></div>
    <div className="editor-field"><span className="field-label">Modul</span><button className="big-choice" onClick={()=>setPicker(v=>!v)}><span>{chosen?.name||'Kein Modul'}</span><ChevronDown size={18}/></button>
      {picker&&<div className="module-dropdown"><div className="module-pick-list"><button onClick={()=>{setModuleId('');setPicker(false)}}>Ohne Modul</button>
        {modules.map(m=><button key={m.id} onClick={()=>{setModuleId(m.id);setPicker(false)}}><span className="color-mark" style={{background:m.color}}/>{m.name}</button>)}</div></div>}
    </div>
    {type==='homework'&&<div className="editor-field"><button className={'assessment-time-switch '+(hasDeadline?'enabled':'')} onClick={()=>setHasDeadline(value=>!value)}><CalendarDays size={17}/>{hasDeadline?'Abgabetermin angegeben':'Abgabetermin hinzufügen'}<span>{hasDeadline?'Entfernen':'Optional'}</span></button></div>}
    {(type==='exam'||hasDeadline)&&<div className="editor-field"><span className="field-label">{type==='exam'?'Prüfungstag':'Abgabedatum'}</span><UniflowPicker kind="date" label={type==='exam'?'Prüfungstag':'Abgabedatum'} value={date} min={semester.start} max={type==='exam'?examVisibilityEnd(semester):semester.end} onChange={setDate}/>{type==='exam'&&<small className="setting-hint">Prüfungen können noch bis einen Monat nach Semesterende stattfinden.</small>}</div>}
    {(type==='exam'||hasDeadline)&&<div className="editor-field"><button className={'assessment-time-switch '+(hasTime?'enabled':'')} onClick={()=>setHasTime(v=>!v)}><Clock3 size={17}/> {hasTime?'Uhrzeit angegeben':'Uhrzeit hinzufügen'}<span>{hasTime?'Entfernen':'Optional'}</span></button></div>}
    {(type==='exam'||hasDeadline)&&hasTime&&<div className="uf-entry-grid"><div className="uf-entry-field"><span className="field-label">Beginn</span><UniflowPicker kind="time" label="Beginn" value={from} onChange={setFrom}/></div><div className="uf-entry-field"><span className="field-label">Ende</span><UniflowPicker kind="time" label="Ende" value={to} onChange={setTo}/></div></div>}
    <label className="editor-field"><span className="field-label">Notizen · optional</span><textarea className="assessment-notes-input" rows={3} value={notes} onChange={event=>setNotes(event.target.value)} placeholder="Was möchtest du dir dazu merken?"/></label>
    {<button className={'assessment-check '+(completed?'completed':'')} onClick={()=>setCompleted(v=>!v)}><span>{completed?<Check size={15}/>:null}</span>{completed?'Erledigt':'Als erledigt markieren'}</button>}
    {existing&&onDelete&&<button className="danger-simple" onClick={onDelete}><Trash2 size={18}/> {type==='exam'?'Prüfung':'Hausaufgabe'} löschen</button>}
    {err&&<p className="inline-error" role="alert">{err}</p>}
    </div>
  </BottomSheet>
}

/** A calendar assessment opens in preview mode; editing is a separate action. */
function AssessmentPreview({item,module,onToggle,onEdit,onClose}:{
  item:Assessment;module?:StudyModule;onToggle:()=>void;onEdit:()=>void;onClose:()=>void
}){
  return <BottomSheet title={item.type==='exam'?'Prüfung':'Hausaufgabe'} onClose={onClose}
    footer={<button type="button" className="primary-action" onClick={onEdit}><PenLine size={17}/> Bearbeiten</button>}>
    <div className="uf-assessment-preview">
      <span className="uf-assessment-preview-kind">{item.type==='exam'?<GraduationCap size={16}/>:<ClipboardList size={16}/>}
        {item.type==='exam'?'Prüfung':'Hausaufgabe'}</span>
      <h2>{item.title}</h2>
      {module&&<p>{module.name}</p>}
      {item.date&&<p>{formDate(item.date)}{item.from?' · '+item.from+(item.to?'–'+item.to:'')+' Uhr':''}</p>}
      {item.notes&&<p className="assessment-notes-copy">{item.notes}</p>}
      <button type="button" role="checkbox" aria-checked={!!item.completed}
        className={'assessment-check uf-assessment-preview-toggle '+(item.completed?'completed':'')}
        onClick={onToggle}>
        <span>{item.completed?<Check size={15}/>:null}</span>
        {item.completed?'Erledigt – rückgängig machen':'Als erledigt markieren'}
      </button>
    </div>
  </BottomSheet>
}
function EventDetails({occ,module,modules,offerings,data,onClose,onDelete,onSuspend,onRestore,onMove,onEdit,onAddAlternative,onSelectAlternative,onInspectAlternative}: {
  occ:Occurrence;module?:StudyModule;modules:StudyModule[];offerings:Offering[];data:AppData;
  onClose:()=>void;onDelete:()=>void;onSuspend:()=>void;onRestore:()=>void;onMove:()=>void;onEdit:()=>void;
  onAddAlternative:(kind:'slot'|'group')=>void;onSelectAlternative:(alt:Occurrence)=>void;onInspectAlternative:(alt:Occurrence)=>void;
}) {
  const [expanded,setExpanded]=useState<Record<'slot'|'group',boolean>>({slot:true,group:true})
  const linked=linkedCandidates(offerings,occ)
  const isLecture=!!occ.offering.moduleId&&!isAssessment(occ.offering.category)&&occ.offering.category!=='Freies Lernen'
  const lesson=isLecture?lessonForOccurrence(occ,data):null
  const lectureCheckin=lesson?(data.learningCheckins||[]).find(x=>x.key===lesson.key):undefined
  const lectureAttended=!!lectureCheckin&&(lectureCheckin.attended??lectureCheckin.rating!=='absent')
  const groupCount=offerings.filter(o=>o.id!==occ.offering.id && o.semesterId===occ.offering.semesterId && o.moduleId===occ.offering.moduleId && (o.contentId||o.familyId||o.id)===(occ.offering.contentId||occ.offering.familyId||occ.offering.id)).length
  const block=(kind:'slot'|'group',title:string,explanation:string)=>{
    const list=linked.filter(x=>x.kind===kind)
    const open=expanded[kind]
    return <div className={'alternative-section '+(open?'expanded':'')} key={kind}>
      <button className="alternative-toggle" aria-expanded={open} onClick={()=>setExpanded(previous=>({...previous,[kind]:!open}))}><span><strong>{title}</strong><small>{list.length?`${list.length} verfügbar`:'Keine Alternativen'}</small></span><ChevronDown className="alternative-chevron" size={20}/></button>
      <div className="alternative-reveal" aria-hidden={!open}><div className="alternative-inner"><p className="alternative-explainer">{explanation}</p>
        {list.map(({occ:alt})=>{
          const m=modules.find(m=>m.id===alt.offering.moduleId)
          return <div className="alternative-option" key={alt.key}>
            <div className="alternative-option-top"><span className="color-mark" style={{background:m?.color||'#888'}}/><strong>{m?.name||alt.offering.name}</strong>{alt.offering.organizer&&<span className="group-lecturer">{alt.offering.organizer}</span>}</div>
            <small>{formatDate(alt.date,{weekday:'short',day:'numeric',month:'short'})} · {alt.from}–{alt.to} · {alt.offering.category} · {alt.offering.recurrence==='biweekly'?'14-täglich':alt.offering.recurrence==='weekly'?'Wöchentlich':'Einmalig'}</small>
            {(placeLabel(alt.offering)||alt.offering.organizer)&&<small className="alternative-location">{placeLabel(alt.offering)&&<>Ort: {placeLabel(alt.offering)}</>}{placeLabel(alt.offering)&&alt.offering.organizer?' · ':''}{alt.offering.organizer&&<>Veranstalter: {alt.offering.organizer}</>}</small>}
            <div className="alternative-option-actions"><button onClick={()=>onSelectAlternative(alt)}>Als Haupttermin wählen <ArrowRight size={15}/></button><button className="alternative-secondary" onClick={()=>onInspectAlternative(alt)}>Details / Bearbeiten</button></div>
          </div>
        })}
        <button className="alternative-add" onClick={()=>onAddAlternative(kind)}><Plus size={18}/>Alternative hinzufügen</button>
      </div></div>
    </div>
  }
  return <BottomSheet title={occ.offering.name} onClose={onClose} compactHeader>
    <div className="detail-category">{occ.offering.category}</div>
    <div className="detail-heading" style={{color:module?.color||'#EDEDED'}}>{module?.name||occ.offering.name}</div>
    <div className="detail-row"><CalendarDays size={18}/>{formatDate(occ.date)}</div>
    <div className="detail-row"><Clock3 size={18}/>{occ.from} – {occ.to}</div>
    {placeLabel(occ.offering)&&<div className="detail-row"><Info size={18}/>{occ.offering.room?.trim()}{occ.offering.room?.trim()&&occ.offering.onlineLink?.trim()?' + ':''}{occ.offering.onlineLink?.trim()&&<a href={onlineHref(occ.offering.onlineLink)} target="_blank" rel="noopener noreferrer">Online</a>}</div>}
    {occ.offering.organizer&&<div className="detail-row"><GraduationCap size={18}/>{occ.offering.organizer}</div>}
    <div className="detail-row"><RotateCcw size={18}/>{occ.offering.recurrence==='weekly'?'Jede Woche':occ.offering.recurrence==='biweekly'?'Alle zwei Wochen':'Einmalig'}</div>
    {singleVisitLabel(occ)==='Ausnahme'&&<div className="detail-row"><Info size={18}/>Einmalige Ausnahme</div>}
    {lesson&&<div className="detail-row"><Check size={18}/>{lectureAttended?'Als besucht markiert':'Noch nicht als besucht markiert'}</div>}
    <div className="detail-actions"><button onClick={onEdit}><Settings2 size={18}/>Bearbeiten</button><button onClick={onMove}><Grip size={19}/>Verschieben</button><button onClick={onSuspend}><PauseCircle size={18}/>Aussetzen</button><button onClick={onRestore}><RotateCcw size={18}/>Auswahl zurücknehmen</button><button className="danger-link" onClick={onDelete}><Trash2 size={18}/>Gruppe löschen</button></div>
    {block('slot','Andere Veranstaltung zur gleichen Zeit','Auch ein anderes Modul oder Freies Lernen kann hier zur Auswahl stehen.')}
    {block('group',`Gleicher Inhalt · ${groupCount+1} Gruppen`,'Die Gruppen sind gleichberechtigt: Eine auswählen oder mehrere besuchen. Keine Veranstaltung wird beim Wechsel gelöscht.')}
  </BottomSheet>
}
function AlternativeEditor({occ,kind,modules,onSave,onClose,editing,onDelete}:{
  occ:Occurrence; kind:'slot'|'group'; modules:StudyModule[];
  onSave:(offering:Offering)=>void;onClose:()=>void;editing?:Offering;onDelete?:()=>void
}) {
  const [moduleId,setModuleId]=useState(editing?.moduleId ?? (kind==='group'?occ.offering.moduleId:''))
  const [picker,setPicker]=useState(false),[search,setSearch]=useState('')
  const [category,setCategory]=useState(editing?.category || occ.offering.category)
  const [date,setDate]=useState(editing?.date || occ.date),[from,setFrom]=useState(editing?.from || occ.from),[to,setTo]=useState(editing?.to || occ.to)
  const [room,setRoom]=useState(editing?.room || ''),[onlineLink,setOnlineLink]=useState(editing?.onlineLink || ''),[organizer,setOrganizer]=useState(editing?.organizer || '')
  const [recurrence,setRecurrence]=useState<Repeat>(editing?.recurrence || (kind==='group'?'weekly':'once'))
  const [endDate,setEndDate]=useState(editing?.endDate || occ.offering.endDate),[error,setError]=useState('')
  const chosenModule=modules.find(m=>m.id===moduleId)
  const setEditDay=(day:number)=>setDate(addDays(weekStart(date),day))
  const save=()=>{
    if (kind==='group' && moduleId!==occ.offering.moduleId) return setError('Gleicher Inhalt muss zum selben Modul gehören. Für andere Module nutze die Zeit-Alternative.')
    if (!moduleId && category.trim()!=='Freies Lernen') return setError('Wähle ein Modul oder Freies Lernen.')
    if (!category.trim()) return setError('Wähle eine Veranstaltungsart.')
    if (minutes(to)<=minutes(from)) return setError('Das Ende muss nach dem Beginn liegen.')
    if (recurrence!=='once'&&endDate<date) return setError('Das Enddatum liegt vor dem Start.')
    onSave({
      ...(editing||{}),id:editing?.id||uid(),semesterId:occ.offering.semesterId,
      moduleId, name:chosenModule?.name||category, category:category.trim(),
      contentId:editing?.contentId || (kind==='group'?(occ.offering.contentId||occ.offering.id):undefined),
      date, from, to, endDate:recurrence==='once'?date:endDate, recurrence,
      room,onlineLink:onlineLink.trim(),organizer,overrides:editing?.overrides||{},selected:editing?.selected??false
    })
  }
  return <BottomSheet title={editing?'Termin bearbeiten':kind==='slot'?'Alternative zur gleichen Zeit':'Alternative Gruppe'} onClose={onClose} footer={<button className="primary-action" onClick={save}>{editing?'Speichern':'Alternative hinzufügen'}<ArrowRight size={18}/></button>}>
    <div className="uf-entry-form">
    <p className="alternative-editor-copy">{editing?'Zeit, Kategorie und Wiederholung dieses Termins ändern.':kind==='slot'?'Andere Veranstaltung im selben Zeitraum.':'Gleicher Inhalt in einer anderen Gruppe – auch an einem anderen Tag.'}</p>
    <div className="editor-field"><span className="field-label">Modul</span><button className="big-choice" disabled={kind==='group'&&!editing} onClick={()=>setPicker(x=>!x)}><span>{chosenModule?.name||(category==='Freies Lernen'?'Freies Lernen':'Modul auswählen')}</span><ChevronDown size={18}/></button>
      {picker&&<div className="module-dropdown"><label className="search-field"><Search size={18}/><input placeholder="Module suchen" value={search} onChange={e=>setSearch(e.target.value)}/></label><div className="module-pick-list">{modules.filter(m=>m.name.toLowerCase().includes(search.toLowerCase())).map(m=><button key={m.id} onClick={()=>{setModuleId(m.id);setPicker(false)}}><span className="color-mark" style={{background:m.color}}/>{m.name}</button>)}<button onClick={()=>{setModuleId('');setCategory('Freies Lernen');setPicker(false)}}><BookOpen size={17}/>Freies Lernen · ohne Modul</button></div></div>}
    </div>
    <div className="editor-field"><span className="field-label">{recurrence==='once'?'Datum':'Wochentag'}</span>{recurrence==='once'?<UniflowPicker kind="date" label="Datum" value={date} onChange={setDate}/>:<UniflowPicker label="Wochentag" value={String(weekday(date))} options={['Montags','Dienstags','Mittwochs','Donnerstags','Freitags','Samstags','Sonntags'].map((label,index)=>({value:String(index),label}))} onChange={value=>setEditDay(Number(value))}/>}</div>
    <div className="uf-entry-grid"><div className="uf-entry-field"><span className="field-label">Beginn</span><UniflowPicker kind="time" label="Beginn" value={from} onChange={setFrom}/></div><div className="uf-entry-field"><span className="field-label">Ende</span><UniflowPicker kind="time" label="Ende" value={to} onChange={setTo}/></div></div>
    <div className="editor-field"><span className="field-label">Art</span><UniflowPicker label="Veranstaltungsart" value={category} allowCustom options={[...(!['Vorlesung','Übung','Tutorium','Seminar','Praktikum','Freies Lernen'].includes(category)?[category]:[]),'Vorlesung','Übung','Tutorium','Seminar','Praktikum','Freies Lernen'].map(value=>({value,label:value}))} onChange={value=>{setCategory(value);if(value==='Freies Lernen')setModuleId('')}}/></div>
    <div className="uf-entry-grid">
      <div className="uf-entry-field"><span className="field-label">Wiederholung</span><UniflowPicker label="Wiederholung" value={recurrence} onChange={value=>setRecurrence(value as Repeat)} options={[{value:'once',label:'Einmalig'},{value:'weekly',label:'Wöchentlich'},{value:'biweekly',label:'Alle 2 Wochen'}]}/></div>
      {recurrence!=='once'&&<div className="uf-entry-field"><span className="field-label">Ab</span><UniflowPicker kind="date" label="Ab" value={date} max={endDate} onChange={setDate}/></div>}
    </div>
    {recurrence!=='once'&&<div className="editor-field"><span className="field-label">Bis</span><UniflowPicker kind="date" label="Bis" value={endDate} min={date} onChange={setEndDate}/></div>}
    <div className="editor-field"><span className="field-label">Raum <span className="optional">optional</span></span><input className="line-input room-input" value={room} onChange={e=>setRoom(e.target.value)}/></div>
    <div className="editor-field"><span className="field-label">Online-Link <span className="optional">optional</span></span><input className="line-input" type="url" inputMode="url" placeholder="https://meet.google.com/..." value={onlineLink} onChange={e=>setOnlineLink(e.target.value)}/></div>
    <div className="editor-field"><span className="field-label">Veranstalter <span className="optional">optional</span></span><input className="line-input" placeholder="Lehrperson oder Organisation" value={organizer} onChange={e=>setOrganizer(e.target.value)}/></div>
    {editing&&onDelete&&<button type="button" className="danger-simple" onClick={onDelete}><Trash2 size={18}/> Ganze Veranstaltungsreihe löschen</button>}
    {error&&<p className="inline-error" role="alert">{error}</p>}
    </div>
  </BottomSheet>
}
function Notice({ toast, onDismiss }: { toast: ToastState; onDismiss: () => void }) {
  const [leaving, setLeaving] = useState(false)
  useEffect(() => {
    const start = window.setTimeout(() => setLeaving(true), toast.action?8000:4000)
    return () => window.clearTimeout(start)
  }, [])
  useEffect(() => {
    if (!leaving) return
    const timer = window.setTimeout(onDismiss, 470)
    return () => window.clearTimeout(timer)
  }, [leaving, onDismiss])
  return <div role="status" className={'glow-notice ' + (leaving ? 'notice-leaving' : 'notice-entering')}>
    <span className="notice-message">{toast.text}</span>
    {toast.action && <button className="toast-undo" onClick={() => { toast.action?.(); onDismiss() }}>{toast.actionLabel || 'Rückgängig'}</button>}
  </div>
}

function MoveScope({ proposal, onClose, onConfirm, mode }: { proposal: MoveProposal; onClose: () => void; onConfirm: (scope: 'single' | 'future') => void; mode: 'move' | 'delete' }) { const isOnce = proposal.occ.offering.recurrence === 'once'; return <BottomSheet title={mode === 'delete' ? 'Besuch aussetzen' : 'Termin verschieben'} onClose={onClose}><div className="move-summary"><strong>{proposal.occ.offering.name}</strong><span>{mode === 'move' ? `${formatDate(proposal.date)} · ${proposal.from}–${proposal.to}` : `${formatDate(proposal.occ.date)} · ${proposal.occ.from}–${proposal.occ.to}`}</span></div><p className="scope-intro">{isOnce ? 'Diese Veranstaltung findet nur einmal statt.' : 'Welche Termine sollen geändert werden?'}</p><div className="scope-choices"><button onClick={() => onConfirm('single')}><span><strong>{isOnce ? 'Bestätigen' : 'Nur dieses Mal'}</strong><small>{mode === 'move' ? 'Nur diesen einen Termin ändern' : 'Nur diesen Besuch aussetzen'}</small></span><ArrowRight size={20} /></button>{!isOnce && <button onClick={() => onConfirm('future')}><span><strong>Alle zukünftigen Termine</strong><small>Vergangene Termine bleiben unverändert</small></span><ArrowRight size={20} /></button>}</div><button className="dismiss-action" onClick={onClose}>Abbrechen</button></BottomSheet> }

function MoveVisitEditor({occ,onClose,onConfirm}:{occ:Occurrence;onClose:()=>void;onConfirm:(proposal:MoveProposal)=>void}){
  const [date,setDate]=useState(occ.date),[from,setFrom]=useState(occ.from),[to,setTo]=useState(occ.to),[error,setError]=useState('')
  const submit=()=>{if(minutes(to)<=minutes(from)){setError('Das Ende muss nach dem Beginn liegen.');return}onConfirm({occ,date,from,to})}
  return <BottomSheet title="Termin verschieben" onClose={onClose} footer={<button className="primary-action" onClick={submit}>Weiter <ArrowRight size={18}/></button>}><div className="uf-entry-form"><div className="editor-field"><span className="field-label">Neues Datum</span><UniflowPicker kind="date" label="Neues Datum" value={date} onChange={setDate}/></div><div className="uf-entry-grid"><div className="uf-entry-field"><span className="field-label">Beginn</span><UniflowPicker kind="time" label="Beginn" value={from} onChange={setFrom}/></div><div className="uf-entry-field"><span className="field-label">Ende</span><UniflowPicker kind="time" label="Ende" value={to} onChange={setTo}/></div></div>{error&&<p className="inline-error">{error}</p>}</div></BottomSheet>
}
function DeleteSheet({proposal,onConfirm,onClose}:{proposal:MoveProposal;onConfirm:()=>void;onClose:()=>void}) {
  return <BottomSheet title="Veranstaltungsgruppe endgültig löschen?" onClose={onClose}>
    <p className="scope-intro">{proposal.occ.offering.name} · {proposal.occ.offering.organizer || 'Ohne Veranstalter'} wird vollständig aus Kalender, Modul und Alternativen entfernt. Das betrifft die ganze Reihe und lässt sich nicht rückgängig machen.</p>
    <button className="danger-simple" onClick={onConfirm}><Trash2 size={18}/> Ganze Veranstaltungsgruppe löschen</button>
    <button className="dismiss-action" onClick={onClose}>Abbrechen</button>
  </BottomSheet>
}

function ModuleEditor({ module, onClose, onSave, onDelete }: { module: StudyModule; onClose: () => void; onSave: (m: StudyModule) => void; onDelete: () => void }) { const [name, setName] = useState(module.name), [emoji,setEmoji] = useState(module.emoji || ''), [short, setShort] = useState(module.shortName), [credits, setCredits] = useState(String(module.credits)), [color, setColor] = useState(module.color), [grade, setGrade] = useState(module.grade), [status, setStatus] = useState(module.status); return <BottomSheet title="Modul bearbeiten" onClose={onClose} footer={<button className="primary-action" onClick={() => { if (name.trim()) onSave({ ...module, name: name.trim(), shortName: short.trim() || acronym(name), credits: ensureCredits(credits), color, emoji, grade, status }) }}>Änderungen speichern <Check size={19} /></button>}><div className="editor-field"><span className="field-label">Name</span><input className="line-input" value={name} onChange={e => setName(e.target.value)} /></div><div className="editor-time-row"><div className="editor-field"><span className="field-label">Kurzname</span><input className="line-input" maxLength={10} value={short} onChange={e => setShort(e.target.value)} /></div><div className="editor-field"><span className="field-label">LP</span><input className="line-input" type="number" min="0" step="0.5" value={credits} onChange={e => setCredits(e.target.value)} /></div></div><div className="editor-field"><span className="field-label">Emoji</span><input className="line-input" placeholder="Optional – z. B. 📐" value={emoji} maxLength={8} onChange={e=>setEmoji(e.target.value)}/></div><div className="editor-field"><span className="field-label">Modulfarbe</span><div className="swatches">{colors.map(c => <button key={c} style={{ background: c }} className={c === color ? 'selected' : ''} onClick={() => setColor(c)} aria-label={`Farbe ${c}`}>{c === color && <Check size={17} />}</button>)}</div></div><div className="editor-field"><span className="field-label">Status</span><div className="category-list">{([{ v: 'current', l: 'Aktuell' }, { v: 'passed', l: 'Bestanden' }, { v: 'planned', l: 'Geplant' }, { v: 'failed', l: 'Nicht bestanden' }, { v: 'recognized', l: 'Anerkannt' }] as const).map(item => <button key={item.v} onClick={() => setStatus(item.v)} className={status === item.v ? 'chosen' : ''}>{item.l}</button>)}</div></div><div className="editor-field"><span className="field-label">Note <span className="optional">optional</span></span><input className="line-input" placeholder="z. B. 1,7" value={grade} onChange={e => setGrade(e.target.value)} /></div><button className="danger-simple" onClick={onDelete}><Trash2 size={18} /> Modul löschen</button></BottomSheet> }

function ModuleGoalSheet({goal,modules,onSave,onDelete,onClose}:{goal:CreditGoal|null;modules:StudyModule[];onSave:(goal:CreditGoal)=>void;onDelete?:(id:string)=>void;onClose:()=>void}){
  const [name,setName]=useState(goal?.name||'')
  const [target,setTarget]=useState(String(goal?.targetCredits||20))
  const [moduleIds,setModuleIds]=useState<Set<string>>(new Set(goal?.moduleIds||[]))
  const toggle=(id:string)=>setModuleIds(current=>{const next=new Set(current);if(next.has(id))next.delete(id);else next.add(id);return next})
  const save=()=>{if(!name.trim())return;onSave({id:goal?.id||uid(),degreeId:goal?.degreeId||modules[0]?.degreeId||'',name:name.trim(),targetCredits:Math.max(1,ensureCredits(target)),moduleIds:[...moduleIds]})}
  return <BottomSheet title={goal?'Ziel bearbeiten':'Neues Ziel'} onClose={onClose} footer={<button className="primary-action" onClick={save}>Ziel speichern <Check size={19}/></button>}>
    <div className="module-goal-editor"><label className="editor-field"><span className="field-label">Name</span><input className="line-input" autoFocus value={name} onChange={e=>setName(e.target.value)} placeholder="z. B. Pflichtmodule"/></label><label className="editor-field"><span className="field-label">Ziel in LP</span><input className="line-input" type="number" min="1" step="0.5" value={target} onChange={e=>setTarget(e.target.value)}/></label><div className="module-goal-picks"><span className="field-label">Module für dieses Ziel</span>{modules.map(module=><label key={module.id}><input type="checkbox" checked={moduleIds.has(module.id)} onChange={()=>toggle(module.id)}/><span><strong>{module.name}</strong><small>{module.credits} LP</small></span></label>)}</div>{goal&&onDelete&&<button className="danger-simple" onClick={()=>onDelete(goal.id)}><Trash2 size={18}/> Ziel löschen</button>}</div>
  </BottomSheet>
}

function ModuleGoalDetail({goal,modules,onEdit,onClose}:{goal:CreditGoal;modules:StudyModule[];onEdit:()=>void;onClose:()=>void}){
  const assigned=goal.moduleIds.map(id=>modules.find(module=>module.id===id)).filter((module):module is StudyModule=>!!module)
  const earned=assigned.filter(module=>module.status==='passed'||module.status==='recognized').reduce((sum,module)=>sum+module.credits,0)
  return <BottomSheet title={goal.name} onClose={onClose} footer={<button className="primary-action" onClick={onEdit}>Ziel bearbeiten <PenLine size={18}/></button>}><div className="module-goal-detail-progress"><strong>{earned} / {goal.targetCredits} LP</strong><small>{Math.min(100,Math.round(earned/goal.targetCredits*100))}% erreicht</small></div><div className="module-goal-detail-list">{assigned.map(module=><div key={module.id}><span>{module.name}</span><small>{module.credits} LP · {module.status==='passed'||module.status==='recognized'?'Bestanden':module.status==='planned'||module.status==='open'?'Zukunft':'Aktuell'}</small></div>)}{!assigned.length&&<p>Diesem Ziel sind noch keine Module zugeordnet.</p>}</div></BottomSheet>
}

export function ModuleHub({ degree, modules, goals, assessments, journeys: _journeys, learningSessions, learningCheckins, lessonTopics, currentSemesterId: _currentSemesterId, creditsPassed, average, onAdd, onSaveGoal, onDeleteGoal, onReorderGoals, editing, onEdit, newName, setNewName, newCredits, setNewCredits, saveNewModule, cancelNew }: {
  degree?: Degree; modules: StudyModule[]; assessments: Assessment[]; journeys:Record<string,Journey>;learningSessions:LearningSession[];learningCheckins:LearningCheckin[];lessonTopics:LessonTopic[];currentSemesterId:string;creditsPassed:number;average:string;
  goals:CreditGoal[];onAdd:()=>void;onSaveGoal:(goal:CreditGoal)=>void;onDeleteGoal:(id:string)=>void;onReorderGoals:(ids:string[])=>void;editing:boolean;onEdit:(m:StudyModule)=>void;
  newName:string;setNewName:(s:string)=>void;newCredits:string;setNewCredits:(s:string)=>void;saveNewModule:()=>void;cancelNew:()=>void
}) {
  const [section,setSection]=useState<'current'|'activity'|'goals'|'performance'>('current')
  const [goalMode,setGoalMode]=useState<'view'|'edit'|'new'|null>(null),[activeGoalId,setActiveGoalId]=useState<string|null>(null)
  const [draggingGoal,setDraggingGoal]=useState<string|null>(null)
  const lastDragTarget=useRef<string|null>(null)
  const passed=modules.filter(m=>m.status==='passed'||m.status==='recognized')
  const planned=modules.filter(m=>m.status==='planned'||m.status==='open')
  const current=modules.filter(m=>!['passed','recognized','planned','open'].includes(m.status))
  const nextExamByModule=useMemo(()=>{
    const result=new Map<string,string>()
    for(const item of assessments){
      if(item.type!=='exam'||item.date<today()||!selectedAssessment(item,assessments))continue
      const previous=result.get(item.moduleId)
      if(!previous||item.date<previous)result.set(item.moduleId,item.date)
    }
    return result
  },[assessments])
  const sortByNextExam=(items:StudyModule[])=>[...items].sort((a,b)=>{
    const aDate=nextExamByModule.get(a.id),bDate=nextExamByModule.get(b.id)
    if(!aDate&&!bDate)return a.name.localeCompare(b.name,'de-DE')
    if(!aDate)return 1
    if(!bDate)return -1
    return aDate.localeCompare(bDate)||a.name.localeCompare(b.name,'de-DE')
  })
  const shownCurrent=sortByNextExam(current),shownPlanned=sortByNextExam(planned)
  const shownPassed=[...passed].sort((a,b)=>a.name.localeCompare(b.name,'de-DE'))
  const activeGoal=goals.find(goal=>goal.id===activeGoalId)||null
  const ratingLabel:Record<LearningRating,string>={understood:'Verstanden',partial:'Teilweise verstanden',struggling:'Noch unklar',absent:'Nicht besucht'}
  const moduleIds=useMemo(()=>new Set(modules.map(module=>module.id)),[modules])
  const topicByKey=useMemo(()=>new Map(lessonTopics.map(topic=>[topic.key,topic.title.trim()])),[lessonTopics])
  const activities=useMemo(()=>[
    ...learningSessions.filter(item=>moduleIds.has(item.moduleId)).map(item=>({
      id:'session-'+item.id,moduleId:item.moduleId,date:item.date,updatedAt:item.updatedAt,kind:'session' as const,
      title:item.kind==='exam'?'Prüfungsvorbereitung':'Lerneinheit',meta:`${item.duration} Min. · ${ratingLabel[item.rating]}`
    })),
    ...learningCheckins.filter(item=>moduleIds.has(item.moduleId)&&item.rating!=='absent').map(item=>({
      id:'checkin-'+item.key,moduleId:item.moduleId,date:item.date,updatedAt:item.updatedAt,kind:'checkin' as const,
      title:topicByKey.get(item.key)||'Thema nicht eingetragen',meta:`Vorlesung bewertet · ${ratingLabel[item.rating]}`
    }))
  ].sort((a,b)=>b.date.localeCompare(a.date)||b.updatedAt.localeCompare(a.updatedAt)),[learningSessions,learningCheckins,moduleIds,topicByKey])
  const goalProgress=(goal:CreditGoal)=>{
    const assigned=goal.moduleIds.map(id=>modules.find(module=>module.id===id)).filter((module):module is StudyModule=>!!module)
    return {
      earned:assigned.filter(module=>module.status==='passed'||module.status==='recognized').reduce((sum,module)=>sum+module.credits,0),
      current:assigned.filter(module=>module.status==='current').reduce((sum,module)=>sum+module.credits,0)
    }
  }
  const move=(items:{id:string}[],sourceId:string,targetId:string)=>{const next=[...items],from=next.findIndex(item=>item.id===sourceId),to=next.findIndex(item=>item.id===targetId);if(from<0||to<0||from===to)return next;const [item]=next.splice(from,1);next.splice(to,0,item);return next}
  const reorderGoal=(sourceId:string,targetId:string)=>onReorderGoals(move(goals,sourceId,targetId).map(item=>item.id))
  const beginGoalReorder=(event:ReactPointerEvent<HTMLButtonElement>,id:string)=>{event.preventDefault();event.stopPropagation();event.currentTarget.setPointerCapture(event.pointerId);lastDragTarget.current=id;setDraggingGoal(id)}
  const moveGoalReorder=(event:ReactPointerEvent<HTMLButtonElement>)=>{if(!draggingGoal)return;const target=document.elementFromPoint(event.clientX,event.clientY)?.closest<HTMLElement>('[data-reorder-kind="goal"]'),targetId=target?.dataset.reorderId;if(!targetId||targetId===lastDragTarget.current)return;lastDragTarget.current=targetId;reorderGoal(draggingGoal,targetId)}
  const endGoalReorder=()=>{lastDragTarget.current=null;setDraggingGoal(null)}
  const goalHandle=(id:string,label:string)=><button type="button" className="module-reorder-handle" aria-label={`${label} verschieben`} onPointerDown={event=>beginGoalReorder(event,id)} onPointerMove={moveGoalReorder} onPointerUp={endGoalReorder} onPointerCancel={endGoalReorder} onKeyDown={event=>{const index=goals.findIndex(goal=>goal.id===id),direction=event.key==='ArrowUp'||event.key==='ArrowLeft'?-1:event.key==='ArrowDown'||event.key==='ArrowRight'?1:0,target=goals[index+direction];if(direction&&target){event.preventDefault();reorderGoal(id,target.id)}}}><Grip size={17}/></button>
  const moduleRow=(m:StudyModule,isFuture=false)=>{const examDate=nextExamByModule.get(m.id);return <div key={m.id} className="module-list-row-wrap module-auto-sorted"><button className={'module-list-row '+(isFuture?'module-future':'')} onClick={()=>onEdit(m)}>
    <span className="module-emoji" style={{background:isFuture?'#292929':m.color}}>{m.emoji||<BookOpen size={19}/>}</span>
    <span className="module-main"><strong>{m.name}</strong>{examDate?<small className="module-exam-countdown"><CalendarCheck2 size={13}/>Prüfung in {Math.round((fromDate(examDate).getTime()-fromDate(today()).getTime())/86400000)} Tagen · {formDate(examDate)}</small>:<small className="module-no-exam">Keine Prüfung eingetragen</small>}</span>
  </button></div>}
  const performanceRow=(m:StudyModule,muted=false)=><button key={m.id} type="button" className={'module-performance-row'+(muted?' is-muted':'')} onClick={()=>onEdit(m)}>
    <span className="module-emoji" style={{background:muted?'#d8d8da':m.color}}>{m.emoji||<BookOpen size={18}/>}</span><span className="module-performance-copy"><strong>{m.name}</strong><small>{m.credits} LP · {m.status==='recognized'?'Anerkannt':muted?'Laufend':'Bestanden'}</small></span><span className="module-grade">{m.status==='recognized'?'Anerkannt':m.grade.trim()|| (muted?'Offen':'Bestanden')}</span><ArrowRight size={17}/>
  </button>
  const tabs=([{id:'current',label:'Aktuell'},{id:'activity',label:'Verlauf'},{id:'goals',label:'Ziele'},{id:'performance',label:'Leistung'}] as const)
  return <div className="screen secondary-screen module-hub">
    <nav className="module-section-tabs" role="tablist" aria-label="Modulbereiche">{tabs.map(tab=><button key={tab.id} type="button" role="tab" aria-selected={section===tab.id} aria-controls={`module-panel-${tab.id}`} className={section===tab.id?'active':''} onClick={()=>setSection(tab.id)}>{tab.label}</button>)}</nav>
    {editing&&<form className="module-inline-create" onSubmit={e=>{e.preventDefault();saveNewModule()}}><input autoFocus placeholder="Modulname" value={newName} onChange={e=>setNewName(e.target.value)}/><input type="number" min="0" step="0.5" aria-label="Leistungspunkte" value={newCredits} onChange={e=>setNewCredits(e.target.value)}/><span>LP</span><button type="submit"><Check size={22}/></button><IconButton label="Abbrechen" onClick={cancelNew}><X size={19}/></IconButton></form>}
    {section==='current'&&<div id="module-panel-current" className="module-tab-panel" role="tabpanel"><section className="module-group module-current-list"><div className="module-group-list">{shownCurrent.map(m=>moduleRow(m))}{current.length===0&&<div className="empty-message"><h2>Hier ist noch Platz.</h2><p>Füge dein erstes Modul hinzu.</p></div>}</div></section>{planned.length>0&&<section className="module-group"><div className="module-group-title static"><span>Später <small>{planned.length}</small></span></div><div className="module-group-list">{shownPlanned.map(m=>moduleRow(m,true))}</div></section>}</div>}
    {section==='activity'&&<div id="module-panel-activity" className="module-tab-panel" role="tabpanel"><section className="module-activity"><div className="module-panel-heading"><div><span>Dein Verlauf</span><small>{activities.length} Einträge</small></div></div>{activities.length?<div className="module-activity-list">{activities.map(item=>{const module=modules.find(entry=>entry.id===item.moduleId);return <button key={item.id} type="button" className="module-activity-row" onClick={()=>module&&onEdit(module)}><span className={'module-activity-icon '+item.kind}>{item.kind==='session'?<Clock3 size={17}/>:<Star size={17}/>}</span><span className="module-activity-copy"><strong>{item.title}</strong><small>{module?.name||'Modul'} · {item.meta}</small></span><time dateTime={item.date}>{formatDate(item.date,{day:'2-digit',month:'short',year:'numeric'})}</time><ArrowRight size={16}/></button>})}</div>:<div className="module-panel-empty"><Clock3 size={21}/><strong>Noch kein Verlauf</strong><p>Abgeschlossene Lerneinheiten und bewertete Vorlesungen erscheinen hier.</p></div>}</section></div>}
    {section==='goals'&&<div id="module-panel-goals" className="module-tab-panel" role="tabpanel"><section className="module-group module-goals"><div className="module-group-title"><span>Deine Ziele <small>{goals.length}</small></span><button type="button" aria-label="Ziel erstellen" onClick={()=>{setActiveGoalId(null);setGoalMode('new')}}><Plus size={18}/></button></div><div className="module-goal-grid">{goals.map(goal=>{const {earned,current:activeCredits}=goalProgress(goal),completedProgress=Math.min(1,earned/goal.targetCredits),activeProgress=Math.min(1,(earned+activeCredits)/goal.targetCredits);return <div key={goal.id} data-reorder-kind="goal" data-reorder-id={goal.id} className={'module-goal-card-wrap'+(draggingGoal===goal.id?' is-reordering':'')}>{goalHandle(goal.id,goal.name)}<button type="button" className="module-goal-card" onClick={()=>{setActiveGoalId(goal.id);setGoalMode('view')}}><span className="module-goal-ring"><svg viewBox="0 0 44 44" aria-hidden="true"><circle cx="22" cy="22" r="18"/><circle className="current" cx="22" cy="22" r="18" style={{strokeDashoffset:113.1*(1-activeProgress)}}/><circle className="progress" cx="22" cy="22" r="18" style={{strokeDashoffset:113.1*(1-completedProgress)}}/></svg><strong>{earned}<small>/{goal.targetCredits}</small></strong></span><span><strong>{goal.name}</strong><small>{goal.moduleIds.length} Module</small><span className="uf-visually-hidden">{activeCredits} LP aktuell in Bearbeitung</span></span></button></div>})}{!goals.length&&<button type="button" className="module-goal-empty" onClick={()=>setGoalMode('new')}><Plus size={17}/> Erstes LP-Ziel erstellen</button>}</div></section></div>}
    {section==='performance'&&<div id="module-panel-performance" className="module-tab-panel" role="tabpanel"><div className="module-degree-summary"><div><small>Leistungspunkte</small><strong>{creditsPassed} <em>/ {degree?.targetCredits || 180} LP</em></strong></div><div><small>Notendurchschnitt</small><strong>{average}</strong></div></div><section className="module-performance"><div className="module-panel-heading"><div><span>Bestanden</span><small>{passed.length} Module</small></div><button type="button" className="module-inline-add" aria-label="Modul hinzufügen" onClick={onAdd}><Plus size={16}/></button></div><div className="module-performance-list">{shownPassed.map(module=>performanceRow(module))}{!passed.length&&<p className="module-group-empty">Noch keine bestandenen Module.</p>}</div>{shownCurrent.length>0&&<><div className="module-panel-heading module-running-heading"><div><span>Laufend</span><small>Ausgegraut, aber bearbeitbar</small></div></div><div className="module-performance-list">{shownCurrent.map(module=>performanceRow(module,true))}</div></>}</section></div>}
    {goalMode==='view'&&activeGoal?<ModuleGoalDetail goal={activeGoal} modules={modules} onClose={()=>setGoalMode(null)} onEdit={()=>setGoalMode('edit')}/>:null}
    {goalMode==='new'?<ModuleGoalSheet goal={null} modules={modules} onClose={()=>setGoalMode(null)} onSave={goal=>{onSaveGoal({...goal,degreeId:degree?.id||goal.degreeId});setGoalMode(null)}}/>:goalMode==='edit'&&activeGoal?<ModuleGoalSheet goal={activeGoal} modules={modules} onClose={()=>setGoalMode(null)} onSave={goal=>{onSaveGoal({...goal,degreeId:degree?.id||goal.degreeId});setGoalMode(null)}} onDelete={id=>{onDeleteGoal(id);setGoalMode(null)}}/>:null}
  </div>
}


function calendarInk(color:string){
  const hex=color.replace('#',''),full=hex.length===3?hex.split('').map(value=>value+value).join(''):hex
  const values=[0,2,4].map(index=>parseInt(full.slice(index,index+2),16)/255).map(value=>value<=.04045?value/12.92:((value+.055)/1.055)**2.4)
  return values[0]*.2126+values[1]*.7152+values[2]*.0722>.179?'#141419':'#fafafa'
}
function Calendar({data,semester,modules,userId,focusModuleId,onFocusChange,onNew,onEditOccurrence,onRateOccurrence,onPreviewAssessment,onSelectGroup,onSuspendVisit,onCancelVisit,onRestoreVisit,onRequestDeleteOccurrence,onOfferingsChange,onNotice}:{
  data:AppData;semester:Semester;modules:StudyModule[];userId:string;focusModuleId:string;onFocusChange:(id:string)=>void;
  onNew:(slot:NewEntry)=>void;onEditOccurrence:(occ:Occurrence)=>void;onRateOccurrence:(occ:Occurrence)=>void;onPreviewAssessment:(assessment:Assessment)=>void;
  onSelectGroup:(source:Occurrence|null,target:Occurrence,scope:'single'|'future',both:boolean)=>void;
  onSuspendVisit:(occ:Occurrence,scope:'single'|'future')=>void;
  onCancelVisit:(occ:Occurrence)=>void;
  onRestoreVisit:(occ:Occurrence)=>void;
  onRequestDeleteOccurrence:(occ:Occurrence)=>void;
  onOfferingsChange:(offers:Offering[])=>void;onNotice:(text:string)=>void
}) {
  const [mode,setMode]=useState<CalendarView>(() => {
    try {
      const previous = localStorage.getItem(`uniflow-calendar-view-${userId}`)
      return previous === 'day' || previous === 'two' || previous === 'week' ? previous : 'week'
    } catch { return 'week' }
  })
  useEffect(() => {
    try { localStorage.setItem(`uniflow-calendar-view-${userId}`, mode) } catch { /* Storage may be disabled. */ }
  }, [mode, userId])
  const [anchor,setAnchor]=useState(()=>initialCalendarDay(data,semester,userId))
  useEffect(()=>rememberCalendarDay(userId,semester.id,anchor),[userId,semester.id,anchor])
  const [monthOpen,setMonthOpen]=useState(false)
  useLayoutEffect(()=>{
    if(monthOpen)return
    const key='uniflow-calendar-scroll:'+userId+':'+semester.id
    let frame=0,leaving=false
    try{const saved=Number(localStorage.getItem(key)||0);frame=requestAnimationFrame(()=>window.scrollTo({top:saved,behavior:'instant' as ScrollBehavior}))}catch{/* Storage unavailable. */}
    const save=()=>{if(leaving)return;try{localStorage.setItem(key,String(window.scrollY))}catch{/* Storage unavailable. */}}
    const leave=()=>{save();leaving=true}
    window.addEventListener('scroll',save,{passive:true})
    window.addEventListener('uniflow-calendar-leave',leave)
    return()=>{cancelAnimationFrame(frame);window.removeEventListener('scroll',save);window.removeEventListener('uniflow-calendar-leave',leave)}
  },[userId,semester.id,monthOpen])
  const [monthTransition,setMonthTransition]=useState<{from:string;direction:'next'|'previous'}|null>(null)
  const monthGesture=useRef<{x:number;y:number}|null>(null)
  const suppressMonthTap=useRef(0)
  const monthTimer=useRef<ReturnType<typeof setTimeout>|null>(null)
  const [assessmentDay,setAssessmentDay]=useState<string|null>(null)
  useEffect(()=>setAssessmentDay(null),[anchor,mode,monthOpen,focusModuleId])
  useEffect(()=>{
    if(!assessmentDay)return
    const dismiss=(event:PointerEvent)=>{if(!(event.target as Element).closest('.uf-assessment-picker,.uf-week-strip-assessments'))setAssessmentDay(null)}
    const escape=(event:KeyboardEvent)=>{if(event.key==='Escape')setAssessmentDay(null)}
    document.addEventListener('pointerdown',dismiss);window.addEventListener('keydown',escape)
    return()=>{document.removeEventListener('pointerdown',dismiss);window.removeEventListener('keydown',escape)}
  },[assessmentDay])
  const [stripPreview,setStripPreview]=useState<string|null>(null)
  const weekGesture=useRef<{x:number;y:number}|null>(null)
  const suppressWeekTap=useRef(0)
  const weekWheel=useRef({sum:0,last:0,shifted:0})
  const [proposal,setProposal]=useState<MoveProposal|null>(null),[walletMove,setWalletMove]=useState<Occurrence|null>(null),[dragUI,setDragUI]=useState<MoveProposal|null>(null),[pressed,setPressed]=useState('')
  const [focusOpen,setFocusOpen]=useState(false),[taskMenu,setTaskMenu]=useState(false),[clockNow,setClockNow]=useState(()=>new Date())
  const [motion,setMotion] = useState<'idle'|'exit-left'|'exit-right'|'exit-switch'|'enter'>('idle')
  type FanState = { occ:Occurrence; openedAt:number }
  const [fan,setFan] = useState<FanState|null>(null)
  const [fanPicked,setFanPicked] = useState<Occurrence|null>(null)
  const [walletContext,setWalletContext] = useState<{occ:Occurrence;x:number;y:number}|null>(null)
  useEffect(()=>{
    if(!assessmentDay&&!walletContext&&!fan&&!proposal&&!walletMove&&!monthOpen&&!focusOpen&&!taskMenu)return
    const onBack=(event:Event)=>{
      const detail=(event as CustomEvent<{handled:boolean}>).detail
      if(detail?.handled)return
      detail.handled=true
      if(assessmentDay)setAssessmentDay(null)
      else if(walletContext)setWalletContext(null)
      else if(fan)setFan(null)
      else if(proposal)setProposal(null)
      else if(walletMove)setWalletMove(null)
      else if(monthOpen)setMonthOpen(false)
      else if(focusOpen)setFocusOpen(false)
      else setTaskMenu(false)
    }
    window.addEventListener('uniflow-back',onBack)
    return()=>window.removeEventListener('uniflow-back',onBack)
  },[assessmentDay,fan,focusOpen,monthOpen,proposal,taskMenu,walletContext,walletMove])
  const walletRef=useRef<HTMLDivElement>(null)
  const [walletHeight,setWalletHeight]=useState(0)
  useLayoutEffect(()=>{
    if(!fan||!walletRef.current)return
    const element=walletRef.current
    const measure=()=>setWalletHeight(previous=>{const next=Math.ceil(element.getBoundingClientRect().height);return next===previous?previous:next})
    measure()
    const observer=new ResizeObserver(measure)
    observer.observe(element)
    return()=>observer.disconnect()
  },[fan,fanPicked,monthOpen])
  useEffect(()=>{
    if(!walletContext)return
    const dismiss=(e:PointerEvent)=>{if(!(e.target as Element).closest('.wallet-context-menu'))setWalletContext(null)}
    const esc=(e:KeyboardEvent)=>{if(e.key==='Escape'){e.stopPropagation();setWalletContext(null)}}
    document.addEventListener('pointerdown',dismiss)
    document.addEventListener('keydown',esc,true)
    return()=>{document.removeEventListener('pointerdown',dismiss);document.removeEventListener('keydown',esc,true)}
  },[walletContext])
  const [fanChoice,setFanChoice] = useState<'replace'|'both'|null>(null)
  const fanBoth=fanChoice==='both'
  const lastCardTap=useRef<{key:string;at:number}|null>(null)
  const openFan=(occ:Occurrence)=>{
    if(fan?.occ.key===occ.key){setFan(null);return}
    setFan({occ,openedAt:Date.now()})
    setFanPicked(occ);setFanChoice(null);setWalletContext(null)
  }
  useEffect(()=>{
    if(!fan)return
    const esc=(e:KeyboardEvent)=>{if(e.key==='Escape')setFan(null)}
    window.addEventListener('keydown',esc)
    return()=>window.removeEventListener('keydown',esc)
  },[fan])

  const motionTimers = useRef<ReturnType<typeof setTimeout>[]>([])
  const focusWrap=useOutsideDismiss(focusOpen,()=>setFocusOpen(false))
  const taskWrap=useOutsideDismiss(taskMenu,()=>setTaskMenu(false))
  const scroller=useRef<HTMLDivElement>(null)
  const scrollTimeout=useRef<ReturnType<typeof setTimeout>|null>(null)
  const gesture=useRef<{x:number;y:number;timer:ReturnType<typeof setTimeout>;active:boolean;occ?:Occurrence;source?:NewEntry;target?:NewEntry}|null>(null)
  const ignoreClick=useRef(false),scrollReset=useRef(false)
    useEffect(()=>{const t=window.setInterval(()=>setClockNow(new Date()),30000);return()=>clearInterval(t)},[])
  useEffect(()=>{const blockDrag=(e:TouchEvent)=>{if(gesture.current?.active)e.preventDefault()};document.addEventListener('touchmove',blockDrag,{passive:false,capture:true});return()=>document.removeEventListener('touchmove',blockDrag,true)},[])
  const visible=(date:string)=>candidateOccurrencesOn(data.offerings,date,false,true).filter(o=>o.offering.semesterId===semester.id&&(!focusModuleId||o.offering.moduleId===focusModuleId))
  const ghosts=(date:string)=>{
    const active=visible(date)
    return candidateOccurrencesOn(data.offerings,date,true,true).filter(o=>
      o.offering.semesterId===semester.id && (!focusModuleId||o.offering.moduleId===focusModuleId) &&
      !o.cancelled && !occurrenceAtOrigin(o.offering,o.origin,false) &&
      // An occupied slot shows alternatives in the main card's detail panel.
      !active.some(a=>intersects(a,o))
    )
  }
  const visibleDays=(start:string)=>datesForCalendarPage(start,mode,data.weekEndDay)
  // The same configured Friday/Saturday/Sunday cutoff applies to all views.
  // Keep two-day windows complete and within the selected workweek.
  const calendarPageStart=alignCalendarStart(anchor,mode,data.weekEndDay)
  // One pinned header for all modes. In week view the range is unnecessary:
  // all seven dates are equally visible, and only the real "today" is marked.
  const displayCalendarStart=stripPreview||calendarPageStart
  const stripMonday=weekStart(displayCalendarStart)
  const stripDates=weekHeaderDates(displayCalendarStart,data.weekEndDay)
  const stripIndex=Math.max(0,stripDates.indexOf(displayCalendarStart))
  const stripRangeIndex=stripIndex
  const stripRangeDays=Math.min(mode==='two'?2:1,stripDates.length-stripRangeIndex)
  useLayoutEffect(()=>{setStripPreview(null)},[calendarPageStart,mode,data.weekEndDay])
  const todayIndex=stripDates.indexOf(today())
  // Keep the outer strip mounted and slide previous/new date rows in opposite
  // directions whenever a horizontal swipe or arrow changes the displayed week.
  const [weekSlide,setWeekSlide]=useState<{from:string;direction:'left'|'right'}|null>(null)
  const previousWeek=useRef(stripMonday)
  useLayoutEffect(()=>{
    if(previousWeek.current===stripMonday)return
    const from=previousWeek.current
    previousWeek.current=stripMonday
    setWeekSlide({from,direction:stripMonday>from?'left':'right'})
  },[stripMonday])
  useEffect(()=>{
    if(!weekSlide)return
    const timeout=setTimeout(()=>setWeekSlide(null),420)
    return()=>clearTimeout(timeout)
  },[weekSlide])
  const pages=useMemo(()=>[
    adjacentCalendarPage(calendarPageStart,mode,-1,data.weekEndDay),
    calendarPageStart,
    adjacentCalendarPage(calendarPageStart,mode,1,data.weekEndDay)
  ],[calendarPageStart,mode,data.weekEndDay])
  // The 2-day timeline is ONE continuous rail: shared dates are drawn once.
  const dayRail=useMemo(()=>twoDayRail(calendarPageStart,data.weekEndDay),[calendarPageStart,data.weekEndDay])
  const snapTarget=(slot:0|1|2,width:number)=>mode==='two'
    ?dayRail.offsets[slot]*width/2
    :slot*width
  const times=Array.from({length:12},(_,i)=>i*2)
  const heightPerSlot=mode==='week'?82:114
  const height=times.length*heightPerSlot
  const offsetY=(time:string)=>minutes(time)/120*heightPerSlot
  const insertionY=fan?Math.min(height,offsetY(fan.occ.to)):Infinity
  const expansionHeight=fan?walletHeight+24:0
  const timelineHeight=height+expansionHeight
  const timelineY=(position:number)=>position+(position>=insertionY?expansionHeight:0)
  const courseEndY=(position:number)=>position+(position>insertionY?expansionHeight:0)
  const walletAccent=modules.find(module=>module.id===fan?.occ.offering.moduleId)?.color||'#a296ff'
  const nowY=offsetY(timeString(clockNow.getHours()*60+clockNow.getMinutes()))
  // Reset to the center window before the browser paints the new anchor.
  useLayoutEffect(()=>{
    const el=scroller.current;if(!el)return
    scrollReset.current=true
    el.style.scrollSnapType='none'
    el.scrollLeft=snapTarget(1,el.clientWidth)
    const frame=requestAnimationFrame(()=>{
      el.style.scrollSnapType='x mandatory'
      scrollReset.current=false
    })
    return()=>cancelAnimationFrame(frame)
  },[calendarPageStart,mode,data.weekEndDay])
  useEffect(()=>()=>{
    if(scrollTimeout.current)clearTimeout(scrollTimeout.current)
    if(monthTimer.current)clearTimeout(monthTimer.current)
    motionTimers.current.forEach(clearTimeout)
  },[])
  const animateCalendar = (update:()=>void, direction:'left'|'right'|'switch') => {
    motionTimers.current.forEach(clearTimeout)
    motionTimers.current=[]
    if(window.matchMedia('(prefers-reduced-motion: reduce)').matches){update();setMotion('idle');return}
    setMotion(direction==='switch'?'exit-switch':direction==='left'?'exit-left':'exit-right')
    motionTimers.current.push(setTimeout(()=>{
      update()
      setMotion('enter')
      motionTimers.current.push(setTimeout(()=>setMotion('idle'),220))
    },130))
  }
  const settleScroll=()=>{
    const el=scroller.current
    if(!el||scrollReset.current)return
    const targets=([0,1,2] as const).map(slot=>snapTarget(slot,el.clientWidth))
    const nearest=targets.reduce((best,point,i)=>Math.abs(point-el.scrollLeft)<Math.abs(targets[best]-el.scrollLeft)?i:best,1)
    if(nearest!==1){
      scrollReset.current=true
      setAnchor(pages[nearest])
    }
  }
  const onScroll=()=>{
    if(fan)setFan(null)
    const el=scroller.current
    if(scrollReset.current||!el)return
    // The week strip reacts during the swipe instead of waiting for settling.
    const targets=([0,1,2] as const).map(slot=>snapTarget(slot,el.clientWidth))
    const nearest=targets.reduce((best,point,i)=>
      Math.abs(point-el.scrollLeft)<Math.abs(targets[best]-el.scrollLeft)?i:best,1)
    const preview=nearest===1?null:pages[nearest]
    setStripPreview(current=>current===preview?current:preview)
    if(scrollTimeout.current)clearTimeout(scrollTimeout.current)
    scrollTimeout.current=setTimeout(settleScroll,85)
  }
  const shiftStripWeek=(direction:-1|1)=>{
    if(scrollTimeout.current)clearTimeout(scrollTimeout.current)
    setFan(null)
    // Header and timetable use the same date anchor; retain the weekday.
    setAnchor(current=>addDays(current,direction*7))
  }
  const onWeekDown=(e:ReactPointerEvent<HTMLDivElement>)=>{
    if(e.pointerType==='mouse'&&e.button!==0)return
    if(e.pointerType==='touch'&&e.clientX<=28){weekGesture.current=null;return}
    weekGesture.current={x:e.clientX,y:e.clientY}
  }
  const onWeekUp=(e:ReactPointerEvent<HTMLDivElement>)=>{
    const start=weekGesture.current
    weekGesture.current=null
    if(!start)return
    const dx=e.clientX-start.x,dy=e.clientY-start.y
    if(Math.abs(dx)<55||Math.abs(dx)<Math.abs(dy)*1.3)return
    suppressWeekTap.current=Date.now()+450
    shiftStripWeek(dx<0?1:-1)
  }
  const onWeekWheel=(e:ReactWheelEvent<HTMLDivElement>)=>{
    if(Math.abs(e.deltaX)<Math.abs(e.deltaY)*1.25)return
    const now=Date.now(),wheel=weekWheel.current
    if(now-wheel.last>220)wheel.sum=0
    wheel.sum+=e.deltaX
    wheel.last=now
    if(Math.abs(wheel.sum)<65||now-wheel.shifted<550)return
    shiftStripWeek(wheel.sum>0?1:-1)
    wheel.shifted=now
    wheel.sum=0
  }
  const shiftMonth=(direction:-1|1)=>{
    if(monthTimer.current)clearTimeout(monthTimer.current)
    setMonthTransition({from:anchor,direction:direction>0?'next':'previous'})
    setAnchor(current=>shiftCalendarMonth(current,direction))
    monthTimer.current=setTimeout(()=>setMonthTransition(null),370)
  }
  const onMonthPointerDown=(e:ReactPointerEvent<HTMLDivElement>)=>{
    if(e.pointerType==='mouse'&&e.button!==0)return
    monthGesture.current={x:e.clientX,y:e.clientY}
  }
  const onMonthPointerUp=(e:ReactPointerEvent<HTMLDivElement>)=>{
    const start=monthGesture.current
    monthGesture.current=null
    if(!start)return
    const dx=e.clientX-start.x,dy=e.clientY-start.y
    if(Math.abs(dx)<55||Math.abs(dx)<Math.abs(dy)*1.2)return
    suppressMonthTap.current=Date.now()+400
    shiftMonth(dx<0?1:-1)
  }
  const jump=(direction:number)=>{
    setFan(null)
    if(monthOpen){
      shiftMonth(direction>0?1:-1)
      return
    }
    if(scrollTimeout.current)clearTimeout(scrollTimeout.current)
    const el=scroller.current
    if(!el||window.matchMedia('(prefers-reduced-motion: reduce)').matches){
      setAnchor(pages[direction>0?2:0]);return
    }
    // Arrows animate the actual scrollable columns, just like touch swipes.
    el.scrollTo({left:snapTarget(direction>0?2:0,el.clientWidth),behavior:'smooth'})
    scrollTimeout.current=setTimeout(settleScroll,480)
  }
  const chooseStripDate=(date:string)=>{
    if(scrollTimeout.current)clearTimeout(scrollTimeout.current)
    setFan(null)
    if(mode==='week'){
      // A weekday tap drills straight into its single-day timetable.
      setMotion('idle')
      setAnchor(date)
      setMode('day')
      return
    }
    const selected=alignCalendarStart(date,mode,data.weekEndDay)
    if(selected===calendarPageStart)return
    if(selected===pages[0]){jump(-1);return}
    if(selected===pages[2]){jump(1);return}
    setAnchor(selected)
  }
  const changeMode=(next:CalendarView)=>{setFan(null);setMonthOpen(false);if(next!==mode)animateCalendar(()=>{
    setAnchor(alignCalendarStart(anchor,next,data.weekEndDay))
    setMode(next)
  },'switch')}
  const onDown=(e:ReactPointerEvent,occ?:Occurrence,source?:NewEntry)=>{
    if(e.pointerType==='mouse'&&e.button!==0)return
    ignoreClick.current=false
    const element=e.currentTarget as HTMLElement
    const timer=setTimeout(()=>{
      const g=gesture.current;if(!g)return
      g.active=true;ignoreClick.current=true
      if(occ){
        try{element.setPointerCapture(e.pointerId)}catch{}
        setPressed(occ.key);setDragUI({occ,date:occ.date,from:occ.from,to:occ.to})
      } else if(source) onNew(source)
    },430)
    gesture.current={x:e.clientX,y:e.clientY,timer,active:false,occ,source}
  }
  const targetAt=(x:number,y:number):NewEntry|undefined=>{
    const column=document.elementsFromPoint(x,y).map(el=>el.closest<HTMLElement>('[data-calendar-day]')).find(Boolean)
    if(!column)return undefined
    const date=column.dataset.calendarDay||''
    const rect=column.getBoundingClientRect()
    let relative=Math.max(0,Math.min(rect.height-1,y-rect.top))
    if(fan&&relative>=insertionY&&relative<insertionY+expansionHeight)return undefined
    if(relative>=insertionY+expansionHeight)relative-=expansionHeight
    const rowIndex=Math.floor(relative/heightPerSlot)
    const from=timeString((rowIndex*2)*60)
    return {date,from,to:timeString((rowIndex*2+2)*60)}
  }
  const onMove=(e:ReactPointerEvent)=>{
    const g=gesture.current;if(!g)return
    if(!g.active){if(Math.hypot(e.clientX-g.x,e.clientY-g.y)>12){clearTimeout(g.timer);gesture.current=null}return}
    if(g.occ){const dest=targetAt(e.clientX,e.clientY);if(dest){g.target=dest;setDragUI({occ:g.occ,...dest})}}
  }
  const onUp=(e:ReactPointerEvent)=>{
    const g=gesture.current;if(!g)return
    clearTimeout(g.timer)
    if(g.active&&g.occ){
      const target=g.target||targetAt(e.clientX,e.clientY)
      const span=minutes(g.occ.to)-minutes(g.occ.from)
      const dest=target?{...target,to:timeString(minutes(target.from)+span)}:{date:g.occ.date,from:g.occ.from,to:g.occ.to}
      if(dest.date!==g.occ.date||dest.from!==g.occ.from)setProposal({occ:g.occ,...dest})
      else onNotice('Ziehe den Termin auf einen anderen Zeitslot.')
    }
    if(g.active && g.occ)setFan(null)
    setDragUI(null);setPressed('');gesture.current=null
    setTimeout(()=>{ignoreClick.current=false},170)
  }
  const cancelGesture=()=>{if(gesture.current)clearTimeout(gesture.current.timer);gesture.current=null;setDragUI(null);setPressed('')}
  const confirmScope=(scope:'single'|'future')=>{
    if(!proposal)return
    onOfferingsChange(moveOccurrence(data.offerings,proposal.occ.offering.id,proposal.occ.origin,proposal.date,proposal.from,proposal.to,scope))
    onNotice(scope==='future'?'Alle zukünftigen Termine verschoben.':'Termin einmalig verschoben.')
    setProposal(null)
  }
  const focusChoices=modules.filter(m=>m.status==='current'&&data.offerings.some(o=>o.moduleId===m.id&&o.semesterId===semester.id))
  // The tapped slot stays in front. Other days are listed behind it, never
  // portrayed as a different appointment occurring at this slot.
  const fanItems=fan ? [fan.occ,...linkedCandidates(data.offerings,fan.occ).map(x=>x.occ)]
    .filter((item,index,list)=>list.findIndex(x=>x.key===item.key)===index) : []
  const fanSelected=fanPicked ? !fanPicked.cancelled&&occurrenceAtOrigin(fanPicked.offering,fanPicked.origin,false)!==null : false
  const fanCancelled=!!fanPicked?.cancelled
  const fanMain=fanPicked ? findMainForInactive(data.offerings,fanPicked) : null
  const fanConflict=fanPicked ? occurrencesOn(data.offerings,fanPicked.date)
    .some(other=>other.key!==fanPicked.key && intersects(other,fanPicked)) : false
  const fanRateable=!!fanPicked&&fanSelected&&!fanCancelled&&!!fanPicked.offering.moduleId&&!isAssessment(fanPicked.offering.category)&&fanPicked.offering.category!=='Freies Lernen'&&canRateOccurrence(fanPicked)
  const onFanTap=(occ:Occurrence)=>{
    const now=Date.now()
    const old=lastCardTap.current
    if((old?.key===occ.key && now-old.at<360) || (fan?.occ.key===occ.key && now-(fan?.openedAt||0)<340)) {
      lastCardTap.current=null;setFan(null);onEditOccurrence(occ);return
    }
    lastCardTap.current={key:occ.key,at:now}
    setFanPicked(occ);setFanChoice(null)
  }
  const applyFanChoice=(scope:'single'|'future')=>{
    if(!fanPicked)return
    if(fanSelected)onSuspendVisit(fanPicked,scope)
    else onSelectGroup(fanMain,fanPicked,scope,fanBoth)
    setFan(null)
  }
  function renderDay(date:string,compact:boolean){
    const activeEvents=visible(date)
    const inactiveEvents=ghosts(date)
    const events=[...activeEvents,...inactiveEvents]
    const inactiveKeys=new Set(inactiveEvents.map(o=>o.key))
    const isToday=date===today()
    const clockActive=isToday&&nowY>=0&&nowY<=height
    return <div className="day-column" key={date}>
      <div className="day-track" data-calendar-day={date} style={{height:timelineHeight}}>
        {events.length>0&&<div className="course-time-thread" aria-hidden="true" style={{top:timelineY(Math.min(...events.map(item=>offsetY(item.from)))),height:Math.max(0,courseEndY(Math.max(...events.map(item=>offsetY(item.to))))-timelineY(Math.min(...events.map(item=>offsetY(item.from)))))}}/>}
        {times.map((h,i)=>{const from=timeString(h*60),to=timeString((h+2)*60)
          return <div key={from} className="empty-slot" data-day={date} data-time={from} style={{height:courseEndY((i+1)*heightPerSlot)-timelineY(i*heightPerSlot),top:timelineY(i*heightPerSlot)}}
            onClick={()=>{if(fan)setFan(null);else onNew({date,from,to})}}
            aria-label={`${formDate(date)} ${from}–${to}, antippen zum Hinzufügen`}><Plus size={14}/></div>
        })}
        {events.map(occ=>{
          const module=modules.find(m=>m.id===occ.offering.moduleId)
          const inactive=inactiveKeys.has(occ.key)
          const start=Math.max(0,offsetY(occ.from)),end=Math.min(height,offsetY(occ.to))
          if(end<=0||start>=height)return null
          const siblings=events.filter(o=>o.key!==occ.key&&intersects(o,occ))
          const group=[occ,...siblings].sort((a,b)=>a.key.localeCompare(b.key)),ix=group.findIndex(x=>x.key===occ.key),n=group.length
          const past=date<today()||(date===today()&&minutes(occ.to)<=clockNow.getHours()*60+clockNow.getMinutes())
          const style={top:timelineY(start)+Math.min(4,(end-start)/4),height:Math.max(2,courseEndY(end)-timelineY(start)-Math.min(8,(end-start)/2)),'--course-accent':module?.color||'#A5A5A5','--course-ink':calendarInk(module?.color||'#A5A5A5'),left:`calc(${ix/n*100}% + 3px)`,width:`calc(${100/n}% - 6px)`} as CSSProperties
          if(fan&&start<insertionY&&end>insertionY){
            const cutTop=insertionY-timelineY(start)-Math.min(4,(end-start)/4),cutBottom=cutTop+expansionHeight
            style.clipPath=`polygon(0 0,100% 0,100% ${cutTop}px,0 ${cutTop}px,0 ${cutBottom}px,100% ${cutBottom}px,100% 100%,0 100%)`
          }
          return <div key={occ.key} role="button" tabIndex={0} aria-label={`${module?.name||occ.offering.name}, ${occ.from} bis ${occ.to}`}
            aria-expanded={fan?.occ.key===occ.key} className={'course '+(fan?.occ.key===occ.key?'course-expanded ':'')+(inactive?'course-inactive ':'')+(occ.cancelled?'course-cancelled ':'')+(past?'course-past ':'')+(past&&date===today()?'course-past-today ':'')+(pressed===occ.key?'being-dragged':'')}
            style={style} onPointerDown={e=>{e.stopPropagation();if(!inactive&&!occ.cancelled)onDown(e,occ)}} onPointerMove={onMove}
            onPointerUp={e=>{e.stopPropagation();onUp(e)}} onPointerCancel={cancelGesture}
            onClick={e=>{e.stopPropagation();if(ignoreClick.current)return;openFan(occ)}}
            onContextMenu={e=>{e.preventDefault();e.stopPropagation();setFan(null);setWalletContext({occ,x:Math.max(8,Math.min(e.clientX,window.innerWidth-185)),y:Math.max(8,Math.min(e.clientY,window.innerHeight-155))})}}
            onDoubleClick={e=>{e.stopPropagation();setFan(null);onEditOccurrence(occ)}} onKeyDown={e=>{if(e.key==='Enter')openFan(occ)}}>
            <div className="course-head"><strong className="course-title">{isAssessment(occ.offering.category)?<span className="course-kind-icon">{/klausur|prüfung/i.test(occ.offering.category)?<GraduationCap size={compact?12:16}/>:<ClipboardList size={compact?12:16}/>}</span>:null}{module?.emoji?<span className="course-emoji">{module.emoji}</span>:null}{compact?module?.shortName||acronym(occ.offering.name):module?.name||occ.offering.name}</strong>
              {singleVisitLabel(occ)&&<span className="course-head-badges">
                {singleVisitLabel(occ)&&<span className="course-recurrence" title={singleVisitLabel(occ)==='Einmalig'?'Nur einmaliger Termin':'Einmalige Ausnahme'}>{compact?'x1':singleVisitLabel(occ)}</span>}
              </span>}
            </div>
            <div className="course-meta">
              <span className="course-category" title={occ.offering.category}>{occ.offering.category}</span>
              {occ.offering.organizer&&<><span className="course-meta-divider" aria-hidden="true">·</span><span className="course-organizer" title={occ.offering.organizer}>{occ.offering.organizer}</span></>}
            </div>
            {placeLabel(occ.offering)&&<span className="course-place"><span title={placeLabel(occ.offering)}>{placeLabel(occ.offering)}</span></span>}

          </div>
        })}
        {clockActive&&<div className="now-day-line" style={{top:timelineY(nowY)}} aria-hidden="true"/>}
      </div>
    </div>
  }
  return <section className={'calendar-page'+(fan&&!monthOpen?' has-open-course':'')}>
    {/* Keep the toolbar, date strip and their menus inside one sticky stacking
        context while the timetable scrolls underneath. */}
    <div className="calendar-sticky-header">
    <div className="calendar-compact-toolbar">
      <div className="view-switch" role="group" aria-label="Kalenderansicht">
        <button className={'calendar-view-count '+(!monthOpen&&mode==='day'?'active':'')} onClick={()=>changeMode('day')} title="1 Tag" aria-label="Ein-Tages-Ansicht"><span className="calendar-view-number" aria-hidden="true">1</span><span className="calendar-view-label" aria-hidden="true">Tag</span></button>
        <button className={'calendar-view-count calendar-view-count-two '+(!monthOpen&&mode==='two'?'active':'')} onClick={()=>changeMode('two')} title="2 Tage" aria-label="Zwei-Tage-Ansicht"><span className="calendar-view-number" aria-hidden="true">2</span><span className="calendar-view-label" aria-hidden="true">Tage</span></button>
        <button className={!monthOpen&&mode==='week'?'active':''} onClick={()=>changeMode('week')} title="Woche" aria-label="Wochenansicht"><CalendarCheck2 size={17}/></button>
        <button className={monthOpen?'active':''} onClick={()=>setMonthOpen(v=>!v)} title="Monat" aria-label="Monatsansicht für Prüfungen und Hausaufgaben"><LayoutGrid size={17}/></button>
      </div>
      <div className="calendar-tools">
        <button className="calendar-today" onClick={e=>{e.currentTarget.blur();if(monthOpen)setAnchor(today());else chooseStripDate(today())}} title="Zum heutigen Tag">Heute</button>
        <button aria-label="Vorheriger Zeitraum" title="Zurück" onClick={e=>{e.currentTarget.blur();jump(-1)}}><ChevronLeft size={19}/></button>
        <button aria-label="Nächster Zeitraum" title="Weiter" onClick={e=>{e.currentTarget.blur();jump(1)}}><ChevronRight size={19}/></button>
        <div className="quick-task-wrap" ref={taskWrap}><button className="calendar-quick-add" title="Termin, Prüfung oder Abgabe hinzufügen" aria-label="Termin, Prüfung oder Abgabe hinzufügen" aria-expanded={taskMenu} aria-haspopup="menu" onClick={()=>{setFocusOpen(false);setTaskMenu(v=>!v)}}><Plus size={18}/></button>
          {taskMenu&&<div className="mini-popover" role="menu" aria-label="Neuen Kalendereintrag hinzufügen"><button onClick={()=>{setTaskMenu(false);onNew({date:anchor,from:'10:00',to:'12:00',recurrence:'once'})}}><CalendarDays size={16}/> Einmaliger Termin</button><button onClick={()=>{setTaskMenu(false);onNew({date:anchor,from:'10:00',to:'12:00',category:'Prüfung'})}}><GraduationCap size={16}/> Prüfung</button><button onClick={()=>{setTaskMenu(false);onNew({date:anchor,from:'18:00',to:'18:30',category:'Hausaufgabe'})}}><ClipboardList size={16}/> Hausaufgabe</button></div>}
        </div>
        <div className="focus-select-wrap" ref={focusWrap}><button className={'calendar-focus '+(focusModuleId?'chosen':'')} onClick={()=>{setTaskMenu(false);setFocusOpen(v=>!v)}} aria-label="Modulfokus auswählen" aria-expanded={focusOpen} aria-haspopup="menu" title="Fokusmodus"><Focus size={18}/></button>
          {focusOpen&&<div className="mini-popover focus-popover" role="menu" aria-label="Nach Modul filtern"><button onClick={()=>{onFocusChange('');setFocusOpen(false)}}>Alle Module {focusModuleId===''&&<Check size={15}/>}</button>{focusChoices.map(m=><button key={m.id} onClick={()=>{onFocusChange(m.id);setFocusOpen(false)}}><span className="color-mark" style={{background:m.color}}/>{m.name}{focusModuleId===m.id&&<Check size={15}/>}</button>)}</div>}
        </div>
      </div>
    </div>
    {!monthOpen&&<div className={'uf-week-strip'+(mode==='week'?' uf-week-strip--week':'')} aria-label="Wochenauswahl" style={{'--uf-days':stripDates.length} as CSSProperties}>
      <button type="button" className="uf-week-strip-month" onClick={()=>setMonthOpen(true)}
        title="Monatsübersicht öffnen" aria-label="Monatsübersicht für Prüfungen und Hausaufgaben öffnen">
        <strong>{fromDate(displayCalendarStart).toLocaleDateString('de-DE',{month:'short'}).split('.').join('')}</strong>
        <span>{fromDate(displayCalendarStart).toLocaleDateString('de-DE',{year:'2-digit'})}</span>
      </button>
      <div className="uf-week-strip-labels" aria-hidden="true">
        {weekNames.slice(0,stripDates.length).map((name,index)=><span className={index>=5?'uf-weekend':''} key={index}>{name}</span>)}
      </div>
      <div className="uf-week-strip-viewport" onPointerDown={onWeekDown} onPointerUp={onWeekUp}
        onPointerCancel={()=>{weekGesture.current=null}} onWheel={onWeekWheel}
        onClickCapture={e=>{if(Date.now()<suppressWeekTap.current){e.preventDefault();e.stopPropagation()}}}>
        {weekSlide&&<div className={'uf-week-dates-previous uf-week-slide-out-'+weekSlide.direction} aria-hidden="true" style={{'--uf-days':stripDates.length} as CSSProperties}>
          {weekHeaderDates(weekSlide.from,data.weekEndDay).map(date=>
            <span key={date} className={date===today()?'uf-week-previous-today':''}>{Number(date.slice(-2))}</span>
          )}
        </div>}
        <div key={stripMonday} className={'uf-week-strip-days'+(weekSlide?' uf-week-slide-in-'+weekSlide.direction:'')}>
          {mode!=='week'&&<span className="uf-week-range" aria-hidden="true" style={{left:(stripRangeIndex/stripDates.length*100)+'%',width:(stripRangeDays/stripDates.length*100)+'%'}}/>}
          {todayIndex!==-1&&(mode==='week'||displayCalendarStart!==today())&&<span className="uf-week-today-marker" aria-hidden="true" style={{left:(todayIndex/stripDates.length*100)+'%'}}/>}
          {mode!=='week'&&<span className="uf-week-liquid" aria-hidden="true" style={{left:(stripIndex/stripDates.length*100)+'%'}}>
            <span className={'uf-week-liquid-core'+(displayCalendarStart===today()?' uf-week-liquid-today':'')}/>
          </span>}
          {stripDates.map(date=>{
            const selected=mode!=='week'&&date===displayCalendarStart
            const second=mode==='two'&&date===addDays(displayCalendarStart,1)
            const dayItems=data.assessments.filter(a=>a.semesterId===semester.id&&a.date===date&&selectedAssessment(a,data.assessments)&&(!focusModuleId||a.moduleId===focusModuleId))
            return <div className="uf-week-strip-day" key={date}>
              <button type="button" className={'uf-week-strip-button'+(selected?' uf-week-first':'')+(second?' uf-week-second':'')+(date===today()?' uf-week-today':'')}
                aria-label={formatDate(date,{weekday:'long',day:'numeric',month:'long'})+' anzeigen'}
                aria-current={date===today()?'date':undefined} aria-pressed={selected||second} onClick={e=>{e.currentTarget.blur();chooseStripDate(date)}}>
                {Number(date.slice(-2))}
              </button>
              {dayItems.length>0&&<div className="uf-week-strip-assessments">
                {dayItems.slice(0,2).map(item=><button type="button" key={item.id}
                  title={item.title} aria-label={(item.type==='exam'?'Prüfung: ':'Hausaufgabe: ')+item.title}
                  className={item.completed?'uf-week-assessment done':'uf-week-assessment'} onClick={e=>{e.stopPropagation();if(dayItems.length>1)setAssessmentDay(value=>value===date?null:date);else onPreviewAssessment(item)}}>
                  {item.type==='exam'?<GraduationCap size={11}/>:<ClipboardList size={11}/>}
                </button>)}
                {dayItems.length>2&&<button className="uf-week-assessment-more" aria-label="Alle Prüfungen und Abgaben anzeigen" onClick={()=>setAssessmentDay(value=>value===date?null:date)}>+{dayItems.length-2}</button>}
              </div>}
            </div>
          })}
        </div>
      </div>
    </div>}
    {assessmentDay&&<div className="uf-assessment-picker" role="group" aria-label="Prüfungen und Abgaben an diesem Tag"><header><strong>{formatDate(assessmentDay,{weekday:'short',day:'numeric',month:'short'})}</strong><button aria-label="Auswahl schließen" onClick={()=>setAssessmentDay(null)}><X size={16}/></button></header>{data.assessments.filter(item=>item.semesterId===semester.id&&item.date===assessmentDay&&selectedAssessment(item,data.assessments)&&(!focusModuleId||item.moduleId===focusModuleId)).map(item=><button key={item.id} className={item.completed?'is-completed':''} onClick={()=>{setAssessmentDay(null);onPreviewAssessment(item)}}>{item.type==='exam'?<GraduationCap size={16}/>:<ClipboardList size={16}/>}<span><strong>{item.title}</strong><small>{data.modules.find(module=>module.id===item.moduleId)?.name}{item.from?' · '+item.from:''}</small></span></button>)}</div>}
    </div>
    {monthOpen?<div className="uf-month-swipe" onPointerDown={onMonthPointerDown}
      onPointerUp={onMonthPointerUp} onPointerCancel={()=>{monthGesture.current=null}}
      onClickCapture={e=>{if(Date.now()<suppressMonthTap.current){e.preventDefault();e.stopPropagation()}}}>
      {monthTransition&&<div className={'uf-month-outgoing uf-month-exit-'+monthTransition.direction}
        aria-hidden="true" inert>
        <CalendarMonthOverview anchor={monthTransition.from} semesterId={semester.id}
          assessments={data.assessments} modules={modules} onBack={()=>{}} onSelectDate={()=>{}}
          onSelectAssessment={()=>{}}/>
      </div>}
      <div key={anchor.slice(0,7)} className={monthTransition?'uf-month-incoming uf-month-enter-'+monthTransition.direction:''}>
        <CalendarMonthOverview anchor={anchor} semesterId={semester.id}
          assessments={data.assessments} modules={modules}
          onBack={()=>setMonthOpen(false)}
          onSelectDate={date=>{setAnchor(date);setMode('day');setMonthOpen(false)}}
          onSelectAssessment={onPreviewAssessment}/>
      </div>
    </div>
    :<div className={"calendar-lanes calendar-lanes-"+mode+" calendar-motion-"+motion}>
      <div className="time-ruler"><button className="ruler-head" title="Heute" onClick={()=>setAnchor(today())}>{fromDate(anchor).toLocaleDateString('de-DE',{month:'short'})}</button>
        <div className="ruler-track" style={{height:timelineHeight}}>{times.map((h,i)=><span key={h} style={{top:timelineY(i*heightPerSlot)}}>{String(h).padStart(2,'0')}:00</span>)}<span style={{top:timelineHeight}}>24:00</span>
          {visibleDays(pages[1]).includes(today())&&nowY>=0&&nowY<=height&&<div className="now-ruler-line" style={{top:timelineY(nowY)}} aria-hidden="true"/>}
        </div>
      </div>
      <div className={'snap-viewport'+(mode==='two'?' snap-two-view':'')} ref={scroller} onScroll={onScroll}>
        {mode==='two'
          ? <div className="two-day-track">
              {dayRail.dates.map((date,index)=><div key={date} className={'two-day-cell mode-two'+(dayRail.offsets.includes(index)?' two-day-snap':'')}>{renderDay(date,false)}</div>)}
            </div>
          : <div className="snap-pages">{pages.map((start,index)=>{
              const days=visibleDays(start)
              return <div className="snap-page" key={`${index}-${start}`}><div className={'days-grid mode-'+mode} style={{gridTemplateColumns:`repeat(${days.length},minmax(0,1fr))`}}>{days.map(date=>renderDay(date,mode==='week'))}</div></div>
            })}</div>
        }
      </div>
    {fan && <div className="calendar-course-expansion" style={{top:insertionY+8,'--wallet-accent':walletAccent} as CSSProperties}>
      <div ref={walletRef} className="wallet-fan" role="region" aria-label="Veranstaltungsgruppen">
        <div className="wallet-fan-head"><span><strong>{modules.find(module=>module.id===fan.occ.offering.moduleId)?.name||fan.occ.offering.name}</strong><small>{formatDate(fan.occ.date,{weekday:'short',day:'numeric',month:'short'})} · {fan.occ.from}–{fan.occ.to}{fanItems.length>1?` · ${fanItems.length-1} Alternativen`:''}</small></span><button aria-label="Stapel schließen" onClick={()=>setFan(null)}><X size={17}/></button></div>
        <div className="wallet-cards">
        {fanItems.slice(1).map((item,i)=>{
          const selected=!!occurrenceAtOrigin(item.offering,item.origin,false)
          const module=modules.find(m=>m.id===item.offering.moduleId)
          const equivalent=sameContent(item.offering,fan.occ.offering)
          return <div role="button" tabIndex={0} key={item.key}
            className={'wallet-card '+(selected?'wallet-card-active':'wallet-card-inactive')+(item.cancelled?' wallet-card-cancelled':'')+(fanPicked?.key===item.key?' wallet-card-picked':'')}
            style={{'--wallet-accent':module?.color||'#9b8cff','--wallet-ink':calendarInk(module?.color||'#9b8cff'),animationDelay:`${i*38}ms`,zIndex:fanItems.length-i} as CSSProperties}
            onPointerDown={e=>{if(i===0&&selected){e.stopPropagation();onDown(e,item)}}}
            onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={cancelGesture}
            onClick={e=>{e.stopPropagation();if(ignoreClick.current)return;onFanTap(item)}}
            onContextMenu={e=>{e.preventDefault();e.stopPropagation();setWalletContext({occ:item,x:Math.max(8,Math.min(e.clientX,window.innerWidth-185)),y:Math.max(8,Math.min(e.clientY,window.innerHeight-155))})}}
            onDoubleClick={e=>{e.stopPropagation();setFan(null);onEditOccurrence(item)}}
            onKeyDown={e=>{if(e.key==='Enter')onFanTap(item)}}>
            <div className="wallet-card-top"><strong>{module?.shortName||module?.name||item.offering.name} · {item.offering.contentLabel||item.offering.category}</strong><span>{item.cancelled?'×':selected?'✓':'○'}</span></div>
            <small>{item.offering.organizer||'Ohne Dozent'} · {placeLabel(item.offering)||'Raum offen'}</small>
            <small>{formatDate(item.date,{weekday:'short',day:'numeric',month:'short'})} · {item.from}–{item.to}</small>
            <span className="wallet-card-caption">{item.cancelled?'Fällt ohne Ersatz aus':selected?'Aktuell ausgewählt':equivalent?'Gleicher Inhalt':'Andere Veranstaltung · gleiche Zeit'}</span>
          </div>
        })}
        </div>
        {fanPicked&&<div className="wallet-actions" key={fanPicked.key}>
          {fanRateable&&<button className="wallet-review" onClick={()=>{const occurrence=fanPicked;setFan(null);if(occurrence)onRateOccurrence(occurrence)}}>Besuch eintragen</button>}
          <div className="wallet-action-title">{fanCancelled?'Ausnahme':fanSelected?'Termin ändern':'Gruppe auswählen'}{fanConflict&&!fanSelected&&!fanCancelled&&<small>Überschneidung im Stundenplan</small>}</div>
          {!fanSelected&&!fanCancelled&&fanMain&&<div className="wallet-choice-banners">{(['replace','both'] as const).map(choice=><div key={choice} className={'wallet-choice-banner'+(fanChoice===choice?' is-expanded':'')}>{fanChoice===choice?<><button onClick={()=>applyFanChoice('single')}>{choice==='both'?'Einmalig beide besuchen':'Einmalig wechseln'}</button>{fanPicked.offering.recurrence!=='once'&&<button onClick={()=>applyFanChoice('future')}>{choice==='both'?'Ab jetzt beide besuchen':'Ab jetzt wechseln'}</button>}<button className="wallet-choice-back" onClick={()=>setFanChoice(null)}>Zurück</button></>:<button onClick={()=>setFanChoice(choice)}>{choice==='both'?'Beide besuchen':'Wechseln'}</button>}</div>)}</div>}
          {fanSelected?<div className="wallet-scope"><button onClick={()=>{setWalletMove(fanPicked);setFan(null)}}>Verschieben</button><button className="wallet-cancel-visit" onClick={()=>{onCancelVisit(fanPicked);setFan(null)}}>Fällt ohne Ersatz aus</button></div>:!fanCancelled&&!fanMain?<div className="wallet-scope"><button onClick={()=>applyFanChoice('single')}>{fanBoth?'Einmalig beide besuchen':fanMain?'Einmalig wechseln':'Einmalig besuchen'}</button>{fanPicked.offering.recurrence!=='once'&&<button onClick={()=>applyFanChoice('future')}>{fanBoth?'Ab jetzt beide besuchen':fanMain?'Ab jetzt wechseln':'Immer besuchen'}</button>}</div>:null}
          {fanPicked.offering.overrides?.[fanPicked.origin]?.scope==='single'&&<button className="wallet-reset" onClick={()=>{onRestoreVisit(fanPicked);setFan(null)}}><RotateCcw size={14}/> Einmalige Wahl zurücknehmen</button>}
          <button className="wallet-edit" onClick={()=>{setFan(null);onEditOccurrence(fanPicked)}}><Settings2 size={14}/> Bearbeiten</button>
        </div>}
      </div>
    </div>}
    </div>}
    {dragUI&&createPortal(<div className="drag-overlay wallet-drag-badge"><Grip size={16}/>{dragUI.occ.offering.name} · {dragUI.from}</div>,document.body)}
    {proposal&&<MoveScope proposal={proposal} onClose={()=>setProposal(null)} onConfirm={confirmScope} mode="move"/>}
    {walletMove&&<MoveVisitEditor occ={walletMove} onClose={()=>setWalletMove(null)} onConfirm={next=>{setWalletMove(null);setProposal(next)}}/>}
    {walletContext&&createPortal(<div className="wallet-context-menu" role="menu" aria-label="Terminaktionen" style={{left:walletContext.x,top:walletContext.y}}
      onPointerDown={e=>e.stopPropagation()} onClick={e=>e.stopPropagation()}>
      <button role="menuitem" onClick={()=>{onEditOccurrence(walletContext.occ);setWalletContext(null);setFan(null)}}><Settings2 size={15}/> Bearbeiten</button>
      {walletContext.occ.offering.moduleId&&walletContext.occ.offering.category!=='Freies Lernen'&&!isAssessment(walletContext.occ.offering.category)&&canRateOccurrence(walletContext.occ)&&
        <button role="menuitem" onClick={()=>{onRateOccurrence(walletContext.occ);setWalletContext(null);setFan(null)}}>
          <Check size={15}/> Besuch eintragen
        </button>}
      <button role="menuitem" className="wallet-context-danger" onClick={()=>{onRequestDeleteOccurrence(walletContext.occ);setWalletContext(null);setFan(null)}}><Trash2 size={15}/> Löschen</button>
    </div>,document.body)}
  </section>
}
export default function App() {
  const [choiceAttendance,setChoiceAttendance] = useState<'replace'|'both'>('replace')
  const [initialLocal]=useState<AppData>(()=>supabase?{...emptyData}:normalizeBigUpdate(loadData()))
  const [data, setData] = useState<AppData>(initialLocal), [onboarding, setOnboarding] = useState(() => supabase ? true : !initialLocal.activeDegreeId), [page, setPage] = useState<Page>(pageFromUrl), [entry, setEntry] = useState<NewEntry | null>(null), [assessmentDraft,setAssessmentDraft]=useState<{date:string;from:string;to:string;type:'exam'|'homework';moduleId?:string}|null>(null), [editingAssessment,setEditingAssessment]=useState<Assessment|null>(null), [previewAssessmentId,setPreviewAssessmentId]=useState<string|null>(null), [deletingAssessment,setDeletingAssessment]=useState<Assessment|null>(null), [detail, setDetail] = useState<Occurrence | null>(null), [ratingOccurrence,setRatingOccurrence]=useState<Occurrence | null>(null), [alternativeDraft, setAlternativeDraft] = useState<{ occ: Occurrence; kind: Alternative['kind'] } | null>(null), [pendingAlternative, setPendingAlternative] = useState<{ occ: Occurrence | null; alt: Occurrence; conflict: boolean; kind: 'slot' | 'group' | 'free' } | null>(null), [deleteProposal, setDeleteProposal] = useState<MoveProposal | null>(null), [pauseProposal,setPauseProposal] = useState<MoveProposal|null>(null), [editingModule, setEditingModule] = useState<StudyModule | null>(null), [selectedModuleId,setSelectedModuleId] = useState<string | null>(null), [editingOffering, setEditingOffering] = useState<Occurrence | null>(null), [focusModuleId, setFocusModuleId] = useState(''), [newModule, setNewModule] = useState(false), [newName, setNewName] = useState(''), [newCredits, setNewCredits] = useState('6'), [toast, setToast] = useState<ToastState | null>(null), [confirmReset, setConfirmReset] = useState(false), [confirmDeleteModule, setConfirmDeleteModule] = useState<StudyModule | null>(null), [pendingBackup, setPendingBackup] = useState<AppData | null>(null)
  const [profileOpen,setProfileOpen]=useState(false)
  const closeProfile=useCallback(()=>setProfileOpen(false),[])
  const [streakCelebration,setStreakCelebration]=useState<number|null>(null)
  const closeStreak=useCallback(()=>setStreakCelebration(null),[])
  const [pageDirection,setPageDirection]=useState<'forward'|'backward'>('forward')
  const [ratingDraftAttended,setRatingDraftAttended]=useState(true)
  const [activeLearningModuleId,setActiveLearningModuleId]=useState('')
  const [ratingDraftValue,setRatingDraftValue]=useState<LearningRating|undefined>()
  const pageHistory=useRef<Page[]>([])
  const navigatePage=(next:Page,remember=true)=>{
    if(next==='settings'){setProfileOpen(true);return}
    setProfileOpen(false)
    if(page===next)return
    if(page==='calendar')window.dispatchEvent(new Event('uniflow-calendar-leave'))
    if(remember)pageHistory.current.push(page)
    const order:Page[]=['overview','dashboard','calendar','modules','settings','admin']
    setPageDirection(order.indexOf(next)>order.indexOf(page)?'forward':'backward')
    // Root-level View Transitions captured the fixed bottom tab bar and briefly
    // placed it behind the switching page. Animate only the content instead.
    setPage(next)
    const location = new URL(window.location.href)
    if (next === 'dashboard') location.searchParams.delete('page')
    else location.searchParams.set('page', next)
    window.history.replaceState(null, '', location)
    window.scrollTo(0,0)
  }
  const [user, setUser] = useState<User | null>(null)
  const [authReady, setAuthReady] = useState(false)
  const [cloudReady, setCloudReady] = useState(false)
  useEffect(()=>{
    if(!cloudReady||!user||!data.streakDays?.includes(today()))return
    const key='uniflow-streak-celebrated:'+user.id
    try{if(localStorage.getItem(key)===today())return;localStorage.setItem(key,today())}catch{/* Animation still works without storage. */}
    setStreakCelebration(streakCount(data.streakDays))
  },[cloudReady,user?.id,data.streakDays])
  const [cloudStatus, setCloudStatus] = useState<'loading' | 'saving' | 'synced' | 'error'>('loading')
  const [cloudError, setCloudError] = useState('')
  const [admin, setAdmin] = useState(false)
  const [premium, setPremium] = useState(false)
  const [premiumOwner,setPremiumOwner]=useState<string|null>(null)
  const [startupFinished,setStartupFinished]=useState(false)
  const finishStartup=useCallback(()=>setStartupFinished(true),[])
  const [catalog, setCatalog] = useState<Catalog>(emptyCatalog)
  const [confirmDeleteSemester, setConfirmDeleteSemester] = useState<Semester | null>(null)
  const [semesterDeleteText,setSemesterDeleteText]=useState('')
  const [cloudBusy, setCloudBusy] = useState(false)
  const backActionRef=useRef<()=>void>(()=>{})
  backActionRef.current=()=>{
    if(profileOpen)return setProfileOpen(false)
    if(pendingBackup)return setPendingBackup(null)
    if(confirmDeleteSemester){setConfirmDeleteSemester(null);setSemesterDeleteText('');return}
    if(confirmDeleteModule)return setConfirmDeleteModule(null)
    if(confirmReset)return setConfirmReset(false)
    if(deletingAssessment)return setDeletingAssessment(null)
    if(editingAssessment)return setEditingAssessment(null)
    if(assessmentDraft)return setAssessmentDraft(null)
    if(previewAssessmentId)return setPreviewAssessmentId(null)
    if(ratingOccurrence)return setRatingOccurrence(null)
    if(detail)return setDetail(null)
    if(editingOffering)return setEditingOffering(null)
    if(alternativeDraft)return setAlternativeDraft(null)
    if(pendingAlternative)return setPendingAlternative(null)
    if(deleteProposal)return setDeleteProposal(null)
    if(pauseProposal)return setPauseProposal(null)
    if(editingModule)return setEditingModule(null)
    if(entry)return setEntry(null)
    if(selectedModuleId)return setSelectedModuleId(null)
    const previous=pageHistory.current.pop()
    if(previous)return navigatePage(previous,false)
    if(page!=='dashboard')navigatePage('dashboard',false)
  }
  useEffect(()=>{
    let start:{x:number;y:number}|null=null
    const onTouchStart=(event:TouchEvent)=>{
      const touch=event.touches[0]
      if(!user||onboarding||event.touches.length!==1||!touch||touch.clientX>28){start=null;return}
      start={x:touch.clientX,y:touch.clientY}
    }
    const onTouchEnd=(event:TouchEvent)=>{
      if(!start)return
      const touch=event.changedTouches[0]
      const dx=touch.clientX-start.x,dy=touch.clientY-start.y
      start=null
      if(dx<72||Math.abs(dx)<Math.abs(dy)*1.25)return
      const detail={handled:false}
      window.dispatchEvent(new CustomEvent('uniflow-back',{detail}))
      if(!detail.handled)backActionRef.current()
    }
    window.addEventListener('touchstart',onTouchStart,{passive:true})
    window.addEventListener('touchend',onTouchEnd,{passive:true})
    return()=>{window.removeEventListener('touchstart',onTouchStart);window.removeEventListener('touchend',onTouchEnd)}
  },[user,onboarding])
  useEffect(() => { document.documentElement.dataset.theme = data.theme||'dark'; document.querySelector('meta[name="theme-color"]')?.setAttribute('content',data.theme==='light'?'#f7f7f8':'#080808') }, [data.theme])
  useEffect(()=>{
    document.documentElement.dataset.uniflowTier=premium?'plus':'free'
    return ()=>{delete document.documentElement.dataset.uniflowTier}
  },[premium])
  const fileRef = useRef<HTMLInputElement>(null)
  const activeUserRef = useRef<string | null>(null)
  const authEpoch = useRef(0)
  const savedSnapshot = useRef('')
  const saveSequence = useRef<Promise<void>>(Promise.resolve())

  const loadUserWorkspace = async (next: User, epoch: number) => {
    try {
      const raw = await cloudLoad(next.id)
      if (epoch !== authEpoch.current) return
      const remote = isValidWorkspace(raw) ? normalizeWorkspace(raw) : null
      if (raw !== null && !remote) throw new Error('Cloud-Daten haben ein unerwartetes Format. Nichts wurde überschrieben.')
      const scopedKey = STORE + '-user-' + next.id
      let local: AppData | null = null
      try {
        const value = localStorage.getItem(scopedKey)
        if (value) { const parsed: unknown = JSON.parse(value); if (isValidWorkspace(parsed)) local = normalizeWorkspace(parsed) }
        // Previously used v0.4 on this account? Restore only its recorded first owner.
        if (!local && localStorage.getItem('uniflow-v4-first-owner') === next.id) {
          const legacy = localStorage.getItem(STORE)
          if (legacy) { const parsed: unknown = JSON.parse(legacy); if (isValidWorkspace(parsed)) local = normalizeWorkspace(parsed) }
        }
      } catch { /* Corrupt local cache must not replace valid cloud data. */ }
      const loaded = remote && local ? (local.lastUpdate > remote.lastUpdate ? local : remote) : remote || local || { ...emptyData }
      savedSnapshot.current = raw !== null ? JSON.stringify(raw) : '' // Persist normalized legacy assessments on next autosave
      setData(loaded)
      setOnboarding(!loaded.activeDegreeId)
      setCloudReady(true)
      setCloudError('')
      setCloudStatus(remote && loaded === remote ? 'synced' : 'saving')
      // Only the signed-in user's own data can be read; catalog/admin data is separate.
      void isAdmin(next).then(value => { if (epoch === authEpoch.current) setAdmin(value) }).catch(() => { if (epoch === authEpoch.current) setAdmin(false) })
    } catch (e) {
      if (epoch !== authEpoch.current) return
      setCloudReady(false)
      setCloudStatus('error')
      setCloudError(e instanceof Error ? e.message : 'Cloud-Synchronisierung konnte nicht gestartet werden.')
    }
  }
  useEffect(() => {
    if (!supabase) { setAuthReady(true); return }
    let alive = true
    const processUser = (next: User | null) => {
      if (!alive) return
      const id = next?.id || null
      if (activeUserRef.current === id && (authEpoch.current > 0 || !id)) { setAuthReady(true); return }
      activeUserRef.current = id
      const epoch = ++authEpoch.current
      setUser(next)
      if(next)setStartupFinished(false)
      setData({ ...emptyData }) // never show the last account's private data after sign-out
      setOnboarding(true)
      pageHistory.current=[]
      setPage(pageFromUrl(next?.id))
      setAdmin(false)
      setCloudReady(false)
      setCloudError('')
      setCloudStatus('loading')
      savedSnapshot.current = ''
      setAuthReady(true)
      if (next) window.setTimeout(() => { if (epoch === authEpoch.current) void loadUserWorkspace(next, epoch) }, 0)
    }
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => processUser(session?.user || null))
    void supabase.auth.getSession().then(({ data, error }) => {
      if (!alive) return
      if (error) { setAuthReady(true); setCloudStatus('error'); setCloudError(error.message); return }
      processUser(data.session?.user || null)
    }).catch(() => { if (alive) setAuthReady(true) })
    return () => { alive = false; ++authEpoch.current; activeUserRef.current = null; subscription.unsubscribe() }
  }, [])
  useEffect(() => { if (supabase) void fetchCatalog().then(setCatalog).catch(() => {}) }, [])
  useEffect(()=>{
    if(!user||!cloudReady||onboarding)return
    try { localStorage.setItem('uniflow-last-page:'+user.id,page==='admin'?'settings':page) } catch { /* Keep navigation working without storage. */ }
    const location=new URL(window.location.href)
    location.searchParams.set('page',page)
    window.history.replaceState(null,'',location)
  },[page,user?.id,cloudReady,onboarding])
  useEffect(()=>{
    let valid=true
    setPremium(false)
    setPremiumOwner(null)
    if(user)void fetchOwnPremium().then(p=>{if(valid){setPremium(p);setPremiumOwner(user.id)}}).catch(()=>{if(valid){setPremium(false);setPremiumOwner(user.id)}})
    return()=>{valid=false}
  },[user?.id])
  useEffect(() => {
    if (!supabase || !user || !cloudReady) return
    const uid = user.id
    const snapshot = JSON.stringify(data)
    localStorage.setItem(STORE + '-user-' + uid, snapshot)
    if (snapshot === savedSnapshot.current) return
    const epoch = authEpoch.current
    const pending = window.setTimeout(() => {
      saveSequence.current = saveSequence.current.catch(() => {}).then(async () => {
        if (epoch !== authEpoch.current) return
        setCloudStatus('saving')
        try {
          await cloudSave(uid, JSON.parse(snapshot) as AppData)
          if (epoch !== authEpoch.current) return
          savedSnapshot.current = snapshot
          setCloudStatus('synced')
          setCloudError('')
        } catch (e) {
          if (epoch !== authEpoch.current) return
          setCloudStatus('error')
          setCloudError(e instanceof Error ? e.message : 'Änderungen noch nicht in der Cloud gespeichert.')
        }
      })
    }, 750)
    return () => window.clearTimeout(pending)
  }, [data, cloudReady, user?.id])
  const syncNow = async () => {
    if (!user || !cloudReady) return
    const epoch = authEpoch.current
    const snapshot = JSON.stringify(data)
    setCloudBusy(true)
    saveSequence.current = saveSequence.current.catch(() => {}).then(async () => {
      if (epoch !== authEpoch.current) return
      setCloudStatus('saving')
      try { await cloudSave(user.id, JSON.parse(snapshot) as AppData); if (epoch === authEpoch.current) { savedSnapshot.current = snapshot; setCloudStatus('synced'); setCloudError('') } }
      catch (e) { if (epoch === authEpoch.current) { setCloudStatus('error'); setCloudError(e instanceof Error ? e.message : 'Speichern fehlgeschlagen.') }; throw e }
    })
    try { await saveSequence.current }
    catch { /* Error is displayed in settings. */ }
    finally { setCloudBusy(false) }
  }
  // Resume unsynced edits when the device reconnects.
  useEffect(() => {
    if (!user || !cloudReady) return
    const onOnline = () => { if (cloudStatus === 'error') void syncNow() }
    window.addEventListener('online', onOnline)
    return () => window.removeEventListener('online', onOnline)
  }, [user?.id, cloudReady, cloudStatus, data])
  const logOut = async () => {
    if (!user) return
    // Best effort flush, but never silently discard edits when it fails.
    try { await saveSequence.current; await cloudSave(user.id, data) }
    catch (e) {
      if (!window.confirm('Deine letzten Änderungen konnten nicht in unicloud gespeichert werden. Trotzdem abmelden? Die lokale Kopie bleibt erhalten.')) return
    }
    try { await signOutApple() }
    catch (e) { setToast({ id: uid(), text: e instanceof Error ? e.message : 'Abmelden fehlgeschlagen.' }) }
  }
  const undoOfferings = useRef<Offering[] | null>(null)
  const note = (text: string, action?:()=>void) => {
    const previous = undoOfferings.current
    const undoable = previous && (text.includes('verschoben') || text.includes('entfernt') || text.includes('übernommen'))
    if (undoable) undoOfferings.current = null
    setToast({ id: uid(), text, action: action||(undoable ? () => setData(d => ({ ...d, offerings: previous!, lastUpdate: Date.now() })) : undefined), actionLabel: action||undoable ? 'Rückgängig' : undefined })
  }
  const mutate = (f: (d: AppData) => AppData) => setData(prev => ({ ...applyScoreAwards(prev,f(prev)), lastUpdate: Date.now() }))
  const addStudyTask=(moduleId:string,title:string,dueDate?:string)=>{
    const now=new Date().toISOString()
    const task:StudyTask={id:uid(),moduleId,title,dueDate,points:SCORE_RULES.todoCompleted,createdAt:now,updatedAt:now}
    mutate(workspace=>({...workspace,studyTasks:[...(workspace.studyTasks||[]),task]}))
    note('Aufgabe hinzugefügt.')
  }
  const toggleStudyTask=(task:StudyTask)=>{
    const now=new Date().toISOString(),completing=!task.completedAt,eventId=`todo:${task.id}`
    mutate(workspace=>{
      const existing=(workspace.scoreEvents||[]).find(event=>event.id===eventId)
      const event=makeScoreEvent({id:eventId,moduleId:task.moduleId,type:'todo-completed',basePoints:task.points||SCORE_RULES.todoCompleted,occurredAt:completing?now:existing?.occurredAt||now,sourceId:task.id,label:task.title,reversedAt:completing?undefined:now})
      return {...workspace,
        studyTasks:(workspace.studyTasks||[]).map(item=>item.id===task.id?{...item,completedAt:completing?now:undefined,updatedAt:now}:item),
        scoreEvents:upsertScoreEvent(workspace.scoreEvents,event)}
    })
    note(completing?`Erledigt · +${task.points||SCORE_RULES.todoCompleted} Punkte`:'Aufgabe wieder geöffnet.',()=>toggleStudyTask({...task,completedAt:completing?now:undefined}))
  }
  const deleteStudyTask=(task:StudyTask)=>{
    const previousEvents=(data.scoreEvents||[]).filter(event=>event.type==='todo-completed'&&event.sourceId===task.id)
    const now=new Date().toISOString()
    mutate(workspace=>({...workspace,studyTasks:(workspace.studyTasks||[]).filter(item=>item.id!==task.id),scoreEvents:(workspace.scoreEvents||[]).map(event=>event.type==='todo-completed'&&event.sourceId===task.id?{...event,reversedAt:now}:event)}))
    note('Aufgabe gelöscht.',()=>mutate(workspace=>({...workspace,studyTasks:[...(workspace.studyTasks||[]).filter(item=>item.id!==task.id),task],scoreEvents:[...(workspace.scoreEvents||[]).filter(event=>!previousEvents.some(previous=>previous.id===event.id)),...previousEvents]})))
  }
  const deleteActivity=(events:NonNullable<AppData['scoreEvents']>)=>{
    events=events.filter(event=>event.type!=='module-created')
    if(!events.length)return
    const ids=new Set(events.map(event=>event.id)),now=new Date().toISOString()
    const sessions=(data.learningSessions||[]).filter(session=>events.some(event=>event.type==='study-minutes'&&event.sourceId===session.id))
    const checkins=(data.learningCheckins||[]).filter(checkin=>events.some(event=>(event.type==='checkin'||event.type==='attendance')&&event.sourceId===checkin.key))
    mutate(workspace=>({...workspace,
      scoreEvents:(workspace.scoreEvents||[]).map(event=>ids.has(event.id)?{...event,reversedAt:now}:event),
      learningSessions:(workspace.learningSessions||[]).filter(session=>!sessions.some(old=>old.id===session.id)),
      learningCheckins:(workspace.learningCheckins||[]).map(checkin=>events.some(event=>event.type==='attendance'&&event.sourceId===checkin.key)?{...checkin,attended:false,updatedAt:now}:checkin)
    }))
    note('Aktivität gelöscht.',()=>mutate(workspace=>({...workspace,
      scoreEvents:(workspace.scoreEvents||[]).map(event=>events.find(old=>old.id===event.id)||event),
      learningSessions:[...(workspace.learningSessions||[]).filter(session=>!sessions.some(old=>old.id===session.id)),...sessions],
      learningCheckins:(workspace.learningCheckins||[]).map(checkin=>checkins.find(old=>old.key===checkin.key)||checkin)
    })))
  }
  const saveLearningSession=(session:Omit<LearningSession,'id'|'updatedAt'>)=>{
    const now=new Date().toISOString(),id=uid(),groupId=`study:${id}`
    mutate(workspace=>session.timerId&&(workspace.learningSessions||[]).some(old=>old.timerId===session.timerId)?workspace:({...workspace,
      studyTimer:session.timerId&&workspace.studyTimer?.id===session.timerId?undefined:workspace.studyTimer,
      learningSessions:[...(workspace.learningSessions||[]).filter(old=>!session.scheduledKey||old.scheduledKey!==session.scheduledKey),{...session,id,updatedAt:now}],
      scoreEvents:[...(workspace.scoreEvents||[]),makeScoreEvent({id:`study-minutes:${id}`,moduleId:session.moduleId,type:'study-minutes',basePoints:session.duration*SCORE_RULES.minute,occurredAt:now,sourceId:id,groupId,label:`${session.duration} Min. gelernt`})]
    }))
    note(`Lernsession gespeichert · +${Math.round(session.duration*SCORE_RULES.minute)} Punkte`)
  }
  const updateLearningSession=(session:LearningSession)=>{
    const now=new Date().toISOString()
    mutate(workspace=>({...workspace,
      learningSessions:(workspace.learningSessions||[]).map(old=>old.id===session.id?{...session,updatedAt:now}:old),
      scoreEvents:(workspace.scoreEvents||[]).map(event=>event.type==='study-minutes'&&event.sourceId===session.id?{...event,basePoints:session.duration*SCORE_RULES.minute,points:Math.round(session.duration*SCORE_RULES.minute*event.multiplier),label:`${session.duration} Min. gelernt`}:event)
    }))
    note('Lernsession aktualisiert.')
  }
  const saveLearnedContent=(moduleId:string,lessons:NumberedLesson[],duration:number,rating:Exclude<LearningRating,'absent'>)=>{
    const now=new Date().toISOString(),id=uid(),groupId=`content-study:${id}`
    mutate(workspace=>{
      let events=[...(workspace.scoreEvents||[]),makeScoreEvent({id:`study-minutes:${id}`,moduleId,type:'study-minutes',basePoints:duration*SCORE_RULES.minute,occurredAt:now,sourceId:id,groupId,label:`${lessons.length} Einheiten gelernt`})]
      for(const lesson of lessons){
        const eventId=`content-learned:${lesson.key}`
        if(events.some(event=>event.id===eventId&&!event.reversedAt))continue
        events=upsertScoreEvent(events,makeScoreEvent({id:eventId,moduleId,type:'content-learned',basePoints:learnedPoints(lesson.category),occurredAt:now,sourceId:lesson.key,groupId,label:`${lesson.label} gelernt`}))
      }
      return {...workspace,learningSessions:[...(workspace.learningSessions||[]),{id,moduleId,date:today(),duration,kind:'review' as const,rating,lessonKeys:lessons.map(lesson=>lesson.key),updatedAt:now}],scoreEvents:events}
    })
    note('Lernfortschritt gespeichert.')
  }
  const setNotificationPreference = async (enabled:boolean) => {
    const next={lessonFeedback:enabled}
    try {
      await configurePushPreferences(next.lessonFeedback)
      mutate(workspace=>({...workspace,notificationPreferences:next}))
      note(enabled?'Benachrichtigungen aktiviert.':'Benachrichtigungen deaktiviert.')
    } catch(reason) { note(reason instanceof Error?reason.message:'Benachrichtigungen konnten nicht geändert werden.') }
  }
  const ratingLesson=ratingOccurrence?lessonForOccurrence(ratingOccurrence,data):null
  const ratingModule=ratingLesson?data.modules.find(m=>m.id===ratingLesson.moduleId):undefined
  const ratingNumbered=ratingLesson?numberedLessons(data,data.semesters.find(item=>item.id===ratingOccurrence?.offering.semesterId),ratingLesson.moduleId).find(item=>item.key===ratingLesson.key):undefined
  const openRatingOccurrence=(occurrence:Occurrence)=>{
    const lesson=lessonForOccurrence(occurrence,data)
    const checkin=(data.learningCheckins||[]).find(item=>item.key===lesson.key)
    setRatingDraftAttended(checkin ? (checkin.attended ?? checkin.rating !== 'absent') : true)
    setRatingDraftValue(checkin?.understandingSelected===false||checkin?.rating==='absent'?undefined:checkin?.rating)
    setRatingOccurrence(occurrence)
  }
  const saveRatingDraft=()=>{
    if(!ratingLesson||!ratingOccurrence)return
    const now=new Date().toISOString()
    mutate(workspace=>{
      let events=workspace.scoreEvents||[]
      const attendanceId=`attendance:${ratingLesson.key}`,existingAttendance=events.find(event=>event.id===attendanceId)
      const attendance=makeScoreEvent({id:attendanceId,moduleId:ratingLesson.moduleId,type:'attendance',basePoints:attendancePoints(ratingOccurrence.offering.category),occurredAt:existingAttendance?.occurredAt||now,sourceId:ratingLesson.key,label:`${ratingOccurrence.offering.category} besucht`,reversedAt:ratingDraftAttended?undefined:now})
      events=upsertScoreEvent(events,attendance)
      if(ratingDraftValue){
        const checkinId=`checkin:${ratingLesson.key}`,existing=events.find(event=>event.id===checkinId)
        const points=understandingPoints(ratingDraftValue)
        if(points>0)events=upsertScoreEvent(events,makeScoreEvent({id:checkinId,moduleId:ratingLesson.moduleId,type:'checkin',basePoints:points,occurredAt:existing?.occurredAt||now,sourceId:ratingLesson.key,label:'Verständnis eingetragen'}))
        else if(existing)events=upsertScoreEvent(events,{...existing,reversedAt:now})
      }
      return {...workspace,scoreEvents:events,learningCheckins:[...(workspace.learningCheckins||[]).filter(checkin=>checkin.key!==ratingLesson.key),{key:ratingLesson.key,moduleId:ratingLesson.moduleId,contentId:ratingLesson.contentId,date:ratingLesson.date,rating:ratingDraftValue||(ratingDraftAttended?'partial':'absent'),attended:ratingDraftAttended,understandingSelected:!!ratingDraftValue,updatedAt:now}]}
    })
    setRatingOccurrence(null)
    note('Check-in gespeichert.')
  }
  const degree = data.degrees.find(d => d.id === data.activeDegreeId)
  const semester = data.semesters.find(s => s.id === data.activeSemesterId)
  const selectedModule=data.modules.find(module=>module.id===selectedModuleId)
  const moduleEditorSemester=selectedModule?.status==='current'?semester:data.semesters.find(item=>selectedModule?.semesterIds.includes(item.id))||semester
  const degreeModules = data.modules.filter(m => m.degreeId === degree?.id)
  const semesterModules = degreeModules.filter(m => m.semesterIds.includes(semester?.id || ''))
  const [adviceClock,setAdviceClock]=useState(0)
  useEffect(()=>{
    if(!user||!cloudReady||onboarding)return
    let timer:number
    const refresh=()=>{
      window.clearTimeout(timer)
      if(document.visibilityState==='visible')setAdviceClock(n=>n+1)
      timer=window.setTimeout(refresh,60_000-Date.now()%60_000)
    }
    refresh()
    document.addEventListener('visibilitychange',refresh)
    window.addEventListener('focus',refresh)
    return()=>{window.clearTimeout(timer);document.removeEventListener('visibilitychange',refresh);window.removeEventListener('focus',refresh)}
  },[user?.id,cloudReady,onboarding])
  const currentStudyContext=useMemo(()=>adviceContext(data,semester,semesterModules,new Date()),[data,semester,adviceClock])
  const currentModuleId=useMemo(()=>{
    const now=new Date(),clock=now.getHours()*60+now.getMinutes()
    return occurrencesOn(data.offerings,today()).filter(occ=>!occ.cancelled&&occ.offering.semesterId===semester?.id&&semesterModules.some(module=>module.id===occ.offering.moduleId)&&!isAssessment(occ.offering.category)&&minutes(occ.from)<=clock&&clock<minutes(occ.to)).sort((a,b)=>b.from.localeCompare(a.from))[0]?.offering.moduleId
  },[data.offerings,semester?.id,adviceClock,semesterModules])
  const liveModule=data.modules.find(module=>module.id===currentModuleId)
  const liveAmbient=!!liveModule&&(page==='overview'||page==='dashboard')
  const contextualColor=data.modules.find(module=>module.id===(page==='modules'?selectedModuleId:page==='calendar'?(focusModuleId||currentModuleId):activeLearningModuleId))?.color||'#d4d4d8'
  useEffect(()=>{
    for(const property of ['--module-accent','--mlh-accent','--uniflow-accent','--uf-primary'])document.documentElement.style.setProperty(property,contextualColor)
  },[contextualColor])
  const ai=usePremiumAdvice(user?.id||'',premium,currentStudyContext,!!user&&cloudReady&&!onboarding)
  const journeysByModule = useMemo(()=>{
    const lessons=pastLessons(data,semester)
    return Object.fromEntries(semesterModules.map(m=>[m.id,journeyFor(data,m,lessons)])) as Record<string,Journey>
  },[data,semester])
  const updateModules = (mods: StudyModule[]) => mutate(d => ({ ...d, modules: mods }))
  const [newModuleStatus,setNewModuleStatus]=useState<StudyModule['status']>('current')
  const [newModuleSemesterIds,setNewModuleSemesterIds]=useState<string[]>([])
  const saveNewModule = () => { if (!newName.trim() || !degree) return; const m: StudyModule = { id: uid(), degreeId: degree.id, name: newName.trim(), shortName: acronym(newName.trim()), credits: ensureCredits(newCredits), color: colors[degreeModules.length % colors.length], emoji: '', status: newModuleStatus, grade: '', counted: true, hidden: false, semesterIds: newModuleStatus==='current'?(semester?[semester.id]:[]):newModuleSemesterIds }; const now=new Date().toISOString(); mutate(d => ({ ...d, modules: [...d.modules, m],scoreEvents:[...(d.scoreEvents||[]),makeScoreEvent({id:`module-created:${m.id}`,moduleId:m.id,type:'module-created',basePoints:SCORE_RULES.moduleCreated,occurredAt:now,sourceId:m.id,label:'Startbonus'})] })); setNewName(''); setNewCredits('6'); setNewModule(false); note('Modul hinzugefügt · +100 Startpunkte') }
  const onAddOffer = (offer:Offering) => {
    // Check the whole new series, not only its first week: later clashes must
    // also make the new offering an available alternative, never a forced main.
    let overlap = false
    if (!isAssessment(offer.category)) {
      let date = offer.date
      for (let i=0; i<100 && date<=offer.endDate; i++) {
        if (occurrencesOn(data.offerings,date).some(other=>other.offering.semesterId===offer.semesterId && intersects(other,offer))) {overlap=true;break}
        if (offer.recurrence==='once') break
        date=addDays(date,offer.recurrence==='biweekly'?14:7)
      }
    }
    mutate(d=>({...d,offerings:[...d.offerings,{...offer,contentId:offer.id,selected:!overlap}]}))
    setEntry(null)
    note(overlap?'Zur gleichen Zeit liegt bereits ein Termin. Der neue Termin ist als Alternative gespeichert.':'Termin hinzugefügt.')
  }
  const onAddAlternative = (offering:Offering) => {
    mutate(d=>({...d,offerings:[...d.offerings,offering]}))
    setAlternativeDraft(null);setDetail(null)
    note('Alternative gespeichert.')
  }
  const onEditOffering = (offering:Offering) => {
    mutate(d=>({...d,offerings:d.offerings.map(o=>o.id===offering.id?offering:o)}))
    setEditingOffering(null);setDetail(null);note('Termin gespeichert.')
  }
  const chooseAlternative = (alt:Occurrence,occ:Occurrence) => {
    const conflict=occurrencesOn(data.offerings,alt.date).some(other=>other.key!==occ.key&&other.key!==alt.key&&intersects(other,alt))
    const kind=alt.offering.contentId && alt.offering.contentId===(occ.offering.contentId||occ.offering.id)?'group':'slot'
    setChoiceAttendance('replace')
    setPendingAlternative({alt,occ,conflict,kind})
    setDetail(null)
  }
  const applyChoice = (scope:'single'|'future') => {
    if(!pendingAlternative)return
    undoOfferings.current=data.offerings
    mutate(d=>({...d,offerings:pendingAlternative.occ ? chooseOffering(d.offerings,pendingAlternative.occ,pendingAlternative.alt,scope,choiceAttendance==='both') : setOfferingAttendance(d.offerings,pendingAlternative.alt,scope,true)}))
    setPendingAlternative(null);setDetail(null)
    note(choiceAttendance==='both'?'Beide Veranstaltungen eingeplant.':'Gruppe gewechselt. Die bisherige bleibt als Alternative erhalten.')
  }
  const onDelete = () => {
    if(!deleteProposal)return
    undoOfferings.current=data.offerings
    const id=deleteProposal.occ.offering.id
    mutate(d=>({...d,offerings:removeOfferingGroup(d.offerings,id),alternatives:(d.alternatives||[]).filter(a=>a.parentOfferingId!==id)}))
    setDeleteProposal(null);note('Gruppe endgültig gelöscht.')
  }
  const onPause = (scope:'single'|'future') => {
    if(!pauseProposal)return
    undoOfferings.current=data.offerings
    mutate(d=>({...d,offerings:suspendOffering(d.offerings,pauseProposal.occ,scope)}))
    setPauseProposal(null);note('Besuch ausgesetzt. Die Veranstaltungsgruppe bleibt erhalten.')
  }

  const doReset = async () => {
    if (!user) return
    const fresh = { ...emptyData, lastUpdate: Date.now() }
    setCloudBusy(true)
    const epoch = authEpoch.current
    try {
      await saveSequence.current
      await cloudSave(user.id, fresh)
      if (epoch !== authEpoch.current) return
      savedSnapshot.current = JSON.stringify(fresh)
      localStorage.setItem(STORE + '-user-' + user.id, JSON.stringify(fresh))
      setData(fresh); setOnboarding(true); pageHistory.current=[]; setPage('dashboard'); setConfirmReset(false); setToast(null); setCloudStatus('synced')
    } catch (e) { note(e instanceof Error ? e.message : 'Zurücksetzen fehlgeschlagen. Daten bleiben erhalten.') }
    finally { setCloudBusy(false) }
  }
  const saveBackup = () => { const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = `uniflow-backup-${today()}.json`; a.click(); URL.revokeObjectURL(url); note('Backup heruntergeladen.') }
  const readBackup = async (file?: File) => { if (!file) return; try { const raw = JSON.parse(await file.text()); if (!Array.isArray(raw.degrees) || !Array.isArray(raw.modules) || !Array.isArray(raw.offerings) || !Array.isArray(raw.semesters)) throw Error('Ungültiges Backup'); const converted = raw.version === 2 ? normalizeWorkspace(raw as AppData) : migrateLegacy(raw); if (!converted) throw Error('Ungültiges Backup'); setPendingBackup(converted) } catch { note('Diese Datei ist kein gültiges uniflow-Backup.') } }
  const previewAssessment=data.assessments.find(item=>item.id===previewAssessmentId)
  const semesterDeletePhrase=confirmDeleteSemester?`Ich möchte ${confirmDeleteSemester.name} endgültig löschen`:''
  if (!supabase) return <main className="auth-loading auth-config-missing"><div><h1>Verbindung einrichten.</h1><p>uniflow benötigt ein Supabase-Konto. Trage VITE_SUPABASE_URL und VITE_SUPABASE_PUBLISHABLE_KEY in der Datei .env.local ein und starte Vite neu.</p></div></main>
  if (!startupFinished) return <StartupSplash
    ready={authReady&&(!user||(cloudReady&&premiumOwner===user.id)||cloudStatus==='error')}
    premiumKnown={authReady&&(!user||premiumOwner===user.id)}
    premium={!!user&&premiumOwner===user.id&&premium}
    onFinish={finishStartup}/>
  if (!user) return <><AuthScreen/>{toast && <Notice key={toast.id} toast={toast} onDismiss={() => setToast(null)}/>}</>
  if (!cloudReady) return <main className="auth-loading auth-cloud-loading"><div><div className="wordmark">uniflow<span className="wordmark-dot">.</span></div><p>{cloudStatus === 'error' ? cloudError : 'Deine Daten werden sicher geladen …'}</p>{cloudStatus === 'error' && <><button className="primary-action" onClick={() => void loadUserWorkspace(user, authEpoch.current)}>Erneut versuchen</button><button className="auth-secondary" onClick={() => void logOut()}>Abmelden</button></>}</div></main>
  if (onboarding) return <><Onboarding catalog={catalog} onSignOut={() => void logOut()} onDone={d => { setData(applyScoreAwards(emptyData,d)); setOnboarding(false); pageHistory.current=[]; setPage('dashboard') }} onInfo={note} />{toast && <Notice key={toast.id} toast={toast} onDismiss={() => setToast(current => current?.id === toast.id ? null : current)}/>}</>
  const settingsContent=(<div className="screen secondary-screen settings-screen"><section className="settings-section"><h2>Darstellung</h2><label className="settings-theme"><span>Farbschema</span><UniflowPicker label="Darstellung" value={data.theme||'dark'} onChange={value=>mutate(workspace=>({...workspace,theme:value==='light'?'light':'dark'}))} options={[{value:'dark',label:'Dunkel'},{value:'light',label:'Hell'}]}/></label></section><section className="settings-section"><h2>Studium</h2><div className="setting-line"><span>Studiengang</span><strong>{degree?.name}</strong></div><div className="setting-line"><span>Hochschule</span><strong>{degree?.university || 'Nicht angegeben'}</strong></div><div className="setting-line"><span>LP-Ziel</span><div className="number-setting"><input type="number" min="0" value={degree?.targetCredits || 0} onChange={e => mutate(d => ({ ...d, degrees: d.degrees.map(x => x.id === degree?.id ? { ...x, targetCredits: +e.target.value || 0 } : x) }))} /> LP</div></div></section>{admin && <section className="settings-section admin-settings-link">
        <h2>Administration</h2>
        <button className="settings-action" onClick={()=>navigatePage('admin')}><Settings2 size={19}/> Adminbereich öffnen <ArrowRight size={17}/></button>
        <p className="quiet-copy">Nur für dein Administratorkonto sichtbar.</p>
      </section>}{premium&&<section className="settings-section settings-ai-section" aria-label="KI-Modus">
        <div className="settings-ai-inline">
          <span className="settings-ai-label">KI-Modus</span>
          <span className="settings-ai-badge">uniflow+</span>
          <button type="button" role="switch" aria-label="KI-Modus aktivieren" aria-checked={ai.consent}
            aria-describedby="settings-ai-data-note"
            className={'settings-ai-toggle'+(ai.consent?' is-on':'')}
            onClick={()=>ai.setConsent(!ai.consent)}><span/></button>
        </div>
        <span className="uf-visually-hidden" id="settings-ai-data-note">Bei Aktivierung werden relevante Modulnamen, Themen, Bewertungen und Prüfungstermine über unicloud an DeepSeek übermittelt.</span>
        {ai.consent&&ai.working&&<p className="settings-ai-status" role="status"><Sparkles size={14}/> Deine KI-Empfehlung wird erstellt …</p>}
        {ai.consent&&ai.errorMessage&&<p className="auth-error" role="alert">{ai.errorMessage}</p>}
      </section>}<section className="settings-section notification-settings"><h2>Mitteilungen</h2>
        <div className="setting-line"><span><strong>Feedback nach Terminen</strong><small>Fragt nach dem Ende einer Veranstaltung kurz nach.</small></span><button type="button" role="switch" aria-checked={data.notificationPreferences?.lessonFeedback||false} className={'settings-switch'+(data.notificationPreferences?.lessonFeedback?' is-on':'')} onClick={()=>void setNotificationPreference(!(data.notificationPreferences?.lessonFeedback||false))}><span/></button></div>
        <p className="quiet-copy">Auf iPhone und iPad funktioniert Push, wenn uniflow zum Home-Bildschirm hinzugefügt wurde.</p>
      </section><section className="settings-section"><h2>Stundenplan</h2><div className="setting-line"><span>Zeitraum</span><strong>00:00–24:00</strong></div><div className="setting-line"><span>Woche anzeigen bis</span><div className="inline-toggle week-end-toggle">{([{v:4,label:'Fr'},{v:5,label:'Sa'},{v:6,label:'So'}] as const).map(x=><button key={x.v} className={(data.weekEndDay??4)===x.v?'selected':''} onClick={()=>mutate(d=>({...d,weekEndDay:x.v}))}>{x.label}</button>)}</div></div><small className="setting-hint">Die Wochenansicht endet am gewählten Tag. Spätere Termine bleiben über die Tages- oder Zwei-Tage-Ansicht erreichbar.</small><small className="setting-hint">Der Zeitraum bleibt fest. Veranstaltungen werden minutengenau dargestellt.</small></section><section className="settings-section"><h2>Semester</h2><div className="semester-picker-list">{data.semesters.filter(s => s.degreeId === degree?.id).map(s => <button key={s.id} className={s.id === semester?.id ? 'current' : ''} onClick={() => { mutate(d => ({ ...d, activeSemesterId: s.id })); note(`${s.name} geöffnet.`) }}><span><strong>{s.name}</strong><small>{formDate(s.start)} – {formDate(s.end)}</small></span>{s.id === semester?.id && <Check size={18} />}</button>)}</div>{semester && <label className="setting-input"><span>Letzter Vorlesungstag</span><DateControl value={semester.lectureEnd} min={semester.start} max={semester.end} onChange={v => mutate(d => ({ ...d, semesters: d.semesters.map(s => s.id === semester.id ? { ...s, lectureEnd: v } : s) }))} /></label>}<button className="underlined-link" onClick={() => { if (!degree) return; const recent = data.semesters.filter(s => s.degreeId === degree.id).sort((a, b) => b.end.localeCompare(a.end))[0]; const start = recent ? addDays(recent.end, 1) : currentSemesterDates().start; const next = semesterFromStart(start); if (data.semesters.some(s => s.degreeId === degree.id && overlaps(s.start, s.end, next.start, next.end))) { note('Dieses Semester ist bereits vorhanden.'); return } const newSemester: Semester = { ...next, id: uid(), degreeId: degree.id, archived: false }; mutate(d => ({ ...d, semesters: [...d.semesters, newSemester], activeSemesterId: d.activeSemesterId })); note('Nächstes Semester gespeichert. Das aktuelle bleibt ausgewählt.') }}>Nächstes Semester hinzufügen <Plus size={17} /></button><div className="semester-management"><h3>Semester verwalten</h3>{data.semesters.filter(x=>x.degreeId===degree?.id).map(x=><div key={x.id} className="semester-manage-row"><span><strong>{x.name}</strong><small>{x.id===semester?.id?'Ausgewählt':x.start>today()?'Geplant':x.end<today()?'Vergangen':'Laufend'} · {formDate(x.start)} – {formDate(x.end)}</small></span><button aria-label={`${x.name} löschen`} onClick={()=>setConfirmDeleteSemester(x)}><Trash2 size={18}/></button></div>)}</div></section><section className="settings-section"><h2>Deine Daten</h2><button className="settings-action" onClick={saveBackup}><Download size={19} /> Backup herunterladen <ArrowRight size={17} /></button><button className="settings-action" onClick={() => fileRef.current?.click()}><Upload size={19} /> Backup importieren <ArrowRight size={17} /></button><input ref={fileRef} type="file" accept=".json,application/json" hidden onChange={e => { void readBackup(e.target.files?.[0]); e.target.value = '' }} /><button className="settings-action settings-danger" onClick={() => setConfirmReset(true)}><RotateCcw size={19} /> Alles zurücksetzen <ArrowRight size={17} /></button><div className="cloud-account-state"><div><strong>unicloud</strong><small>{cloudStatus === 'synced' ? 'Alle Änderungen gespeichert' : cloudStatus === 'saving' ? 'Synchronisiere …' : cloudStatus === 'error' ? 'Synchronisierung fehlgeschlagen' : 'Verbunden'}</small></div>{cloudStatus === 'synced' ? <Check size={19}/> : <RefreshCw size={19}/>}</div>{cloudStatus === 'error' && <p className="auth-error">{cloudError}</p>}<button className="settings-action" disabled={cloudBusy || cloudStatus === 'saving'} onClick={() => void syncNow()}><RefreshCw size={19}/> Jetzt synchronisieren <ArrowRight size={17}/></button><button className="settings-action" onClick={() => void logOut()}><LogOut size={19}/> uniflow abmelden <ArrowRight size={17}/></button><p className="quiet-copy">Angemeldet als {user.email || user.id.slice(0,8) + '…'}. Deine Daten werden beim Öffnen geladen und bei Änderungen automatisch in unicloud gespeichert. Bei gleichzeitigen Änderungen auf mehreren Geräten kann der zuletzt gespeicherte Stand gewinnen.</p></section></div>)
  return <div className={'app-root'+(liveAmbient?' has-live-session':'')} style={{'--live-accent':liveModule?.color||'#b6b6c4'} as CSSProperties}><div className="app-desktop-side"><div className="brand-side"><BrandMark premium={premium} page={page}/></div><nav>{([{id:'overview' as const,title:'Dashboard',icon:House}, { id: 'dashboard' as const, title: 'Lernen', icon: Layers2 }, { id: 'calendar', title: 'Stundenplan', icon: CalendarDays }, ...(admin ? [{ id:'admin' as const, title:'Admin', icon:Settings2 }] : [])] as const).map(n => <button key={n.id} className={page === n.id ? 'active' : ''} onClick={() => navigatePage(n.id)}><span className="nav-icon-wrap"><n.icon size={19} /></span>{n.title}</button>)}</nav><div className="sidebar-profile"><StudyUtilities days={data.streakDays} onProfile={()=>setProfileOpen(true)} onStreak={()=>setStreakCelebration(streakCount(data.streakDays))}/>{data.profile}<small>{degree?.name || 'Dein Studium'}</small></div></div>
    <div className="app-main">{liveAmbient&&<><div className="study-live-ambient" aria-hidden="true"/><span className="uf-visually-hidden">Gerade läuft: {liveModule?.name}</span></>}{page!=='dashboard'&&page!=='overview'&&<header className="app-top"><button className="app-brand" onClick={() => navigatePage('dashboard')}><BrandMark premium={premium} page={page}/></button></header>}
      <div key={page} className={"uf-page-stage uf-page-"+page+" uf-page-enter-"+pageDirection}>
      {page==='overview'&&<OverviewDashboard data={data} advice={ai.advice} aiEnabled={premium&&ai.consent} aiWorking={ai.working} aiError={ai.errorMessage} onTimerChange={studyTimer=>mutate(workspace=>({...workspace,studyTimer}))} onSession={saveLearningSession} onProfile={()=>setProfileOpen(true)} onStreak={()=>setStreakCelebration(streakCount(data.streakDays))} onAddTask={addStudyTask} onToggleTask={toggleStudyTask} onDeleteTask={deleteStudyTask} onGoal={goal=>mutate(d=>({...d,dailyScoreGoal:goal}))} onAssessment={item=>setPreviewAssessmentId(item.id)} onCalendar={occ=>{setFocusModuleId(occ.offering.moduleId);navigatePage('calendar')}}/>}
      {page === 'dashboard' && <ModuleLearningHome onProfile={()=>setProfileOpen(true)} onStreak={()=>setStreakCelebration(streakCount(data.streakDays))} data={data} semester={semester} modules={semesterModules}
        currentModuleId={currentModuleId}
        onPreviewAssessment={item=>setPreviewAssessmentId(item.id)}
        onToggleHomework={item=>{
          const completed=!item.completed
          mutate(workspace=>({...workspace,assessments:workspace.assessments.map(old=>old.id===item.id?{...old,completed}:old)}))
          const label=item.type==='exam'?'Prüfung':'Hausaufgabe'
          note(completed?label+' erledigt.':label+' wieder geöffnet.',()=>mutate(workspace=>({...workspace,assessments:workspace.assessments.map(old=>old.id===item.id?{...old,completed:!!item.completed}:old)})))
        }}
        onActiveModuleChange={setActiveLearningModuleId}
        onTimerChange={studyTimer=>mutate(workspace=>({...workspace,studyTimer}))}
        onUpdateSession={updateLearningSession}
        storageKey={'uniflow-last-module:'+user.id} onDeleteTask={deleteStudyTask} onDeleteActivity={deleteActivity}
        onAddTask={addStudyTask} onToggleTask={toggleStudyTask} onSession={saveLearningSession} onLearnContent={saveLearnedContent}
        onEditModule={moduleId=>{setSelectedModuleId(moduleId);navigatePage('modules')}} onCreateModule={()=>{setNewModuleStatus('current');setNewModuleSemesterIds([]);setNewModule(true)}} />}
      {page === 'calendar' && <div className="screen screen-calendar">{semester ? <Calendar key={user.id+':'+semester.id} data={data} semester={semester} modules={semesterModules} userId={user.id} focusModuleId={focusModuleId} onFocusChange={setFocusModuleId} onNew={slot=>{if(isAssessment(slot.category||''))setAssessmentDraft({...slot,type:/klausur|prüfung|exam/i.test(slot.category||'')?'exam':'homework'});else setEntry(slot)}} onEditOccurrence={setEditingOffering} onRateOccurrence={openRatingOccurrence} onPreviewAssessment={item=>setPreviewAssessmentId(item.id)} onSelectGroup={(source,target,scope,both)=>{undoOfferings.current=data.offerings;mutate(d=>({...d,offerings:source?chooseOffering(d.offerings,source,target,scope,both):setOfferingAttendance(d.offerings,target,scope,true)}));note(both?'Beide Gruppen bleiben eingeplant.':'Besuchsauswahl aktualisiert.')}} onSuspendVisit={(occ,scope)=>{undoOfferings.current=data.offerings;mutate(d=>({...d,offerings:suspendOffering(d.offerings,occ,scope)}));note('Besuch ausgesetzt. Die Gruppe bleibt erhalten.')}} onCancelVisit={occ=>{undoOfferings.current=data.offerings;mutate(d=>({...d,offerings:d.offerings.map(item=>item.id===occ.offering.id?{...item,overrides:{...(item.overrides||{}),[occ.origin]:{date:occ.origin,from:occ.from,to:occ.to,cancelled:true,scope:'single',reason:'removal'}}}:item)}));note('Termin fällt ohne Ersatz aus.')}} onRestoreVisit={occ=>{undoOfferings.current=data.offerings;mutate(d=>({...d,offerings:undoSingleChoice(d.offerings,occ)}));note('Einmalige Auswahl zurückgenommen.')}} onRequestDeleteOccurrence={occ=>setDeleteProposal({occ,date:occ.date,from:occ.from,to:occ.to})} onOfferingsChange={offers => { undoOfferings.current = data.offerings; mutate(d => ({ ...d, offerings: offers })) }} onNotice={note} /> : <div className="page-blank"><h1>Dein Stundenplan</h1><p>Erstelle zuerst ein Semester in den Einstellungen.</p><button className="primary-action" onClick={() => navigatePage('settings')}>Einstellungen</button></div>}</div>}
      {page === 'modules' && selectedModuleId && data.modules.some(m=>m.id===selectedModuleId) && <ModuleScheduleEditor
        key={selectedModuleId}
        module={data.modules.find(m=>m.id===selectedModuleId)!}
        semester={moduleEditorSemester}
        offerings={data.offerings}
        assessments={data.assessments}
        journey={journeysByModule[selectedModuleId]}
        premium={premium}
        onBack={()=>{setSelectedModuleId(null);navigatePage('dashboard',false)}}
        onUpdateModule={updated=>mutate(d=>({...d,modules:d.modules.map(m=>m.id===updated.id?{...updated,semesterIds:updated.status==='current'?[d.activeSemesterId]:updated.semesterIds}:m)}))}
        moduleSemesterControl={<SemesterAssignment data={data} module={data.modules.find(m=>m.id===selectedModuleId)!} onMutate={mutate} onChange={updated=>mutate(d=>({...d,modules:d.modules.map(m=>m.id===updated.id?updated:m)}))}/>}
        onDeleteModule={()=>setConfirmDeleteModule(data.modules.find(m=>m.id===selectedModuleId)||null)}
        onChangeOfferings={updated=>mutate(d=>{
          const isTarget=(o:Offering)=>o.moduleId===selectedModuleId&&o.semesterId===moduleEditorSemester?.id&&!isAssessment(o.category)
          const previous=d.offerings.filter(isTarget)
          const next=[...new Map(updated.map(o=>[o.id,o])).values()]
          const keptIds=new Set(next.map(o=>o.id))
          const removedIds=new Set(previous.filter(o=>!keptIds.has(o.id)).map(o=>o.id))
          let inserted=false
          const merged:Offering[]=[]
          for(const o of d.offerings){
            if(isTarget(o)){
              if(!inserted){merged.push(...next);inserted=true}
            }else merged.push(o)
          }
          if(!inserted)merged.push(...next)
          return {...d,offerings:merged,
            alternatives:(d.alternatives||[]).filter(a=>!removedIds.has(a.parentOfferingId))}
        })}
        onChangeAssessments={assessments=>mutate(d=>({...d,assessments}))}
        onEditAssessment={setEditingAssessment}
        onAddAssessment={type=>{if(!moduleEditorSemester)return;const examEnd=examVisibilityEnd(moduleEditorSemester);const base=today()<moduleEditorSemester.start?moduleEditorSemester.start:today()>examEnd?examEnd:today();setAssessmentDraft({date:base,from:'10:00',to:'12:00',type,moduleId:selectedModuleId})}}
        onOpenOccurrence={setDetail}
        onClearException={(id,origin)=>mutate(d=>({...d,offerings:d.offerings.map(o=>o.id===id
          ?{...o,overrides:Object.fromEntries(Object.entries(o.overrides||{}).filter(([day])=>day!==origin))}
          :o)}))}
        learningSessions={data.learningSessions||[]}
        learningCheckins={data.learningCheckins||[]}
        lessonTopics={data.lessonTopics||[]}
        onChangeLearningSessions={learningSessions=>mutate(d=>{
          const now=new Date().toISOString(),nextById=new Map(learningSessions.map(item=>[item.id,item]))
          const scoreEvents=(d.scoreEvents||[]).map(event=>{
            if(event.type!=='study-minutes')return event
            const previous=(d.learningSessions||[]).find(item=>item.id===event.sourceId)
            if(!previous)return event
            const next=nextById.get(previous.id)
            if(!next)return {...event,reversedAt:now}
            const basePoints=next.duration*SCORE_RULES.minute
            return {...event,basePoints,points:Math.round(basePoints*event.multiplier),occurredAt:next.updatedAt,reversedAt:undefined,label:`${next.duration} Min. gelernt`}
          })
          return {...d,learningSessions,scoreEvents}
        })}
        onChangeLearningCheckins={learningCheckins=>mutate(d=>{
          const now=new Date().toISOString(),nextKeys=new Set(learningCheckins.map(item=>item.key))
          return {...d,learningCheckins,scoreEvents:(d.scoreEvents||[]).map(event=>
            (event.type==='checkin'||event.type==='attendance')&&(d.learningCheckins||[]).some(item=>item.key===event.sourceId)&&!nextKeys.has(event.sourceId)
              ?{...event,reversedAt:now}:event)}
        })}
      />}
      {page === 'admin' && user && admin && <AdminPanel user={user} notice={note} onBack={()=>{pageHistory.current.pop();navigatePage('dashboard',false);setProfileOpen(true)}} />}

      </div>
    </div>
    <nav className="mobile-navigation" aria-label="Hauptnavigation">{([{id:'overview' as const,name:'Dashboard',icon:House}, { id: 'dashboard' as const, name: 'Lernen', icon: Layers2 }, { id: 'calendar', name: 'Stundenplan', icon: CalendarDays }] as const).map(item => <button key={item.id} className={page === item.id ? 'active' : ''} onClick={() => navigatePage(item.id)}><span className="nav-icon-wrap"><item.icon size={21} /></span><span>{item.name}</span></button>)}</nav>
    {profileOpen&&<ProfileOverlay data={data} onMutate={mutate} onCreateModule={()=>{setNewModuleStatus('planned');setNewModuleSemesterIds([]);setNewModule(true)}} settings={settingsContent} onClose={closeProfile} onProfileChange={name=>mutate(d=>({...d,profile:name}))} onModule={module=>{mutate(d=>({...d,activeDegreeId:module.degreeId,activeSemesterId:d.semesters.find(item=>item.id===d.activeSemesterId&&item.degreeId===module.degreeId)?.id||d.semesters.find(item=>item.degreeId===module.degreeId&&item.start<=today()&&item.end>=today())?.id||d.semesters.find(item=>item.degreeId===module.degreeId)?.id||d.activeSemesterId}));setSelectedModuleId(module.id);navigatePage('modules')}}/>}
    {streakCelebration!==null&&<StreakCelebration count={streakCelebration} onClose={closeStreak}/>}
    {newModule&&<BottomSheet title="Neues Modul" onClose={()=>setNewModule(false)} footer={<button className="primary-action" onClick={saveNewModule}>Modul erstellen · +100 <Sparkles size={18}/></button>}>
      <div className="uf-entry-form"><div className="editor-field"><span className="field-label">Modulname</span><input autoFocus className="line-input" value={newName} onChange={event=>setNewName(event.target.value)} placeholder="z. B. Geographie" /></div><div className="editor-field"><span className="field-label">Leistungspunkte</span><input className="line-input" type="number" min="0" step="0.5" value={newCredits} onChange={event=>setNewCredits(event.target.value)} /></div><label className="editor-field">Status<UniflowPicker label="Modulstatus" value={newModuleStatus} onChange={value=>setNewModuleStatus(value as StudyModule['status'])} options={[{value:'planned',label:'Geplant'},{value:'current',label:'Aktuell'}]}/></label><SemesterAssignment data={data} module={{id:'draft',degreeId:data.activeDegreeId,name:newName,shortName:'',credits:Number(newCredits)||0,color:'#aaa',status:newModuleStatus,grade:'',counted:true,hidden:false,semesterIds:newModuleSemesterIds}} onMutate={mutate} onChange={module=>setNewModuleSemesterIds(module.semesterIds)}/><p className="scope-intro">Dein neues Modul startet sofort mit einem Bonus von 100 Punkten.</p></div>
    </BottomSheet>}
    {assessmentDraft&&(page==='modules'?moduleEditorSemester:semester)&&<AssessmentEditor key={`${assessmentDraft.type}-${assessmentDraft.date}`} initial={assessmentDraft} semester={(page==='modules'?moduleEditorSemester:semester)!} modules={page==='modules'?degreeModules:semesterModules} onClose={()=>setAssessmentDraft(null)} onSave={assessment=>{mutate(d=>({...d,assessments:upsertAssessment(d.assessments,assessment)}));setAssessmentDraft(null);note(assessment.type==='exam'?'Prüfung hinzugefügt.':'Hausaufgabe hinzugefügt.')}}/>}
    {previewAssessment&&<AssessmentPreview item={previewAssessment}
      module={data.modules.find(m=>m.id===previewAssessment.moduleId)}
      onClose={()=>setPreviewAssessmentId(null)}
      onToggle={()=>mutate(d=>({...d,assessments:d.assessments.map(item=>
        item.id===previewAssessment.id?{...item,completed:!item.completed}:item)}))}
      onEdit={()=>{setEditingAssessment(previewAssessment);setPreviewAssessmentId(null)}}/>}
    {editingAssessment&&semester&&<AssessmentEditor key={editingAssessment.id} initial={{date:editingAssessment.date,from:editingAssessment.from||'10:00',to:editingAssessment.to||'12:00',type:editingAssessment.type}} existing={editingAssessment} semester={data.semesters.find(item=>item.id===editingAssessment.semesterId)||semester} modules={degreeModules} onClose={()=>setEditingAssessment(null)} onSave={assessment=>{mutate(d=>({...d,assessments:upsertAssessment(d.assessments,assessment)}));setEditingAssessment(null);note('Eintrag gespeichert.')}} onDelete={()=>{setDeletingAssessment(editingAssessment);setEditingAssessment(null)}}/>}
    {deletingAssessment&&<BottomSheet title={deletingAssessment.type==='exam'?'Prüfung löschen?':'Hausaufgabe löschen?'} onClose={()=>setDeletingAssessment(null)}><p className="scope-intro">„{deletingAssessment.title}“{deletingAssessment.date?' am '+formDate(deletingAssessment.date):''} wird endgültig gelöscht. Andere Termine und Veranstaltungen bleiben unverändert.</p><button className="danger-simple" onClick={()=>{mutate(d=>{const remaining=d.assessments.filter(x=>x.id!==deletingAssessment.id);return {...d,assessments:remaining}});setDeletingAssessment(null);note('Eintrag gelöscht.')}}><Trash2 size={18}/> Eintrag endgültig löschen</button><button className="dismiss-action" onClick={()=>setDeletingAssessment(null)}>Abbrechen</button></BottomSheet>}
    {entry && semester && <EntryEditor key={entry.date + entry.from} initial={entry} modules={semesterModules} semester={semester} onSave={onAddOffer} onClose={() => setEntry(null)} onCreateModule={(name, credits) => { const id = uid(); if (degree) { const now=new Date().toISOString(); mutate(d => ({ ...d, modules: [...d.modules, { id, degreeId: degree.id, name, shortName: acronym(name), credits, color: colors[degreeModules.length % colors.length], emoji: '', status: 'current', grade: '', counted: true, hidden: false, semesterIds: semester ? [semester.id] : [] }],scoreEvents:[...(d.scoreEvents||[]),makeScoreEvent({id:`module-created:${id}`,moduleId:id,type:'module-created',basePoints:SCORE_RULES.moduleCreated,occurredAt:now,sourceId:id,label:'Startbonus'})] })); note('Modul hinzugefügt · +100 Startpunkte') } return id }} />}
    {ratingLesson&&ratingOccurrence&&<BottomSheet title="Check-in" onClose={()=>setRatingOccurrence(null)} compactHeader
      headerAction={<button type="button" className="sheet-header-save" onClick={saveRatingDraft}>Speichern</button>}>
      <div className="learn-checkin-heading" aria-label="Besuch und Verständnis zur Veranstaltung">
        <div><strong style={{color:ratingModule?.color||"#ededed"}}>{ratingModule?.name||ratingOccurrence.offering.name}</strong>
          <span>{ratingNumbered?.label||ratingOccurrence.offering.category} · {formatDate(ratingLesson.date,{day:'numeric',month:'short'})}</span></div>
      </div>
      <div className="mlh-calendar-checkin">
        <button type="button" role="checkbox" aria-checked={ratingDraftAttended} className={ratingDraftAttended?'active':''} onClick={()=>setRatingDraftAttended(value=>!value)}><i>{ratingDraftAttended?<Check size={16}/>:null}</i><span><strong>Ich war da</strong><small>Besuch eintragen · +{attendancePoints(ratingOccurrence.offering.category)} Punkte</small></span></button>
        <div><span>Wie gut hast du den Stoff verstanden?</span>{([
          {value:'understood',label:'Gut'}, {value:'partial',label:'Teilweise'}, {value:'struggling',label:'Gar nicht'}
        ] as const).map(option=><button type="button" key={option.value} className={ratingDraftValue===option.value?'active':''} onClick={()=>setRatingDraftValue(option.value)}>{option.label}</button>)}</div>
      </div>
    </BottomSheet>}
    {detail && <EventDetails occ={detail} module={degreeModules.find(m=>m.id===detail.offering.moduleId)} modules={semesterModules} offerings={data.offerings} data={data}
      onAddAlternative={kind=>{setAlternativeDraft({occ:detail,kind});setDetail(null)}}
      onSelectAlternative={alt=>chooseAlternative(alt,detail)}
      onInspectAlternative={alt=>setDetail(alt)}
      onClose={()=>setDetail(null)}
      onSuspend={()=>{setPauseProposal({occ:detail,date:detail.date,from:detail.from,to:detail.to});setDetail(null)}}
      onRestore={()=>{mutate(d=>({...d,offerings:undoSingleChoice(d.offerings,detail)}));setDetail(null);note('Einmalige Auswahl zurückgenommen.')}}
      onEdit={()=>{setEditingOffering(detail);setDetail(null)}}
      onMove={()=>{setEditingOffering(detail);setDetail(null)}}
      onDelete={()=>{setDeleteProposal({occ:detail,date:detail.date,from:detail.from,to:detail.to});setDetail(null)}} />}
    {alternativeDraft&&<AlternativeEditor key={alternativeDraft.occ.key+alternativeDraft.kind} occ={alternativeDraft.occ} kind={alternativeDraft.kind} modules={semesterModules} onClose={()=>setAlternativeDraft(null)} onSave={onAddAlternative}/>}
    {editingOffering&&<AlternativeEditor key={editingOffering.offering.id} occ={editingOffering} kind="group" editing={editingOffering.offering} modules={semesterModules} onClose={()=>setEditingOffering(null)} onSave={onEditOffering} onDelete={()=>{setDeleteProposal({occ:editingOffering,date:editingOffering.date,from:editingOffering.from,to:editingOffering.to});setEditingOffering(null)}}/>}
    {pendingAlternative&&<BottomSheet title={pendingAlternative.conflict?'Zeitüberschneidung':'Gruppe auswählen'} onClose={()=>setPendingAlternative(null)}>
      <p className="scope-intro">{pendingAlternative.kind==='free'?'Diese Gruppe wird bisher nicht besucht. Du kannst sie einmal oder dauerhaft in deinen Stundenplan aufnehmen.':pendingAlternative.kind==='group'
        ? 'Beide Termine gehören zum gleichen Inhalt. Du kannst zu einer anderen Gruppe wechseln oder beide besuchen.'
        : 'Hier liegt ein anderes Modul zur selben Zeit. Du kannst wechseln oder beide Termine sichtbar lassen.'}
        {pendingAlternative.conflict&&' Achtung: Am Ziel gibt es eine zeitliche Überschneidung.'}</p>
      <div className="move-summary"><strong>{pendingAlternative.alt.offering.name}{pendingAlternative.alt.offering.organizer?' · '+pendingAlternative.alt.offering.organizer:''}</strong><span>{formatDate(pendingAlternative.alt.date)} · {pendingAlternative.alt.from}–{pendingAlternative.alt.to}{placeLabel(pendingAlternative.alt.offering)?' · '+placeLabel(pendingAlternative.alt.offering):''}</span></div>
      {pendingAlternative.occ&&<div className="attendance-modes" role="group" aria-label="Besuchsentscheidung">
        <button className={choiceAttendance==='replace'?'chosen':''} onClick={()=>setChoiceAttendance('replace')}><Check size={17}/><span><strong>Zur anderen Gruppe wechseln</strong><small>Die bisherige Veranstaltung bleibt im Hintergrund als Alternative erhalten.</small></span></button>
        <button className={choiceAttendance==='both'?'chosen':''} onClick={()=>setChoiceAttendance('both')}><Plus size={17}/><span><strong>Beide besuchen</strong><small>Beide Termine erscheinen im Plan{pendingAlternative.conflict?' – auch bei Überschneidung.':'.'}</small></span></button>
      </div>}
      <p className="scope-intro">Wie lange soll diese Auswahl gelten?</p>
      <div className="scope-choices"><button onClick={()=>applyChoice('single')}><span><strong>{pendingAlternative.occ?'Nur dieses Mal wechseln':'Einmal besuchen'}</strong><small>Nur die ausgewählte Veranstaltungswoche</small></span><ArrowRight size={18}/></button>
      {(!pendingAlternative.occ||pendingAlternative.occ.offering.recurrence!=='once')&&pendingAlternative.alt.offering.recurrence!=='once'&&<button onClick={()=>applyChoice('future')}><span><strong>{pendingAlternative.occ?'Ab jetzt und zukünftig wechseln':'Immer besuchen'}</strong><small>Vergangene Wochen bleiben unverändert</small></span><ArrowRight size={18}/></button>}</div>
      <button className="dismiss-action" onClick={()=>setPendingAlternative(null)}>Abbrechen</button>
    </BottomSheet>}
    {deleteProposal&&<DeleteSheet proposal={deleteProposal} onConfirm={onDelete} onClose={()=>setDeleteProposal(null)}/>}
    {pauseProposal&&<MoveScope proposal={pauseProposal} mode="delete" onClose={()=>setPauseProposal(null)} onConfirm={onPause}/>}
    {editingModule&&<ModuleEditor module={editingModule} onClose={()=>setEditingModule(null)} onSave={m=>{updateModules(data.modules.map(x=>x.id===m.id?m:x));setEditingModule(null);note('Modul gespeichert.')}} onDelete={()=>{setConfirmDeleteModule(editingModule);setEditingModule(null)}}/>}
    {confirmDeleteSemester && <BottomSheet title="Semester löschen?" onClose={()=>{setConfirmDeleteSemester(null);setSemesterDeleteText('')}}>
      <p className="scope-intro">{confirmDeleteSemester.name} und die dazugehörigen Kalendertermine werden gelöscht. Die Module bleiben im Studiengang erhalten, werden aber von diesem Semester gelöst.</p>
      <label className="delete-confirm-field"><span>Tippe zur Bestätigung exakt:</span><strong>{semesterDeletePhrase}</strong><input autoFocus value={semesterDeleteText} onChange={event=>setSemesterDeleteText(event.target.value)} autoComplete="off" spellCheck={false}/></label>
      <button className="primary-action" disabled={semesterDeleteText.trim()!==semesterDeletePhrase} onClick={()=>{const id=confirmDeleteSemester.id;const removedOfferingIds=new Set(data.offerings.filter(o=>o.semesterId===id).map(o=>o.id));mutate(d=>({...d, semesters:d.semesters.filter(s=>s.id!==id), activeSemesterId:d.activeSemesterId===id?(d.semesters.find(s=>s.id!==id&&s.degreeId===confirmDeleteSemester.degreeId)?.id||''):d.activeSemesterId, offerings:d.offerings.filter(o=>o.semesterId!==id), assessments:d.assessments.filter(a=>a.semesterId!==id), alternatives:(d.alternatives||[]).filter(a=>!removedOfferingIds.has(a.parentOfferingId)), modules:d.modules.map(m=>({...m,semesterIds:m.semesterIds.filter(x=>x!==id)}))}));setConfirmDeleteSemester(null);setSemesterDeleteText('');note('Semester gelöscht.')}}>Semester und Termine löschen</button>
      <button className="dismiss-action" onClick={()=>{setConfirmDeleteSemester(null);setSemesterDeleteText('')}}>Abbrechen</button>
    </BottomSheet>}
    {confirmDeleteModule && <BottomSheet title="Modul löschen?" onClose={() => setConfirmDeleteModule(null)}><p className="scope-intro">„{confirmDeleteModule.name}“ und alle zugehörigen Termine werden gelöscht. Das lässt sich nicht rückgängig machen.</p><button className="primary-action" onClick={() => { mutate(d => ({ ...d, modules: d.modules.filter(m => m.id !== confirmDeleteModule.id), offerings: d.offerings.filter(o => o.moduleId !== confirmDeleteModule.id), assessments:d.assessments.filter(a=>a.moduleId!==confirmDeleteModule.id), alternatives: (d.alternatives || []).filter(a => a.moduleId !== confirmDeleteModule.id && !d.offerings.some(o => o.moduleId === confirmDeleteModule.id && o.id === a.parentOfferingId)) })); setConfirmDeleteModule(null);setSelectedModuleId(null);navigatePage('dashboard',false); note('Modul gelöscht.') }}>Modul und Termine löschen</button><button className="dismiss-action" onClick={() => setConfirmDeleteModule(null)}>Abbrechen</button></BottomSheet>}
    {pendingBackup && <BottomSheet title="Backup importieren?" onClose={() => setPendingBackup(null)}><p className="scope-intro">Das Backup ersetzt die derzeitigen lokalen uniflow-Daten auf diesem Gerät.</p><button className="primary-action" onClick={() => { setData(pendingBackup); setOnboarding(!pendingBackup.activeDegreeId); setPendingBackup(null); note('Backup wiederhergestellt.') }}>Backup wiederherstellen</button><button className="dismiss-action" onClick={() => setPendingBackup(null)}>Abbrechen</button></BottomSheet>}
    {confirmReset && <BottomSheet title="Neu anfangen?" onClose={() => setConfirmReset(false)}><p className="scope-intro">Dein uniflow-Stundenplan, deine Module und Semester werden auch in unicloud auf einen leeren Stand zurückgesetzt. Speichere vorher ein Backup, wenn du sie behalten möchtest.</p><button className="primary-action" onClick={() => void doReset()} disabled={cloudBusy}>Alle Daten löschen</button><button className="dismiss-action" onClick={() => setConfirmReset(false)}>Abbrechen</button></BottomSheet>}
    {toast && <Notice key={toast.id} toast={toast} onDismiss={() => setToast(current => current?.id === toast.id ? null : current)}/>}
  </div>
}
