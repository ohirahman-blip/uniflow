import { useEffect, useId, useRef, useState } from 'react'
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

export default function ModuleCoverInput({ value, onChange }: { value?: string; onChange: (value: string | undefined) => void }) {
  const id = useId()
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
  return <div className="module-cover-input" aria-busy={busy}>
    <label htmlFor={id}>Kursbild</label>
    {value && <img className="module-cover-preview" src={value} alt="Aktuelles Kursbild" />}
    <input id={id} type="file" accept="image/jpeg,image/png,image/webp,image/gif,image/avif" disabled={busy} onChange={event => { void select(event.target.files?.[0]); event.currentTarget.value = '' }} />
    <small>{busy ? 'Bild wird vorbereitet …' : 'Für die Kurskarte und den großen Lernbanner. Max. 20 MB.'}</small>
    {value && <button type="button" disabled={busy} onClick={() => { setError(''); onChange(undefined) }}>Bild entfernen</button>}
    {error && <p role="alert" className="inline-error">{error}</p>}
  </div>
}
