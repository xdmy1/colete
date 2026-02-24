import { useState, useRef } from 'react'
import { compressImage } from '../../lib/compressImage'
import Button from '../ui/Button'

interface StepPhotoProps {
  onComplete: (photo: File) => void
}

export default function StepPhoto({ onComplete }: StepPhotoProps) {
  const [preview, setPreview] = useState<string | null>(null)
  const [compressedFile, setCompressedFile] = useState<File | null>(null)
  const [compressing, setCompressing] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    setCompressing(true)

    const compressed = await compressImage(file)
    setCompressedFile(compressed)
    setPreview(URL.createObjectURL(compressed))
    setCompressing(false)
  }

  function handleRetake() {
    if (preview) URL.revokeObjectURL(preview)
    setPreview(null)
    setCompressedFile(null)
    if (inputRef.current) {
      inputRef.current.value = ''
    }
  }

  return (
    <div className="flex flex-col items-center">
      <h2 className="text-xl font-bold text-slate-800 mb-2 self-start">
        Fotografiază Coletul
      </h2>
      <p className="text-slate-400 mb-6 self-start">
        Obligatoriu: fă o poză coletului pentru verificare.
      </p>

      {compressing ? (
        <div className="w-full h-64 border border-card-border rounded-2xl flex flex-col items-center justify-center gap-3">
          <div className="w-10 h-10 border-2 border-pill-green-border border-t-transparent rounded-full animate-spin" />
          <span className="text-sm text-slate-400">Se procesează poza...</span>
        </div>
      ) : preview ? (
        <div className="w-full space-y-4">
          <div className="rounded-2xl overflow-hidden border border-card-border">
            <img
              src={preview}
              alt="Preview colet"
              className="w-full max-h-80 object-cover"
            />
          </div>
          {compressedFile && (
            <p className="text-xs text-slate-400 text-center">
              {(compressedFile.size / 1024).toFixed(0)} KB
            </p>
          )}
          <div className="flex gap-3">
            <Button
              variant="secondary"
              size="lg"
              className="flex-1"
              onClick={handleRetake}
            >
              Refă poza
            </Button>
            <Button
              size="lg"
              className="flex-1"
              onClick={() => compressedFile && onComplete(compressedFile)}
            >
              Confirmă →
            </Button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => inputRef.current?.click()}
          className="w-full h-64 border border-dashed border-card-border rounded-2xl flex flex-col items-center justify-center gap-3 text-slate-300 hover:border-pill-green-border hover:text-emerald-400 transition-colors"
        >
          <svg
            className="w-16 h-16"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"
            />
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M15 13a3 3 0 11-6 0 3 3 0 016 0z"
            />
          </svg>
          <span className="text-lg font-medium">Apasă pentru a fotografia</span>
        </button>
      )}

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleFileChange}
        className="hidden"
      />
    </div>
  )
}
