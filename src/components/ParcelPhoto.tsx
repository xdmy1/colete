import { useState, useRef } from 'react'
import { createPortal } from 'react-dom'
import { useSignedPhotoUrl } from '../hooks/usePhotoUrl'

// Sub-component: o singura poza cu signed URL propriu
function PhotoImage({ path, className, onClick }: { path: string; className: string; onClick?: () => void }) {
  const { data: url, isLoading } = useSignedPhotoUrl(path)

  if (isLoading || !url) {
    return <div className={className + ' bg-gray-100 animate-pulse'} />
  }
  return (
    <img
      src={url}
      alt="Colet"
      className={className}
      loading="eager"
      onClick={onClick}
      style={onClick ? { cursor: 'zoom-in' } : undefined}
    />
  )
}

// Lightbox fullscreen
function Lightbox({ path, onClose }: { path: string; onClose: () => void }) {
  const { data: url } = useSignedPhotoUrl(path)

  return createPortal(
    <div
      className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center"
      onClick={onClose}
    >
      <button
        onClick={onClose}
        className="absolute top-4 right-4 w-10 h-10 flex items-center justify-center rounded-full bg-white/20 text-white hover:bg-white/30 transition-colors"
      >
        <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
      {url ? (
        <img
          src={url}
          alt="Colet"
          className="max-w-full max-h-full object-contain"
          onClick={(e) => e.stopPropagation()}
        />
      ) : (
        <div className="w-64 h-64 bg-white/10 animate-pulse rounded-2xl" />
      )}
    </div>,
    document.body
  )
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
  const [lightboxOpen, setLightboxOpen] = useState(false)
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
    <>
      <div className="relative select-none" onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
        <PhotoImage
          path={photoPaths[index]}
          className={className}
          onClick={() => setLightboxOpen(true)}
        />

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

        {/* Zoom hint icon */}
        <div className="absolute bottom-2 right-2 w-6 h-6 bg-black/40 rounded-full flex items-center justify-center pointer-events-none">
          <svg className="w-3.5 h-3.5 text-white" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <circle cx="11" cy="11" r="8" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M11 8v6M8 11h6" />
          </svg>
        </div>
      </div>

      {lightboxOpen && (
        <Lightbox path={photoPaths[index]} onClose={() => setLightboxOpen(false)} />
      )}
    </>
  )
}
