import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { CalendarDays, Check, ChevronDown, ChevronLeft, ChevronRight, Clock3, Minus, Plus, X } from 'lucide-react'
import './UniflowPicker.css'

export type PickerOption = { value: string; label: string; detail?: string }
type Shared = { value: string; onChange: (value: string) => void; label: string; placeholder?: string; disabled?: boolean }
type Props =
  | (Shared & { kind?: 'select'; options: PickerOption[]; allowCustom?: boolean })
  | (Shared & { kind: 'time'; maxMinutes?: number })
  | (Shared & { kind: 'date'; min?: string; max?: string })
  | (Shared & { kind: 'duration'; maxMinutes?: number })

const pad = (n: number) => String(n).padStart(2, '0')
const toMinutes = (s: string) => { const match = /^(\d{1,2}):(\d{2})$/.exec(s); return match ? Number(match[1]) * 60 + Number(match[2]) : 0 }
const parseDate = (s: string) => { if(!/^\d{4}-\d{2}-\d{2}$/.test(s))return new Date();const parts = s.split('-').map(Number); return new Date(parts[0], parts[1] - 1, parts[2]) }
const isoDay = (y: number, m: number, d: number) => `${y}-${pad(m + 1)}-${pad(d)}`
const dateLabel = (iso: string) => /^\d{4}-\d{2}-\d{2}$/.test(iso)
  ? new Intl.DateTimeFormat('de-DE', { day: 'numeric', month: 'short', year: 'numeric' }).format(parseDate(iso))
  : 'Datum wählen'
const presets = [15, 30, 45, 60, 90, 120, 150, 180, 240]
const minutesLabel = (n: number) => n === 120 ? '2 Stunden' : n >= 60
  ? `${Math.floor(n / 60)} Std.${n % 60 ? ` ${n % 60} Min.` : ''}` : `${n} Min.`

const WHEEL_ROW=48
/** Accessible vertical scroll-snap wheel with precise 1-minute selection.
 * Scrolling settles on the nearest permitted item; click and keyboard work too. */
function PickerWheel({label,items,selected,onSelect}:{
  label:string;items:{value:number;disabled:boolean}[];selected:number;onSelect:(value:number)=>void
}){
  const scroller=useRef<HTMLDivElement>(null)
  const settle=useRef<ReturnType<typeof setTimeout>|null>(null)
  const selectedIndex=Math.max(0,items.findIndex(x=>x.value===selected))
  const latest=useRef(onSelect)
  latest.current=onSelect
  useEffect(()=>{
    const node=scroller.current
    if(node)node.scrollTop=selectedIndex*WHEEL_ROW
  },[selected,selectedIndex])
  useEffect(()=>()=>{if(settle.current)clearTimeout(settle.current)},[])
  const choose=(index:number,animated:boolean)=>{
    const node=scroller.current
    const item=items[index]
    if(!node||!item||item.disabled)return
    node.scrollTo({top:index*WHEEL_ROW,behavior:animated?'smooth':'auto'})
    latest.current(item.value)
  }
  const settleScroll=()=>{
    if(settle.current)clearTimeout(settle.current)
    settle.current=setTimeout(()=>{
      const node=scroller.current
      if(!node)return
      const index=Math.max(0,Math.min(items.length-1,Math.round(node.scrollTop/WHEEL_ROW)))
      const valid=items.map((x,i)=>({x,i})).filter(({x})=>!x.disabled)
      const closest=valid.sort((a,b)=>Math.abs(a.i-index)-Math.abs(b.i-index))[0]
      if(!closest)return
      node.scrollTo({top:closest.i*WHEEL_ROW,behavior:'smooth'})
      latest.current(closest.x.value)
    },115)
  }
  const step=(direction:number)=>{
    const current=items.findIndex(x=>x.value===selected)
    let at=current+direction
    while(at>=0&&at<items.length&&items[at].disabled)at+=direction
    if(at>=0&&at<items.length)choose(at,true)
  }
  return <div className="uf-wheel-column">
    <span className="uf-picker-column-label">{label}</span>
    <div className="uf-wheel-shell">
      <span className="uf-wheel-selected-area" aria-hidden="true"/>
      <div className="uf-wheel-list" ref={scroller} role="listbox" tabIndex={0}
        aria-label={label} aria-activedescendant={label==='Stunde'?'uf-wheel-hour-'+selected:'uf-wheel-minute-'+selected}
        onScroll={settleScroll}
        onKeyDown={e=>{
          if(e.key==='ArrowDown'){e.preventDefault();step(1)}
          if(e.key==='ArrowUp'){e.preventDefault();step(-1)}
          if(e.key==='Home'){e.preventDefault();choose(items.findIndex(x=>!x.disabled),true)}
          if(e.key==='End'){e.preventDefault();choose(items.reduce((last,x,i)=>x.disabled?last:i,-1),true)}
        }}>
        {items.map((item,index)=><button type="button" role="option" key={item.value}
          id={label==='Stunde'?'uf-wheel-hour-'+item.value:'uf-wheel-minute-'+item.value}
          className={'uf-wheel-option'+(item.value===selected?' is-selected':'')}
          aria-selected={item.value===selected} disabled={item.disabled}
          onClick={()=>choose(index,true)}>{pad(item.value)}</button>)}
      </div>
    </div>
  </div>
}

/** Custom, keyboard-accessible choice sheet, shared by Modules, Dashboard and admin forms.
 * No native iOS select/date/time wheels. The existing callbacks remain the source of truth. */
export default function UniflowPicker(props: Props) {
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState(props.value)
  const [creatingCustom, setCreatingCustom] = useState(false)
  const [customLabel, setCustomLabel] = useState('')
  const [month, setMonth] = useState(() => {
    const d = parseDate(props.value)
    return new Date(d.getFullYear(), d.getMonth(), 1)
  })
  const dialog = useRef<HTMLDivElement>(null)
  const trigger = useRef<HTMLButtonElement>(null)
  const kind = props.kind ?? 'select'
  const options = 'options' in props ? props.options : []
  const chosen = options.find(o => o.value === props.value)
  const display = kind === 'select'
    ? chosen?.label || props.placeholder || 'Auswählen'
    : kind === 'time' ? props.value
    : kind === 'date' ? dateLabel(props.value)
    : minutesLabel(Number(props.value) || 0)
  const openPicker = () => {
    if (props.disabled) return
    setDraft(props.value)
    setCreatingCustom(false)
    setCustomLabel('')
    if (kind === 'date') {
      const now=new Date()
      let value=props.value||isoDay(now.getFullYear(),now.getMonth(),now.getDate())
      if('min' in props&&props.min&&value<props.min)value=props.min
      if('max' in props&&props.max&&value>props.max)value=props.max
      const d = parseDate(value)
      setMonth(new Date(d.getFullYear(), d.getMonth(), 1))
    }
    setOpen(true)
  }
  const closePicker = () => { setOpen(false); trigger.current?.focus() }
  const commit = (next: string) => { props.onChange(next); closePicker() }
  useEffect(() => {
    if (!open) return
    const initialOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    dialog.current?.focus()
    const keydown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); closePicker(); return }
      if (event.key !== 'Tab' || !dialog.current) return
      const els = [...dialog.current.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled)')]
      if (!els.length) return
      if (event.shiftKey && document.activeElement === els[0]) { event.preventDefault(); els[els.length - 1].focus() }
      if (!event.shiftKey && document.activeElement === els[els.length - 1]) { event.preventDefault(); els[0].focus() }
    }
    document.addEventListener('keydown', keydown)
    return () => { document.body.style.overflow = initialOverflow; document.removeEventListener('keydown', keydown) }
  }, [open, kind])
  const hour = Math.min(23, Math.max(0, Math.floor(toMinutes(draft) / 60)))
  const minute = Math.min(59, Math.max(0, toMinutes(draft) % 60))
  const maxMinutes = 'maxMinutes' in props ? props.maxMinutes ?? (kind === 'time' ? 1439 : 1440) : 1440
  const validTime = toMinutes(draft) <= maxMinutes
  const duration = Number(draft)
  const validDuration = Number.isInteger(duration) && duration >= 5 && duration <= maxMinutes
  const y = month.getFullYear(), m = month.getMonth()
  const monthName = new Intl.DateTimeFormat('de-DE', { month: 'long', year: 'numeric' }).format(month)
  const dayCount = new Date(y, m + 1, 0).getDate()
  const offset = (new Date(y, m, 1).getDay() + 6) % 7
  const min = 'min' in props ? props.min : undefined
  const max = 'max' in props ? props.max : undefined
  const canPrev = !min || isoDay(y, m, 1) > min.slice(0, 7) + '-01'
  const nextMonth = new Date(y, m + 1, 1)
  const canNext = !max || isoDay(nextMonth.getFullYear(), nextMonth.getMonth(), 1) <= max.slice(0, 7) + '-01'

  return <>
    <button ref={trigger} type="button" className="uf-picker-trigger" aria-label={props.label} aria-haspopup="dialog" aria-expanded={open} disabled={props.disabled} onClick={openPicker}>
      <span className={!props.value ? 'uf-picker-placeholder' : ''}>{display}</span>
      {kind === 'time' ? <Clock3 size={16}/> : kind === 'date' ? <CalendarDays size={16}/> : <ChevronDown size={16}/>}
    </button>
    {open && createPortal(
      <div className="uf-picker-backdrop" onClick={e => { if (e.target === e.currentTarget) closePicker() }}>
        <section className="uf-picker-dialog" ref={dialog} tabIndex={-1} role="dialog" aria-modal="true" aria-label={props.label}>
          <div className="uf-picker-heading"><h2>{props.label}</h2><button type="button" aria-label="Schließen" className="uf-picker-close" onClick={closePicker}><X size={19}/></button></div>
          {kind === 'select' && <div className="uf-picker-choices" role="list">
            {options.map(option => <button type="button" key={option.value} className={'uf-picker-option ' + (draft === option.value ? 'selected' : '')} onClick={() => commit(option.value)} aria-pressed={draft === option.value}>
              <span><strong>{option.label}</strong>{option.detail && <small>{option.detail}</small>}</span>{draft === option.value && <Check size={17}/>}
            </button>)}
            {'allowCustom' in props && props.allowCustom && <>
              <button type="button" className={'uf-picker-option uf-picker-custom-toggle'+(creatingCustom?' selected':'')} onClick={() => setCreatingCustom(value=>!value)} aria-expanded={creatingCustom}>
                <span><Plus size={16}/> Eigene Art hinzufügen</span>
              </button>
              {creatingCustom && <div className="uf-picker-custom-entry">
                <label htmlFor="uf-custom-category">Bezeichnung</label>
                <div className="uf-picker-custom-row">
                  <input id="uf-custom-category" type="text" maxLength={45} autoFocus placeholder="z. B. Workshop oder Praktikum" value={customLabel} onChange={e=>setCustomLabel(e.target.value)} onKeyDown={e=>{if(e.key==='Enter'&&customLabel.trim())commit(customLabel.trim())}}/>
                  <button type="button" disabled={!customLabel.trim()} onClick={()=>commit(customLabel.trim())}><Check size={16}/> Übernehmen</button>
                </div>
              </div>}
            </>}
          </div>}
          {kind === 'time' && <>
            <p className="uf-picker-helper">Stunden und Minuten scrollen</p>
            <div className="uf-picker-columns uf-picker-wheel-columns">
              <PickerWheel label="Stunde" selected={hour}
                items={Array.from({length:24},(_,h)=>({value:h,disabled:h*60>maxMinutes}))}
                onSelect={h=>setDraft(`${pad(h)}:${pad(Math.min(minute,Math.max(0,maxMinutes-h*60)))}`)}/>
              <PickerWheel label="Minute" selected={minute}
                items={Array.from({length:60},(_,n)=>({value:n,disabled:hour*60+n>maxMinutes}))}
                onSelect={n=>setDraft(`${pad(hour)}:${pad(n)}`)}/>
            </div>
            <p className="uf-picker-preview">{draft} Uhr</p>
          </>}
          {kind === 'duration' && <>
            <p className="uf-picker-helper">Schnellauswahl</p>
            <div className="uf-picker-preset-grid">{presets.filter(n => n <= maxMinutes).map(n => <button type="button" key={n} aria-pressed={duration === n} className={duration === n ? 'selected' : ''} onClick={() => setDraft(String(n))}>{minutesLabel(n)}</button>)}</div>
            <label className="uf-picker-duration"><span>Individuelle Dauer (Minuten)</span><div className="uf-picker-duration-row">
              <button type="button" aria-label="5 Minuten weniger" onClick={() => setDraft(String(Math.max(5, (Number(draft) || 5) - 5)))}><Minus size={17}/></button>
              <input aria-label="Dauer in Minuten" type="text" inputMode="numeric" value={draft} onChange={e => { if (/^\d{0,4}$/.test(e.target.value)) setDraft(e.target.value) }}/>
              <button type="button" aria-label="5 Minuten mehr" onClick={() => setDraft(String(Math.min(maxMinutes, (Number(draft) || 0) + 5)))}><Plus size={17}/></button>
            </div></label>
            {!validDuration && <p className="uf-picker-error">Bitte 5 bis {maxMinutes} Minuten wählen.</p>}
          </>}
          {kind === 'date' && <>
            <div className="uf-picker-calendar-nav"><button type="button" disabled={!canPrev} aria-label="Vorheriger Monat" onClick={() => setMonth(new Date(y, m - 1, 1))}><ChevronLeft size={19}/></button><strong>{monthName}</strong><button type="button" disabled={!canNext} aria-label="Nächster Monat" onClick={() => setMonth(new Date(y, m + 1, 1))}><ChevronRight size={19}/></button></div>
            <div className="uf-picker-calendar">
              {['Mo','Di','Mi','Do','Fr','Sa','So'].map(name => <span key={name} className="uf-picker-weekday">{name}</span>)}
              {Array.from({ length: offset }, (_, n) => <span key={'blank-'+n}/>)}
              {Array.from({ length: dayCount }, (_, n) => {
                const d = isoDay(y, m, n + 1)
                return <button key={d} type="button" disabled={(!!min && d < min) || (!!max && d > max)} aria-pressed={draft === d} className={draft === d ? 'selected' : ''} onClick={() => setDraft(d)}>{n + 1}</button>
              })}
            </div>
          </>}
          {kind !== 'select' && <div className="uf-picker-actions">
            <button type="button" className="uf-picker-cancel" onClick={closePicker}>Abbrechen</button>
            <button type="button" className="uf-picker-confirm" disabled={(kind === 'time' && !validTime) || (kind === 'duration' && !validDuration) || (kind === 'date' && !draft)} onClick={() => commit(draft)}>Übernehmen <Check size={17}/></button>
          </div>}
        </section>
      </div>,
      document.body
    )}
  </>
}
