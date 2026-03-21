import { useState, useRef } from 'react'
import { useSignedPhotoUrl } from '../hooks/usePhotoUrl'

// Sub-component: o singura poza cu signed URL propriu
function PhotoImage({ path, className }: { path: string; className: string }) {
  const { data: url, isLoading } = useSignedPhotoUrl(path)

  if (isLoading || !url) {
    return <div className={className + ' bg-gray-100 animate-pulse'} />
  }
  return <img src={url} alt="Colet" className={className} loading="eager" />
}

interface ParcelPhotoProps {
  photoPaths: string[]
  className?: string
}

export default function ParcelPhoto({
  photoPaths,
  className = 'w-full max-h-64 object-cover',
}: ParcelPhotoProps) {
  const [index, setIndex] = useState(0)
  const touchStartX = useRef<number | null>(null)

  if (photoPaths.length === 0) return null

  const single = photoPaths.length === 1

  function prev() { setIndex((i) => (i - 1 + photoPaths.length) % photoPaths.length) }
  function next() { setIndex((i) => (i + 1) % photoPaths.length) }

  function onTouchStart(e: React.TouchEvent) {
    touchStartX.current = e.touches[0].clientX
  }
  function onTouchEnd(e: React.TouchEvent) {
    if (touchStartX.current === null) return
    const delta = e.changedTouches[0].clientX - touchStartX.current
    if (delta < -40) next()
    else if (delta > 40) prev()
    touchStartX.current = null
  }

  return (
    <div className="relative select-none" onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
      <PhotoImage path={photoPaths[index]} className={className} />

      {!single && (
        <>
          <button
            onClick={(e) => { e.stopPropagation(); prev() }}
            className="absolute left-2 top-1/2 -translate-y-1/2 w-8 h-8 bg-black/40 rounded-full flex items-center justify-center text-white hover:bg-black/60"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); next() }}
            className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 bg-black/40 rounded-full flex items-center justify-center text-white hover:bg-black/60"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </button>
          <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1.5">
            {photoPaths.map((_, i) => (
              <button
                key={i}
                onClick={(e) => { e.stopPropagation(); setIndex(i) }}
                className={`w-2 h-2 rounded-full transition-colors ${i === index ? 'bg-white' : 'bg-white/40'}`}
              />
            ))}
          </div>
        </>
      )}
    </div>
  )
}
