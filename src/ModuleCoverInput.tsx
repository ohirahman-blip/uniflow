import { useEffect, useId, useRef, useState, type CSSProperties } from 'react'
import { ImagePlus, LoaderCircle, Trash2, Upload } from 'lucide-react'
import './module-cover.css'

async function prepareCover(file: File): Promise<string> {
  if (!/^image\/(jpeg|png|webp|gif|avif)$/.test(file.type)) throw new Error('Bitte ein JPG-, PNG-, WebP-, GIF- oder AVIF-Bild auswählen.')
  if (file.size > 20 * 1024 * 1024) throw new Error('Das Bild darf höchstens 20 MB groß sein.')
  const url = URL.createObjectURL(file)
  try {
    const image = new Image()
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve()
      image.onerror = () => reject(new Error('Das Bild konnte nicht geöffnet werden. Bitte ein anderes Bild wählen.'))
      image.src = url
    })
    const canvas = document.createElement('canvas')
    const scale = Math.min(1, 1280 / image.naturalWidth, 720 / image.naturalHeight)
    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale))
    canvas.height = Math.max(1, Math.round(image.naturalHeight * scale))
    const context = canvas.getContext('2d')
    if (!context) throw new Error('Das Bild konnte nicht verarbeitet werden.')
    // Keep the cover small enough to travel with the existing private workspace.
    for (let attempt = 0; attempt < 5; attempt++) {
      context.drawImage(image, 0, 0, canvas.width, canvas.height)
      const result = canvas.toDataURL('image/webp', 0.78 - attempt * 0.08)
      if (result.length <= 220000) return result
      canvas.width = Math.max(1, Math.round(canvas.width * 0.8))
      canvas.height = Math.max(1, Math.round(canvas.height * 0.8))
    }
    throw new Error('Dieses Bild ist zu detailreich. Bitte ein kleineres Bild auswählen.')
  } finally {
    URL.revokeObjectURL(url)
  }
}

export default function ModuleCoverInput({ value, color, onChange }: { value?: string; color?: string; onChange: (value: string | undefined) => void }) {
  const id = useId()
  const input = useRef<HTMLInputElement>(null)
  const request = useRef(0)
  const change = useRef(onChange)
  change.current = onChange
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  useEffect(() => () => { request.current++ }, [])
  const select = async (file?: File) => {
    if (!file) return
    const current = ++request.current
    setBusy(true)
    setError('')
    try {
      const cover = await prepareCover(file)
      if (current === request.current) change.current(cover)
    } catch (cause) {
      if (current === request.current) setError(cause instanceof Error ? cause.message : 'Das Bild konnte nicht gespeichert werden.')
    } finally {
      if (current === request.current) setBusy(false)
    }
  }
  return <div className="module-cover-input" aria-busy={busy} style={{'--cover-accent':color||'var(--module-accent, var(--mlh-accent, #929ddc))'} as CSSProperties}>
    <div className="module-cover-label"><span>Kursbild</span><small>Optional</small></div>
    <input data-ui="file-1" ref={input} id={id} hidden type="file" accept="image/jpeg,image/png,image/webp,image/gif,image/avif" disabled={busy} aria-label="Kursbild auswählen" onChange={event => { void select(event.target.files?.[0]); event.currentTarget.value = '' }} />
    <button data-ui="special-2" type="button" className={'module-cover-picker'+(value?' has-image':'')} disabled={busy} onClick={()=>input.current?.click()} aria-describedby={id+'-hint'}>
      {value&&<img className="module-cover-preview" src={value} alt=""/>}
      <span className="module-cover-picker-icon">{busy?<LoaderCircle size={22} className="module-cover-spinner"/>:value?<Upload size={22}/>:<ImagePlus size={25}/>}</span>
      <span className="module-cover-picker-copy"><strong>{busy?'Bild wird vorbereitet …':value?'Bild ändern':'Bild auswählen'}</strong><small>{value?'Dein Kurs. Dein Bild.':'Gib deinem Modul einen eigenen Look.'}</small></span>
    </button>
    <div className="module-cover-footer"><small id={id+'-hint'}>Für Kurskarte und Banner · bis 20 MB</small>{value&&<button data-ui="button-6" type="button" disabled={busy} onClick={()=>{setError('');onChange(undefined)}}><Trash2 size={14}/><span>Entfernen</span></button>}</div>
    {error && <p role="alert" className="inline-error">{error}</p>}
  </div>
}
