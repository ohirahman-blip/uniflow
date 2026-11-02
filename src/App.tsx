Warning: truncated output (original token count: 52341)
Total output lines: 1978

import {SemesterAssignment} from './StudyManagement'
import {useSwipeToDismiss} from './useSwipeToDismiss'
import { createPortal } from 'react-dom'
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent, type WheelEvent as ReactWheelEvent, type ReactNode } from 'react'
import { ArrowLeft, ArrowRight, BookOpen, CalendarDays, Check, ChevronDown, Clock3, Download, Grip, Info, Plus, LayoutGrid, RotateCcw, Search, Settings2, Trash2, PauseCircle, Upload, X, LogOut, RefreshCw, Layers2, CalendarCheck2, ClipboardList, GraduationCap, PenLine, Sparkles, Star, Focus, ChevronLeft, ChevronRight, House, Users } from 'lucide-react'
import { acronym, candidateOccurrencesOn, occurrenceAtOrigin, selectedAssessment, setOfferingAttendance, suspendOffering, undoSingleChoice, removeOfferingGroup, findMainForInactive, sameContent, linkedCandidates, chooseOffering, intersects, isAssessment, separateAssessments, addDays, colors, currentSemesterDates, emptyData, examVisibilityEnd, formatDate, fromDate, loadData, migrateLegacy, minutes, moveOccurrence, nextSemesterDates, occurrencesOn, overlaps, semesterFromStart, STORE, timeString, today, uid, upsertAssessment, weekStart, weekday, type Alternative, type Assessment, type AppData, type CalendarView, type CreditGoal, type Degree, type Occurrence, type Offering, type Repeat, type Semester, type StudyModule } from './model'
import { supabase, signOutApple, sendEmailCode, verifyEmailCode, fetchCatalog, fetchAdminAccounts, isAdmin, cloudSave, cloudLoad, updatePremium, fetchOwnPremium, publishFriendStatus, type UniversityRow, type DegreeCatalogRow, type ModuleCatalogRow, type AccountRow } from './supabase'
import type { User } from '@supabase/supabase-js'
import ModuleScheduleEditor from './ModuleScheduleEditor'
import { configurePushPreferences } from './push-notifications'
import CalendarMonthOverview from './CalendarMonthOverview'
import { shiftCalendarMonth } from './calendar-month'
import {initialCalendarDay,rememberCalendarDay} from './calendar-preferences'
import { adjacentCalendarPage, alignCalendarStart, datesForCalendarPage, twoDayRail, weekHeaderDates } from './calendar-navigation'
import UniflowPicker from './UniflowPicker'
import ModuleLearningHome from './ModuleLearningHome'
import OverviewDashboard from './OverviewDashboard'
import FriendsPage from './FriendsPage'
import StudyUtilities from './StudyUtilities'
import ProfileOverlay from './ProfileOverlay'
import StudyPlanSettings from './StudyPlanSettings'
import {buildStudyPlan,studyGapSuggestions,type StudyDayBundle,type StudyPlan} from './adaptive-study-plan'
import StreakCelebration from './StreakCelebration'
import LearningRewardCelebration from './LearningRewardCelebration'
import {rewardPoints,type LearningReward} from './learning-reward'
import {useStreakAudio} from './streak-audio'
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
import './study-game.css'
import './module-progress-polish.css'
import './study-plan.css'

type Page = 'overview' | 'dashboard' | 'calendar' | 'friends' | 'modules' | 'settings' | 'admin'
const pageFromUrl = (userId?: string): Page => {
  let saved: string | null = null
  try { if(userId)saved=localStorage.getItem('uniflow-last-page:'+userId) } catch { /* Storage may be unavailable. */ }
  const requested = new URLSearchParams(window.location.search).get('page') || saved
  return requested === 'calendar'||requested==='overview'||requested==='friends' ? requested : 'dashboard'
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
    if (!category.trim()) return setError('Wähle …22341 tokens truncated…hot)
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
    if(session.timerId&&(data.learningSessions||[]).some(old=>old.timerId===session.timerId))return
    const now=new Date().toISOString(),id=uid(),groupId=`study:${id}`
    pendingRewards.current.set(groupId,{moduleId:session.moduleId,kind:'session'})
    mutate(workspace=>session.timerId&&(workspace.learningSessions||[]).some(old=>old.timerId===session.timerId)?workspace:({...workspace,
      studyTimer:session.timerId&&workspace.studyTimer?.id===session.timerId?undefined:workspace.studyTimer,
      learningSessions:[...(workspace.learningSessions||[]).filter(old=>!session.scheduledKey||old.scheduledKey!==session.scheduledKey),{...session,id,updatedAt:now}],
      scoreEvents:[...(workspace.scoreEvents||[]),makeScoreEvent({id:`study-minutes:${id}`,moduleId:session.moduleId,type:'study-minutes',basePoints:session.duration*SCORE_RULES.minute,occurredAt:now,sourceId:id,groupId,label:`${session.duration} Min. gelernt`})]
    }))
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
    pendingRewards.current.set(groupId,{moduleId,kind:'content'})
    mutate(workspace=>{
      let events=[...(workspace.scoreEvents||[]),makeScoreEvent({id:`study-minutes:${id}`,moduleId,type:'study-minutes',basePoints:duration*SCORE_RULES.minute,occurredAt:now,sourceId:id,groupId,label:`${lessons.length} Einheiten gelernt`})]
      for(const lesson of lessons){
        const eventId=`content-learned:${lesson.key}`
        if(events.some(event=>event.id===eventId&&!event.reversedAt))continue
        events=upsertScoreEvent(events,makeScoreEvent({id:eventId,moduleId,type:'content-learned',basePoints:learnedPoints(lesson.category),occurredAt:now,sourceId:lesson.key,groupId,label:`${lesson.label} gelernt`}))
      }
      return {...workspace,learningSessions:[...(workspace.learningSessions||[]),{id,moduleId,date:today(),duration,kind:'review' as const,rating,lessonKeys:lessons.map(lesson=>lesson.key),updatedAt:now}],scoreEvents:events}
    })
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
  useEffect(()=>{
    if(!user||!cloudReady||onboarding)return
    const now=new Date(),clock=now.getHours()*60+now.getMinutes(),day=today()
    const events=occurrencesOn(data.offerings,day).filter(item=>!item.cancelled&&!isAssessment(item.offering.category)&&item.offering.category!=='Freies Lernen').sort((a,b)=>a.from.localeCompare(b.from)).map(item=>{
      const lesson=lessonForOccurrence(item,data),module=data.modules.find(entry=>entry.id===item.offering.moduleId)
      return {title:module?.name||item.offering.name,from:item.from,to:item.to,room:item.offering.room||undefined,attending:(data.learningCheckins||[]).some(checkin=>checkin.key===lesson.key&&(checkin.attended??checkin.rating!=='absent'))}
    })
    const current=events.find(event=>minutes(event.from)<=clock&&clock<minutes(event.to))||null
    const timer=window.setTimeout(()=>void publishFriendStatus({university:degree?.university||'',current,events}).catch(()=>{}),350)
    return()=>window.clearTimeout(timer)
  },[user?.id,cloudReady,onboarding,data.offerings,data.learningCheckins,data.modules,degree?.university,adviceClock])
  const studyPlanDate=today()
  const deterministicPlan=useMemo(()=>buildStudyPlan(data,studyPlanDate),[data.activeDegreeId,data.modules,data.semesters,data.offerings,data.assessments,data.learningSessions,data.learningCheckins,data.scoreEvents,data.studySchedule,studyPlanDate])
  const currentStudyContext=useMemo(()=>adviceContext(data,semester,semesterModules,new Date()),[data,semester,adviceClock])
  const currentModuleId=useMemo(()=>{
    const now=new Date(),clock=now.getHours()*60+now.getMinutes()
    return occurrencesOn(data.offerings,today()).filter(occ=>!occ.cancelled&&occ.offering.semesterId===semester?.id&&semesterModules.some(module=>module.id===occ.offering.moduleId)&&!isAssessment(occ.offering.category)&&minutes(occ.from)<=clock&&clock<minutes(occ.to)).sort((a,b)=>b.from.localeCompare(a.from))[0]?.offering.moduleId
  },[data.offerings,semester?.id,adviceClock,semesterModules])
  const contextualColor=data.modules.find(module=>module.id===(page==='modules'?selectedModuleId:page==='calendar'?(focusModuleId||currentModuleId):activeLearningModuleId))?.color||'#d4d4d8'
  useEffect(()=>{
    for(const property of ['--module-accent','--mlh-accent','--uniflow-accent','--uf-primary'])document.documentElement.style.setProperty(property,contextualColor)
  },[contextualColor])
  const ai=usePremiumAdvice(user?.id||'',premium,currentStudyContext,!!user&&cloudReady&&!onboarding&&page==='overview'&&!profileOpen)
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
  if (!user) return <><AuthScreen/>{toast && <Notice key={toast.id} toast={toast} onDismiss={() => setToast(null)}/>}</>
  if (!cloudReady) return <main className="app-loading-shell" aria-label="Deine Daten werden geladen"><aside/><div><header/><section/><section/><section/></div>{cloudStatus === 'error'&&<div className="app-loading-error"><p>{cloudError}</p><button className="primary-action" onClick={()=>void loadUserWorkspace(user,authEpoch.current)}>Erneut versuchen</button><button className="auth-secondary" onClick={()=>void logOut()}>Abmelden</button></div>}</main>
  if (onboarding) return <><Onboarding catalog={catalog} onSignOut={() => void logOut()} onDone={d => { setData(applyScoreAwards(emptyData,d)); setOnboarding(false); pageHistory.current=[]; setPage('dashboard') }} onInfo={note} />{toast && <Notice key={toast.id} toast={toast} onDismiss={() => setToast(current => current?.id === toast.id ? null : current)}/>}</>
  const settingsContent=(<div className="screen secondary-screen settings-screen"><section className="settings-section"><h2>Darstellung</h2><label className="settings-theme"><span>Farbschema</span><UniflowPicker label="Darstellung" value={data.theme||'dark'} onChange={value=>mutate(workspace=>({...workspace,theme:value==='light'?'light':'dark'}))} options={[{value:'dark',label:'Dunkel'},{value:'light',label:'Hell'}]}/></label></section><section className="settings-section"><h2>Sound</h2><div className="settings-sound-row"><span id="sound-effects-label">Soundeffekte</span><button type="button" role="switch" aria-checked={data.soundEffects!==false} aria-labelledby="sound-effects-label" className={'settings-ai-toggle'+(data.soundEffects!==false?' is-on':'')} onClick={()=>mutate(workspace=>({...workspace,soundEffects:workspace.soundEffects===false}))}><span/></button></div></section><section className="settings-section"><h2>Studium</h2><div className="setting-line"><span>Studiengang</span><strong>{degree?.name}</strong></div><div className="setting-line"><span>Hochschule</span><strong>{degree?.university || 'Nicht angegeben'}</strong></div><div className="setting-line"><span>LP-Ziel</span><div className="number-setting"><input type="number" min="0" value={degree?.targetCredits || 0} onChange={e => mutate(d => ({ ...d, degrees: d.degrees.map(x => x.id === degree?.id ? { ...x, targetCredits: +e.target.value || 0 } : x) }))} /> LP</div></div></section>{admin && <section className="settings-section admin-settings-link">
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
      </section><StudyPlanSettings preferences={deterministicPlan.preferences} onChange={studySchedule=>mutate(workspace=>({...workspace,studySchedule}))}/><section className="settings-section"><h2>Stundenplan</h2>{([{key:'showAlternatives',label:'Alternativtermine anzeigen'},{key:'showStudySuggestions',label:'Lernvorschläge anzeigen'}] as const).map(setting=><div className="setting-line" key={setting.key}><span id={'calendar-display-'+setting.key}>{setting.label}</span><button type="button" role="switch" aria-checked={data.calendarPreferences?.[setting.key]!==false} aria-labelledby={'calendar-display-'+setting.key} className={'settings-ai-toggle'+(data.calendarPreferences?.[setting.key]!==false?' is-on':'')} onClick={()=>mutate(workspace=>({...workspace,calendarPreferences:{...workspace.calendarPreferences,[setting.key]:workspace.calendarPreferences?.[setting.key]===false}}))}><span/></button></div>)}<small className="setting-hint">Nur die Anzeige ändert sich. Deine Termine und dein Lernplan bleiben erhalten.</small><div className="setting-line"><span>Zeitraum</span><strong>00:00–24:00</strong></div><div className="setting-line"><span>Woche anzeigen bis</span><div className="inline-toggle week-end-toggle">{([{v:4,label:'Fr'},{v:5,label:'Sa'},{v:6,label:'So'}] as const).map(x=><button key={x.v} className={(data.weekEndDay??4)===x.v?'selected':''} onClick={()=>mutate(d=>({...d,weekEndDay:x.v}))}>{x.label}</button>)}</div></div><small className="setting-hint">Die Wochenansicht endet am gewählten Tag. Spätere Termine bleiben über die Tages- oder Zwei-Tage-Ansicht erreichbar.</small><small className="setting-hint">Der Zeitraum bleibt fest. Veranstaltungen werden minutengenau dargestellt.</small></section><section className="settings-section"><h2>Semester</h2><div className="semester-picker-list">{data.semesters.filter(s => s.degreeId === degree?.id).map(s => <button key={s.id} className={s.id === semester?.id ? 'current' : ''} onClick={() => { mutate(d => ({ ...d, activeSemesterId: s.id })); note(`${s.name} geöffnet.`) }}><span><strong>{s.name}</strong><small>{formDate(s.start)} – {formDate(s.end)}</small></span>{s.id === semester?.id && <Check size={18} />}</button>)}</div>{semester && <label className="setting-input"><span>Letzter Vorlesungstag</span><DateControl value={semester.lectureEnd} min={semester.start} max={semester.end} onChange={v => mutate(d => ({ ...d, semesters: d.semesters.map(s => s.id === semester.id ? { ...s, lectureEnd: v } : s) }))} /></label>}<button className="underlined-link" onClick={() => { if (!degree) return; const recent = data.semesters.filter(s => s.degreeId === degree.id).sort((a, b) => b.end.localeCompare(a.end))[0]; const start = recent ? addDays(recent.end, 1) : currentSemesterDates().start; const next = semesterFromStart(start); if (data.semesters.some(s => s.degreeId === degree.id && overlaps(s.start, s.end, next.start, next.end))) { note('Dieses Semester ist bereits vorhanden.'); return } const newSemester: Semester = { ...next, id: uid(), degreeId: degree.id, archived: false }; mutate(d => ({ ...d, semesters: [...d.semesters, newSemester], activeSemesterId: d.activeSemesterId })); note('Nächstes Semester gespeichert. Das aktuelle bleibt ausgewählt.') }}>Nächstes Semester hinzufügen <Plus size={17} /></button><div className="semester-management"><h3>Semester verwalten</h3>{data.semesters.filter(x=>x.degreeId===degree?.id).map(x=><div key={x.id} className="semester-manage-row"><span><strong>{x.name}</strong><small>{x.id===semester?.id?'Ausgewählt':x.start>today()?'Geplant':x.end<today()?'Vergangen':'Laufend'} · {formDate(x.start)} – {formDate(x.end)}</small></span><button aria-label={`${x.name} löschen`} onClick={()=>setConfirmDeleteSemester(x)}><Trash2 size={18}/></button></div>)}</div></section><section className="settings-section"><h2>Deine Daten</h2><button className="settings-action" onClick={saveBackup}><Download size={19} /> Backup herunterladen <ArrowRight size={17} /></button><button className="settings-action" onClick={() => fileRef.current?.click()}><Upload size={19} /> Backup importieren <ArrowRight size={17} /></button><input ref={fileRef} type="file" accept=".json,application/json" hidden onChange={e => { void readBackup(e.target.files?.[0]); e.target.value = '' }} /><button className="settings-action settings-danger" onClick={() => setConfirmReset(true)}><RotateCcw size={19} /> Alles zurücksetzen <ArrowRight size={17} /></button><div className="cloud-account-state"><div><strong>unicloud</strong><small>{cloudStatus === 'synced' ? 'Alle Änderungen gespeichert' : cloudStatus === 'saving' ? 'Synchronisiere …' : cloudStatus === 'error' ? 'Synchronisierung fehlgeschlagen' : 'Verbunden'}</small></div>{cloudStatus === 'synced' ? <Check size={19}/> : <RefreshCw size={19}/>}</div>{cloudStatus === 'error' && <p className="auth-error">{cloudError}</p>}<button className="settings-action" disabled={cloudBusy || cloudStatus === 'saving'} onClick={() => void syncNow()}><RefreshCw size={19}/> Jetzt synchronisieren <ArrowRight size={17}/></button><button className="settings-action" onClick={() => void logOut()}><LogOut size={19}/> uniflow abmelden <ArrowRight size={17}/></button><p className="quiet-copy">Angemeldet als {user.email || user.id.slice(0,8) + '…'}. Deine Daten werden beim Öffnen geladen und bei Änderungen automatisch in unicloud gespeichert. Bei gleichzeitigen Änderungen auf mehreren Geräten kann der zuletzt gespeicherte Stand gewinnen.</p></section></div>)
  return <div className="app-root"><div className="app-desktop-side"><div className="brand-side"><BrandMark premium={premium} page={page}/></div><nav>{([{id:'overview' as const,title:'Dashboard',icon:House}, { id: 'dashboard' as const, title: 'Lernen', icon: Layers2 }, { id: 'calendar' as const, title: 'Stundenplan', icon: CalendarDays }, {id:'friends' as const,title:'Freunde',icon:Users}, ...(admin ? [{ id:'admin' as const, title:'Admin', icon:Settings2 }] : [])] as const).map(n => <button key={n.id} className={page === n.id ? 'active' : ''} onClick={() => navigatePage(n.id)}><span className="nav-icon-wrap"><n.icon size={19} /></span>{n.title}</button>)}</nav><div className="sidebar-profile"><StudyUtilities days={data.streakDays} name={data.profile} degree={degree?.name||'Dein Studium'} onProfile={()=>setProfileOpen(true)} onStreak={()=>setStreakCelebration(streakCount(data.streakDays))}/></div></div>
    <div className="app-main">{page!=='dashboard'&&page!=='overview'&&!(page==='modules'&&selectedModuleId)&&<header className="app-top"><button className="app-brand" onClick={() => navigatePage('dashboard')}><BrandMark premium={premium} page={page}/></button></header>}
      <div key={page} className={"uf-page-stage uf-page-"+page+" uf-page-enter-"+pageDirection}>
      {page==='overview'&&<OverviewDashboard studyPlan={deterministicPlan} onStudyPlan={bundle=>{
        const subject=data.modules.find(module=>module.id===bundle.moduleId)
        const semesterId=subject?.semesterIds.includes(data.activeSemesterId)?data.activeSemesterId:subject?.semesterIds.find(id=>data.semesters.some(semester=>semester.id===id))
        if(!semesterId){note('Bitte ordne dem Modul zuerst ein Semester zu.');return}
        if(semesterId!==data.activeSemesterId)mutate(workspace=>({...workspace,activeSemesterId:semesterId}))
        setRequestedStudyBundle(bundle);navigatePage('dashboard')
      }} data={data} advice={ai.advice} aiEnabled={premium&&ai.consent} aiWorking={ai.working} aiError={ai.errorMessage} aiGeneratedAt={ai.generatedAt} aiStale={ai.isStale} onTimerChange={studyTimer=>mutate(workspace=>({...workspace,studyTimer}))} onSession={saveLearningSession} onProfile={()=>setProfileOpen(true)} onStreak={()=>setStreakCelebration(streakCount(data.streakDays))} onAddTask={addStudyTask} onToggleTask={toggleStudyTask} onDeleteTask={deleteStudyTask} onGoal={goal=>mutate(d=>({...d,dailyScoreGoal:goal}))} onAssessment={item=>setPreviewAssessmentId(item.id)} onCalendar={occ=>{setFocusModuleId(occ.offering.moduleId);navigatePage('calendar')}}/>}
      {page === 'dashboard' && <ModuleLearningHome requestedStudyBundle={requestedStudyBundle} onStudyBundleOpened={consumeStudyBundle} studyPlan={deterministicPlan} onStudyScheduleChange={studySchedule=>mutate(workspace=>({...workspace,studySchedule}))} data={data} semester={semester} modules={semesterModules}
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
        onEditModule={moduleId=>{moduleReturn.current={page,profile:false};setSelectedModuleId(moduleId);navigatePage('modules')}} onCreateModule={()=>{setNewModuleStatus('current');setNewModuleSemesterIds([]);setNewModule(true)}} />}
      {page === 'calendar' && <div className="screen screen-calendar">{semester ? <Calendar key={user.id+':'+semester.id} studyPlan={deterministicPlan} data={data} semester={semester} modules={semesterModules} userId={user.id} focusModuleId={focusModuleId} onFocusChange={setFocusModuleId} onNew={slot=>{if(isAssessment(slot.category||''))setAssessmentDraft({...slot,type:/klausur|prüfung|exam/i.test(slot.category||'')?'exam':'homework'});else setEntry(slot)}} onEditOccurrence={setEditingOffering} onRateOccurrence={openRatingOccurrence} onPreviewAssessment={item=>setPreviewAssessmentId(item.id)} onSelectGroup={(source,target,scope,both)=>{undoOfferings.current=data.offerings;mutate(d=>({...d,offerings:source?chooseOffering(d.offerings,source,target,scope,both):setOfferingAttendance(d.offerings,target,scope,true)}));note(both?'Beide Gruppen bleiben eingeplant.':'Besuchsauswahl aktualisiert.')}} onSuspendVisit={(occ,scope)=>{undoOfferings.current=data.offerings;mutate(d=>({...d,offerings:suspendOffering(d.offerings,occ,scope)}));note('Besuch ausgesetzt. Die Gruppe bleibt erhalten.')}} onCancelVisit={occ=>{undoOfferings.current=data.offerings;mutate(d=>({...d,offerings:d.offerings.map(item=>item.id===occ.offering.id?{...item,overrides:{...(item.overrides||{}),[occ.origin]:{date:occ.origin,from:occ.from,to:occ.to,cancelled:true,scope:'single',reason:'removal'}}}:item)}));note('Termin fällt ohne Ersatz aus.')}} onRestoreVisit={occ=>{undoOfferings.current=data.offerings;mutate(d=>({...d,offerings:undoSingleChoice(d.offerings,occ)}));note('Einmalige Auswahl zurückgenommen.')}} onRequestDeleteOccurrence={occ=>setDeleteProposal({occ,date:occ.date,from:occ.from,to:occ.to})} onOfferingsChange={offers => { undoOfferings.current = data.offerings; mutate(d => ({ ...d, offerings: offers })) }} onNotice={note} /> : <div className="page-blank"><h1>Dein Stundenplan</h1><p>Erstelle zuerst ein Semester in den Einstellungen.</p><button className="primary-action" onClick={() => navigatePage('settings')}>Einstellungen</button></div>}</div>}
      {page === 'modules' && selectedModuleId && data.modules.some(m=>m.id===selectedModuleId) && <ModuleScheduleEditor
        key={selectedModuleId}
        module={data.modules.find(m=>m.id===selectedModuleId)!}
        semester={moduleEditorSemester}
        offerings={data.offerings}
        assessments={data.assessments}
        journey={journeysByModule[selectedModuleId]}
        premium={premium}
        onBack={closeModuleEditor}
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
      {page === 'friends' && <FriendsPage onNotice={note}/>}

      </div>
    </div>
    <nav className="mobile-navigation" aria-label="Hauptnavigation" style={{'--nav-position':page==='overview'?1/8:page==='dashboard'?3/8:page==='calendar'?5/8:7/8,'--nav-highlight':(['overview','dashboard','calendar','friends'] as Page[]).includes(page)?1:0} as CSSProperties}><span className="mobile-nav-indicator" aria-hidden="true"/>{([{id:'overview' as const,name:'Dashboard',icon:House}, { id: 'dashboard' as const, name: 'Lernen', icon: Layers2 }, { id: 'calendar' as const, name: 'Plan', icon: CalendarDays },{id:'friends' as const,name:'Freunde',icon:Users}] as const).map(item => <button key={item.id} className={page === item.id ? 'active' : ''} aria-current={page===item.id?'page':undefined} onClick={() => navigatePage(item.id)}><span className="nav-icon-wrap"><item.icon size={21} /></span><span>{item.name}</span></button>)}</nav>
    {profileOpen&&<ProfileOverlay initialSection={profileSection} data={data} onMutate={mutate} onCreateModule={()=>{setNewModuleStatus('planned');setNewModuleSemesterIds([]);setNewModule(true)}} settings={settingsContent} onClose={closeProfile} onProfileChange={name=>mutate(d=>({...d,profile:name}))} onModule={module=>{moduleReturn.current={page:page==='modules'?'dashboard':page,profile:true};mutate(d=>({...d,activeDegreeId:module.degreeId,activeSemesterId:d.semesters.find(item=>item.id===d.activeSemesterId&&item.degreeId===module.degreeId)?.id||d.semesters.find(item=>item.degreeId===module.degreeId&&item.start<=today()&&item.end>=today())?.id||d.semesters.find(item=>item.degreeId===module.degreeId)?.id||d.activeSemesterId}));setSelectedModuleId(module.id);navigatePage('modules')}}/>}
    {learningRewards[0]&&<LearningRewardCelebration key={learningRewards[0].id} reward={learningRewards[0]} moduleName={data.modules.find(module=>module.id===learningRewards[0].moduleId)?.name||'Dein Lernfortschritt'} color={data.modules.find(module=>module.id===learningRewards[0].moduleId)?.color||'#a5d9bb'} soundEnabled={data.soundEffects!==false} onClose={closeLearningReward}/>}
    {learningRewards.length===0&&streakCelebration!==null&&<StreakCelebration soundEnabled={data.soundEffects!==false} count={streakCelebration} onClose={closeStreak}/>}
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
