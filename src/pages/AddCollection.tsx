import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { useAddCollection } from '../hooks/useParcels'
import type { DestinationCode } from '../lib/utils'
import { DESTINATIONS, PHONE_PREFIX, getDestLabel } from '../lib/utils'
import Button from '../components/ui/Button'

function stripLeadingZero(value: string, prefix: string): string {
  if (value.startsWith(prefix) && value[prefix.length] === '0') {
    return prefix + value.slice(prefix.length + 1)
  }
  return value
}

export default function AddCollection() {
  const navigate = useNavigate()
  const { profile } = useAuth()
  const [country, setCountry] = useState<DestinationCode | null>(null)
  const [phone, setPhone] = useState('')
  const [address, setAddress] = useState('')
  const [notes, setNotes] = useState('')

  const driverId = profile?.id || ''
  const addCollection = useAddCollection(driverId)

  const allowedCodes = profile?.allowed_collection_countries ?? []
  const availableCountries = DESTINATIONS.filter(
    (d) => allowedCodes.includes(d.code)
  )

  function handleSelectCountry(code: DestinationCode) {
    setCountry(code)
    setPhone(PHONE_PREFIX[code])
  }

  async function handleSubmit() {
    if (!country || !phone.trim() || !address.trim()) return
    try {
      await addCollection.mutateAsync({
        country_code: country,
        phone,
        address,
        notes,
      })
      navigate('/')
    } catch (err: any) {
      const msg = err?.message || JSON.stringify(err)
      alert(`Eroare: ${msg}`)
    }
  }

  const inputCls =
    'w-full px-4 py-3 rounded-xl border border-card-border text-base focus:outline-none focus:ring-1 focus:ring-pill-green-border focus:border-pill-green-border transition-colors'

  const isValid = country && phone.trim().length > (PHONE_PREFIX[country]?.length || 0) && address.trim()

  if (!profile) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-soft-bg">
        <div className="w-8 h-8 border-2 border-pill-green-border border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-soft-bg flex flex-col">
      {/* Header */}
      <div className="bg-white border-b border-card-border px-4 py-3 flex items-center gap-3">
        <button
          onClick={() => navigate('/')}
          className="w-9 h-9 flex items-center justify-center rounded-full border border-card-border text-slate-400 hover:text-slate-700 hover:bg-gray-50 transition-colors"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <h1 className="text-lg font-semibold text-slate-800">Adauga Colectare</h1>
      </div>

      <div className="flex-1 p-4 space-y-5">
        {/* Country selector */}
        <div>
          <label className="text-sm font-semibold text-slate-600 uppercase tracking-wide block mb-2">
            Tara de colectare
          </label>
          <div className="grid grid-cols-2 gap-2">
            {availableCountries.map((dest) => (
              <button
                key={dest.code}
                type="button"
                onClick={() => handleSelectCountry(dest.code)}
                className={`py-3 rounded-xl font-bold text-sm border transition-all ${
                  country === dest.code
                    ? 'bg-purple-50 border-purple-400 text-purple-700'
                    : 'bg-white border-card-border text-slate-600 hover:border-purple-300'
                }`}
              >
                {dest.label}
              </button>
            ))}
          </div>
        </div>

        {/* Phone + Address + Notes — shown after country selection */}
        {country && (
          <>
            <div>
              <label className="text-sm font-semibold text-slate-600 uppercase tracking-wide block mb-2">
                Telefon
              </label>
              <input
                type="tel"
                placeholder={`Telefon (${getDestLabel(country)})`}
                value={phone}
                onChange={(e) => setPhone(stripLeadingZero(e.target.value, PHONE_PREFIX[country]))}
                className={inputCls}
              />
              <p className="text-[11px] text-slate-400 mt-0.5 ml-1">fara 0 la inceput</p>
            </div>

            <div>
              <label className="text-sm font-semibold text-slate-600 uppercase tracking-wide block mb-2">
                Adresa
              </label>
              <input
                type="text"
                placeholder="Adresa de colectare *"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                className={inputCls}
              />
            </div>

            <div>
              <label className="text-sm font-semibold text-slate-600 uppercase tracking-wide block mb-2">
                Nota
              </label>
              <textarea
                placeholder="Detalii suplimentare (optional)"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                className={`${inputCls} resize-none`}
              />
            </div>

            <Button
              size="lg"
              className="w-full mt-4"
              disabled={!isValid || addCollection.isPending}
              onClick={handleSubmit}
            >
              {addCollection.isPending ? 'Se salveaza...' : 'Salveaza colectarea'}
            </Button>
          </>
        )}
      </div>
    </div>
  )
}
