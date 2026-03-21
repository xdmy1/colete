import { useRef, useState } from 'react'
import { compressImage } from '../../lib/compressImage'
import Button from '../ui/Button'

const MAX_PHOTOS = 3

interface StepPhotoProps {
  photos: File[]
  onChange: (photos: File[]) => void
  onComplete: () => void
}

export default function StepPhoto({ photos, onChange, onComplete }: StepPhotoProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [inputKey, setInputKey] = useState(0)

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files || [])
    if (!files.length) return
    setInputKey((k) => k + 1) // force input remount → clears camera cache

    const remaining = MAX_PHOTOS - photos.length
    const toProcess = files.slice(0, remaining)

    const compressed = await Promise.all(
      toProcess.map(async (f) => (f.size > 200_000 ? compressImage(f) : f))
    )
    onChange([...photos, ...compressed])
  }

  function removePhoto(index: number) {
    onChange(photos.filter((_, i) => i !== index))
  }

  return (
    <div className="flex flex-col">
      <h2 className="text-xl font-bold text-slate-800 mb-1">Fotografiază Coletul</h2>
      <p className="text-slate-400 mb-6 text-sm">
        Adaugă 1–3 poze. Poți fotografia mai multe pachete din aceeași comandă.
      </p>

      <div className="grid grid-cols-3 gap-3 mb-6">
        {/* Sloturi cu poze adaugate */}
        {photos.map((file, i) => (
          <div key={i} className="relative aspect-square rounded-2xl overflow-hidden border border-card-border bg-gray-50">
            <img
              src={URL.createObjectURL(file)}
              alt={`Poza ${i + 1}`}
              className="w-full h-full object-cover"
            />
            <button
              onClick={() => removePhoto(i)}
              className="absolute top-1 right-1 w-6 h-6 bg-black/60 rounded-full flex items-center justify-center text-white"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
            <span className="absolute bottom-1 left-1 bg-black/50 text-white text-xs px-1.5 py-0.5 rounded-full">
              {(file.size / 1024).toFixed(0)} KB
            </span>
          </div>
        ))}

        {/* Slot pentru adaugare (daca mai e loc) */}
        {photos.length < MAX_PHOTOS && (
          <button
            onClick={() => inputRef.current?.click()}
            className="aspect-square rounded-2xl border-2 border-dashed border-card-border flex flex-col items-center justify-center gap-1.5 text-slate-300 hover:border-pill-green-border hover:text-emerald-400 transition-colors"
          >
            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"
              />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            <span className="text-xs font-medium">
              {photos.length === 0 ? 'Adaugă poză' : '+ Adaugă'}
            </span>
          </button>
        )}
      </div>

      <Button
        size="lg"
        className="w-full"
        disabled={photos.length === 0}
        onClick={onComplete}
      >
        Continuă →
      </Button>

      <input
        key={inputKey}
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        onChange={handleFileChange}
        className="hidden"
      />
    </div>
  )
}
