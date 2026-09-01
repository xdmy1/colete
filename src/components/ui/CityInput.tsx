import { useState, useRef, useEffect } from 'react'
import type { DestinationCode } from '../../lib/utils'
import { suggestCities, canonicalCity, CITIES, normalizeCity } from '../../lib/cities'

// Input de oras cu autocomplete din lista de orase a tarii.
// Soferii scriu des gresit ("Nortampton") — dropdown-ul propune denumirea
// corecta, iar la blur denumirea se corecteaza automat daca matchuieste un
// oras cunoscut (fara diacritice / case). Daca orasul NU e in lista, ce a
// scris operatorul ramane exact asa (scrie cum aude).

interface CityInputProps {
  country: DestinationCode
  value: string
  onChange: (city: string) => void
  placeholder?: string
  inputCls?: string
}

export default function CityInput({
  country,
  value,
  onChange,
  placeholder = 'Oraș',
  inputCls,
}: CityInputProps) {
  const [open, setOpen] = useState(false)
  const wrapperRef = useRef<HTMLDivElement>(null)

  const suggestions = open ? suggestCities(value, country) : []
  const isKnown = !!value.trim() &&
    (CITIES[country] ?? []).some((c) => normalizeCity(c) === normalizeCity(value))

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const defaultCls =
    'w-full px-4 py-3 rounded-xl border border-card-border text-base focus:outline-none focus:ring-1 focus:ring-pill-green-border focus:border-pill-green-border transition-colors'

  return (
    <div ref={wrapperRef} className="relative">
      <input
        type="text"
        placeholder={placeholder}
        value={value}
        onChange={(e) => {
          onChange(e.target.value)
          setOpen(true)
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => onChange(canonicalCity(value, country))}
        className={`${inputCls ?? defaultCls} ${isKnown ? 'pr-9' : ''}`}
      />
      {isKnown && (
        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-emerald-500 pointer-events-none">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        </span>
      )}
      {open && suggestions.length > 0 && (
        <div className="absolute z-20 left-0 right-0 top-full mt-1 bg-white border border-card-border rounded-xl shadow-lg overflow-hidden">
          {suggestions.map((city) => (
            <button
              key={city}
              type="button"
              // onMouseDown ca sa castige in fata blur-ului inputului
              onMouseDown={(e) => {
                e.preventDefault()
                onChange(city)
                setOpen(false)
              }}
              className="w-full text-left px-4 py-2.5 hover:bg-pill-green-bg/50 transition-colors border-b border-card-border last:border-b-0 text-sm font-semibold text-slate-800"
            >
              {city}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
