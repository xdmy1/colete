import { useRef } from 'react'
import { compressImage } from '../lib/compressImage'

// Selector compact de poze noi (la editarea unui colet). Lucreaza pe File-uri
// in memorie; incarcarea efectiva se face la salvare (useUpdateParcel).
export default function AddPhotos({
  files,
  onChange,
  max = 6,
}: {
  files: File[]
  onChange: (files: File[]) => void
  max?: number
}) {
  const inputRef = useRef<HTMLInputElement>(null)

  async function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const picked = Array.from(e.target.files || [])
    if (!picked.length) return
    e.target.value = ''
    const remaining = max - files.length
    const toProcess = picked.slice(0, remaining)
    const compressed = await Promise.all(
      toProcess.map(async (f) => (f.size > 200_000 ? compressImage(f) : f))
    )
    onChange([...files, ...compressed])
  }

  return (
    <div>
      <div className="grid grid-cols-3 gap-2">
        {files.map((file, i) => (
          <div
            key={i}
            className="relative aspect-square rounded-xl overflow-hidden border border-card-border bg-gray-50"
          >
            <img
              src={URL.createObjectURL(file)}
              alt={`Poză nouă ${i + 1}`}
              className="w-full h-full object-cover"
            />
            <button
              type="button"
              onClick={() => onChange(files.filter((_, idx) => idx !== i))}
              className="absolute top-1 right-1 w-6 h-6 bg-black/60 rounded-full flex items-center justify-center text-white"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        ))}
        {files.length < max && (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="aspect-square rounded-xl border-2 border-dashed border-card-border flex flex-col items-center justify-center gap-1 text-slate-300 hover:border-pill-green-border hover:text-emerald-400 transition-colors"
          >
            <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"
              />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            <span className="text-[11px] font-medium">+ Adaugă</span>
          </button>
        )}
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        onChange={handleChange}
        className="hidden"
      />
    </div>
  )
}
