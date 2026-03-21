import { useState, useRef, useEffect } from 'react'
import type { ContactDetails } from '../../lib/types'
import type { DestinationCode } from '../../lib/utils'
import { calculatePrice, getCurrency, formatPrice } from '../../lib/utils'
import { useContacts } from '../../hooks/useContacts'
import Button from '../ui/Button'

interface StepDetailsProps {
  originCode: DestinationCode
  deliveryDestination: DestinationCode
  onComplete: (details: {
    sender_details: ContactDetails
    receiver_details: ContactDetails
    content_description: string
    nr_bucati: number
    payment_status: 'paid' | 'cod' | 'transfer'
    transfer_recipient?: string
    weight: number
    manual_price?: number
  }) => void
  initialData: {
    sender_details: ContactDetails
    receiver_details: ContactDetails
    content_description: string
    nr_bucati: number
    payment_status: 'paid' | 'cod' | 'transfer'
    transfer_recipient?: string
    weight: number
    manual_price?: number
  }
}

const PHONE_PREFIX: Record<DestinationCode, string> = {
  MD: '+373 ',
  UK: '+44 ',
  BE: '+32 ',
  NL: '+31 ',
  DE: '+49 ',
}

function AddressAutocomplete({
  placeholder,
  value,
  onChange,
  inputCls,
}: {
  placeholder: string
  value: string
  onChange: (val: string) => void
  inputCls: string
}) {
  const [suggestions, setSuggestions] = useState<string[]>([])
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const wrapperRef = useRef<HTMLDivElement>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  function handleChange(val: string) {
    onChange(val)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (val.trim().length < 3) {
      setSuggestions([])
      setOpen(false)
      return
    }
    debounceRef.current = setTimeout(async () => {
      setLoading(true)
      try {
        const res = await fetch(
          `https://photon.komoot.io/api/?q=${encodeURIComponent(val)}&limit=5&lang=ro`
        )
        const data = await res.json()
        const results: string[] = (data.features || []).map((f: { properties: Record<string, string> }) => {
          const p = f.properties
          return [p.name, p.street && p.housenumber ? `${p.street} ${p.housenumber}` : p.street, p.city || p.town || p.village, p.country]
            .filter(Boolean).join(', ')
        })
        setSuggestions(results)
        setOpen(true)
      } catch {
        setSuggestions([])
      } finally {
        setLoading(false)
      }
    }, 300)
  }

  return (
    <div ref={wrapperRef} className="relative">
      <input
        type="text"
        placeholder={placeholder}
        value={value}
        onChange={(e) => handleChange(e.target.value)}
        onFocus={() => suggestions.length > 0 && setOpen(true)}
        className={inputCls}
      />
      {loading && (
        <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
          <svg className="w-4 h-4 animate-spin text-slate-300" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
          </svg>
        </div>
      )}
      {open && suggestions.length > 0 && (
        <div className="absolute z-20 left-0 right-0 top-full mt-1 bg-white border border-card-border rounded-xl shadow-lg overflow-hidden">
          {suggestions.map((suggestion, i) => (
            <button
              key={i}
              type="button"
              onClick={() => {
                onChange(suggestion)
                setOpen(false)
                setSuggestions([])
              }}
              className="w-full text-left px-4 py-2.5 hover:bg-pill-green-bg/50 transition-colors border-b border-card-border last:border-b-0"
            >
              <span className="text-sm text-slate-700">{suggestion}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function ContactAutocomplete({
  placeholder,
  value,
  contacts,
  onChange,
  onSelect,
  inputCls,
  type = 'text',
}: {
  placeholder: string
  value: string
  contacts: ContactDetails[]
  onChange: (val: string) => void
  onSelect: (contact: ContactDetails) => void
  inputCls: string
  type?: string
}) {
  const [open, setOpen] = useState(false)
  const wrapperRef = useRef<HTMLDivElement>(null)

  const query = value.toLowerCase().trim()
  const suggestions = query.length >= 2
    ? contacts.filter(
        (c) =>
          c.name.toLowerCase().includes(query) ||
          c.phone.includes(query)
      ).slice(0, 5)
    : []

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  return (
    <div ref={wrapperRef} className="relative">
      <input
        type={type}
        placeholder={placeholder}
        value={value}
        onChange={(e) => {
          onChange(e.target.value)
          setOpen(true)
        }}
        onFocus={() => setOpen(true)}
        className={inputCls}
      />
      {open && suggestions.length > 0 && (
        <div className="absolute z-20 left-0 right-0 top-full mt-1 bg-white border border-card-border rounded-xl shadow-lg overflow-hidden">
          {suggestions.map((contact, i) => (
            <button
              key={contact.phone + i}
              type="button"
              onClick={() => {
                onSelect(contact)
                setOpen(false)
              }}
              className="w-full text-left px-4 py-2.5 hover:bg-pill-green-bg/50 transition-colors border-b border-card-border last:border-b-0"
            >
              <span className="text-sm font-semibold text-slate-800">{contact.name}</span>
              <span className="text-xs text-slate-400 ml-2">{contact.phone}</span>
              {contact.address && (
                <p className="text-xs text-slate-400 truncate">{contact.address}</p>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

export default function StepDetails({
  originCode,
  deliveryDestination,
  onComplete,
  initialData,
}: StepDetailsProps) {
  const [sender, setSender] = useState<ContactDetails>(() => ({
    ...initialData.sender_details,
    phone: initialData.sender_details.phone || PHONE_PREFIX[originCode],
  }))
  const [receiver, setReceiver] = useState<ContactDetails>(() => ({
    ...initialData.receiver_details,
    phone: initialData.receiver_details.phone || PHONE_PREFIX[deliveryDestination],
  }))
  const [contentDesc, setContentDesc] = useState(initialData.content_description)
  const [nrBucati, setNrBucati] = useState(initialData.nr_bucati || 1)
  const [paymentStatus, setPaymentStatus] = useState<'paid' | 'cod' | 'transfer'>(initialData.payment_status || 'cod')
  const [transferRecipient, setTransferRecipient] = useState(initialData.transfer_recipient || '')
  const [weight, setWeight] = useState(initialData.weight || 0)
  const [priceAuto, setPriceAuto] = useState(initialData.manual_price === undefined)
  const [manualPrice, setManualPrice] = useState(initialData.manual_price ?? 0)
  const [locLoading, setLocLoading] = useState(false)

  const { data: contacts = [] } = useContacts()

  const currency = getCurrency(originCode, deliveryDestination)
  const autoPrice = calculatePrice(weight)
  const displayPrice = priceAuto ? autoPrice : manualPrice

  const isValid =
    sender.name.trim() &&
    sender.phone.trim() &&
    receiver.name.trim() &&
    receiver.phone.trim() &&
    receiver.address.trim() &&
    weight > 0

  function handleSubmit() {
    if (!isValid) return
    onComplete({
      sender_details: sender,
      receiver_details: receiver,
      content_description: contentDesc,
      nr_bucati: nrBucati,
      payment_status: paymentStatus,
      transfer_recipient: paymentStatus === 'transfer' ? transferRecipient : undefined,
      weight,
      manual_price: priceAuto ? undefined : manualPrice,
    })
  }

  async function fillLocation() {
    if (!navigator.geolocation) return
    setLocLoading(true)
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const { latitude, longitude } = pos.coords
          const res = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&accept-language=ro`,
            { headers: { 'User-Agent': 'colete-app' } }
          )
          const json = await res.json()
          const a = json.address || {}
          const parts = [
            a.road || a.pedestrian || a.footway,
            a.house_number,
            a.village || a.town || a.city || a.municipality,
            a.county,
            a.country,
          ].filter(Boolean)
          const address = parts.length > 0 ? parts.join(', ') : json.display_name
          setSender((s) => ({ ...s, address }))
        } catch {
          // fallback: doar coordonate
          setSender((s) => ({ ...s, address: `${pos.coords.latitude.toFixed(5)}, ${pos.coords.longitude.toFixed(5)}` }))
        } finally {
          setLocLoading(false)
        }
      },
      () => setLocLoading(false),
      { enableHighAccuracy: true, timeout: 10000 }
    )
  }

  const inputCls = 'w-full px-4 py-3 rounded-xl border border-card-border text-base focus:outline-none focus:ring-1 focus:ring-pill-green-border focus:border-pill-green-border transition-colors'

  return (
    <div className="space-y-5">
      <h2 className="text-xl font-bold text-slate-800">Detalii Colet</h2>

      {/* Expeditor */}
      <fieldset className="space-y-3">
        <legend className="text-sm font-semibold text-slate-600 uppercase tracking-wide">
          Expeditor
        </legend>
        <ContactAutocomplete
          placeholder="Nume expeditor *"
          value={sender.name}
          contacts={contacts}
          onChange={(val) => setSender({ ...sender, name: val })}
          onSelect={(c) => setSender({ name: c.name, phone: c.phone, address: c.address })}
          inputCls={inputCls}
        />
        <input
          type="tel"
          placeholder="Telefon expeditor *"
          value={sender.phone}
          onChange={(e) => setSender({ ...sender, phone: e.target.value })}
          className={inputCls}
        />
        <div className="flex gap-2">
          <input
            type="text"
            placeholder="Adresa expeditor"
            value={sender.address}
            onChange={(e) => setSender({ ...sender, address: e.target.value })}
            className={inputCls}
          />
          <button
            type="button"
            onClick={fillLocation}
            disabled={locLoading}
            title="Folosește locația mea"
            className="flex-shrink-0 w-12 h-12 rounded-xl border border-card-border flex items-center justify-center text-slate-400 hover:text-emerald-600 hover:border-pill-green-border transition-colors disabled:opacity-50"
          >
            {locLoading ? (
              <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
              </svg>
            ) : (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 2C8.134 2 5 5.134 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.866-3.134-7-7-7z" />
                <circle cx="12" cy="9" r="2.5" fill="currentColor" stroke="none" />
              </svg>
            )}
          </button>
        </div>
      </fieldset>

      {/* Destinatar */}
      <fieldset className="space-y-3">
        <legend className="text-sm font-semibold text-slate-600 uppercase tracking-wide">
          Destinatar
        </legend>
        <ContactAutocomplete
          placeholder="Nume destinatar *"
          value={receiver.name}
          contacts={contacts}
          onChange={(val) => setReceiver({ ...receiver, name: val })}
          onSelect={(c) => setReceiver({ name: c.name, phone: c.phone, address: c.address })}
          inputCls={inputCls}
        />
        <input
          type="tel"
          placeholder="Telefon destinatar *"
          value={receiver.phone}
          onChange={(e) => setReceiver({ ...receiver, phone: e.target.value })}
          className={inputCls}
        />
        <AddressAutocomplete
          placeholder="Adresa destinatar *"
          value={receiver.address}
          onChange={(val) => setReceiver({ ...receiver, address: val })}
          inputCls={inputCls}
        />
      </fieldset>

      {/* Aspect (descriere comanda) */}
      <div>
        <label className="text-sm font-semibold text-slate-600 uppercase tracking-wide block mb-2">
          Aspect
        </label>
        <input
          type="text"
          placeholder="Descrie coletul (ex: haine, documente)"
          value={contentDesc}
          onChange={(e) => setContentDesc(e.target.value)}
          className={inputCls}
        />
      </div>

      {/* Nr de bucăți */}
      <div>
        <label className="text-sm font-semibold text-slate-600 uppercase tracking-wide block mb-2">
          Nr de bucăți
        </label>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setNrBucati((n) => Math.max(1, n - 1))}
            className="w-11 h-11 rounded-xl border border-card-border flex items-center justify-center text-xl font-bold text-slate-600 hover:bg-gray-50 active:bg-gray-100 transition-colors select-none"
          >
            −
          </button>
          <span className="text-2xl font-extrabold text-slate-800 min-w-[2.5rem] text-center">
            {nrBucati}
          </span>
          <button
            type="button"
            onClick={() => setNrBucati((n) => n + 1)}
            className="w-11 h-11 rounded-xl border border-card-border flex items-center justify-center text-xl font-bold text-slate-600 hover:bg-gray-50 active:bg-gray-100 transition-colors select-none"
          >
            +
          </button>
          <span className="text-sm text-slate-400 ml-1">buc.</span>
        </div>
      </div>

      {/* Plată */}
      <div className="space-y-3">
        <label className="text-sm font-semibold text-slate-600 uppercase tracking-wide block">
          Plată
        </label>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setPaymentStatus('paid')}
            className={`flex-1 py-3 rounded-xl font-bold text-sm border transition-all ${
              paymentStatus === 'paid'
                ? 'bg-emerald-50 border-emerald-400 text-emerald-700'
                : 'border-card-border text-slate-400 hover:border-emerald-300'
            }`}
          >
            ✓ Achitat
          </button>
          <button
            type="button"
            onClick={() => setPaymentStatus('cod')}
            className={`flex-1 py-3 rounded-xl font-bold text-sm border transition-all ${
              paymentStatus === 'cod'
                ? 'bg-red-50 border-red-400 text-red-700'
                : 'border-card-border text-slate-400 hover:border-red-300'
            }`}
          >
            La livrare
          </button>
          <button
            type="button"
            onClick={() => setPaymentStatus('transfer')}
            className={`flex-1 py-3 rounded-xl font-bold text-sm border transition-all ${
              paymentStatus === 'transfer'
                ? 'bg-blue-50 border-blue-400 text-blue-700'
                : 'border-card-border text-slate-400 hover:border-blue-300'
            }`}
          >
            Transfer
          </button>
        </div>
        {paymentStatus === 'transfer' && (
          <input
            type="text"
            placeholder="Cui i s-a făcut transferul? *"
            value={transferRecipient}
            onChange={(e) => setTransferRecipient(e.target.value)}
            className={inputCls}
            autoFocus
          />
        )}
      </div>

      {/* Greutate + Preț */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="text-sm font-semibold text-slate-600 uppercase tracking-wide block mb-2">
            Greutate (kg)
          </label>
          <input
            type="number"
            min="0"
            step="0.1"
            placeholder="0"
            value={weight || ''}
            onChange={(e) => setWeight(parseFloat(e.target.value) || 0)}
            className={inputCls}
          />
        </div>
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-sm font-semibold text-slate-600 uppercase tracking-wide">
              Preț
            </label>
            <label className="flex items-center gap-1.5 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={priceAuto}
                onChange={(e) => {
                  setPriceAuto(e.target.checked)
                  if (e.target.checked) setManualPrice(0)
                  else setManualPrice(autoPrice)
                }}
                className="w-3.5 h-3.5 accent-emerald-600"
              />
              <span className="text-xs font-semibold text-emerald-700">AUTO</span>
            </label>
          </div>
          {priceAuto ? (
            <div className="w-full px-4 py-3 rounded-xl bg-pill-green-bg border border-pill-green-border text-lg font-semibold text-slate-700">
              {weight > 0 ? formatPrice(displayPrice, currency) : '—'}
            </div>
          ) : (
            <input
              type="number"
              min="0"
              step="0.5"
              placeholder="0"
              value={manualPrice || ''}
              onChange={(e) => setManualPrice(parseFloat(e.target.value) || 0)}
              className={inputCls}
            />
          )}
        </div>
      </div>

      <Button
        size="lg"
        className="w-full mt-4"
        disabled={!isValid}
        onClick={handleSubmit}
      >
        Continuă → Foto
      </Button>
    </div>
  )
}
