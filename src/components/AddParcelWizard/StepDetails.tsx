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
    weight: number
    manual_price?: number
  }) => void
  initialData: {
    sender_details: ContactDetails
    receiver_details: ContactDetails
    content_description: string
    nr_bucati: number
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
  const [weight, setWeight] = useState(initialData.weight || 0)
  const [priceAuto, setPriceAuto] = useState(initialData.manual_price === undefined)
  const [manualPrice, setManualPrice] = useState(initialData.manual_price ?? 0)

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
      weight,
      manual_price: priceAuto ? undefined : manualPrice,
    })
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
        <input
          type="text"
          placeholder="Adresa expeditor"
          value={sender.address}
          onChange={(e) => setSender({ ...sender, address: e.target.value })}
          className={inputCls}
        />
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
        <input
          type="text"
          placeholder="Adresa destinatar *"
          value={receiver.address}
          onChange={(e) => setReceiver({ ...receiver, address: e.target.value })}
          className={inputCls}
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
